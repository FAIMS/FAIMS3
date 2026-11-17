#!/bin/bash

# CouchDB Backup Script using Restic to Digital Ocean Spaces
# This script creates incremental, deduplicated backups of CouchDB data files
# Backs up secondary indexes BEFORE main database files to ensure reliable recovery

set -euo pipefail  # Exit on error, undefined variables, and pipe failures

#############################################
# LOAD CONFIGURATION FROM .env FILE
#############################################

ENV_FILE="/opt/backup/backup.env"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "ERROR: Configuration file not found: $ENV_FILE"
    echo "Please create $ENV_FILE with required variables"
    exit 1
fi

# Source the environment file
# shellcheck disable=SC1090
source "$ENV_FILE"

# Validate required variables
required_vars=(
    "COUCHDB_DATA_DIR"
    "DO_SPACES_ENDPOINT"
    "DO_SPACES_BUCKET"
    "AWS_ACCESS_KEY_ID"
    "AWS_SECRET_ACCESS_KEY"
    "RESTIC_PASSWORD"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    if [[ -z "${!var:-}" ]]; then
        missing_vars+=("$var")
    fi
done

if [[ ${#missing_vars[@]} -gt 0 ]]; then
    echo "ERROR: Missing required variables in $ENV_FILE:"
    printf '  - %s\n' "${missing_vars[@]}"
    exit 1
fi

#############################################
# CONFIGURATION - With defaults
#############################################

# Restic repository path
RESTIC_REPOSITORY="s3:${DO_SPACES_ENDPOINT}/${DO_SPACES_BUCKET}/couchdb-restic"

# Retention policy (can be overridden in .env)
KEEP_DAILY="${KEEP_DAILY:-7}"
KEEP_WEEKLY="${KEEP_WEEKLY:-4}"
KEEP_MONTHLY="${KEEP_MONTHLY:-12}"

# Backup metadata (can be overridden in .env)
BACKUP_TAG="${BACKUP_TAG:-couchdb-production}"
LOG_DIR="${LOG_DIR:-/var/log/couchdb-backup}"
LOG_FILE="${LOG_DIR}/backup-$(date +%Y%m%d-%H%M%S).log"

# Notification settings (optional, can be set in .env)
NOTIFY_EMAIL="${NOTIFY_EMAIL:-}"
NOTIFY_WEBHOOK="${NOTIFY_WEBHOOK:-}"

#############################################
# SETUP
#############################################

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Export credentials for restic
export AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY"
export RESTIC_PASSWORD="$RESTIC_PASSWORD"
export RESTIC_REPOSITORY="$RESTIC_REPOSITORY"

#############################################
# LOGGING FUNCTIONS
#############################################

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log_error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $*" | tee -a "$LOG_FILE" >&2
}

log_warning() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $*" | tee -a "$LOG_FILE"
}

send_notification() {
    local status=$1
    local message=$2
    
    if [[ -n "$NOTIFY_EMAIL" ]]; then
        echo "$message" | mail -s "CouchDB Backup: $status" "$NOTIFY_EMAIL"
    fi
    
    if [[ -n "$NOTIFY_WEBHOOK" ]]; then
        curl -X POST "$NOTIFY_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"status\":\"$status\",\"message\":\"$message\",\"timestamp\":\"$(date -Iseconds)\"}" \
            2>/dev/null || true
    fi
}

#############################################
# BACKUP FUNCTIONS
#############################################

check_and_clear_stale_locks() {
    log "Checking for stale repository locks..."
    
    # Try to list snapshots - this will fail if locked
    if ! restic snapshots &>/dev/null; then
        log_warning "Repository appears to be locked"
        
        # Check if lock is stale (older than 1 hour)
        local lock_info=$(restic list locks 2>&1 || echo "")
        
        if [[ -n "$lock_info" ]]; then
            log "Found locks in repository"
            log "Attempting to unlock stale locks..."
            
            if restic unlock; then
                log "Stale locks removed successfully"
                return 0
            else
                log_error "Failed to remove locks"
                log_error "You may need to manually run: restic unlock"
                return 1
            fi
        fi
    else
        log "No stale locks found"
        return 0
    fi
}

initialize_repository() {
    log "Checking if restic repository exists..."
    
    # Check for stale locks first
    if ! restic snapshots &>/dev/null; then
        # Could be locked or doesn't exist
        local check_result=$(restic snapshots 2>&1 || true)
        
        if echo "$check_result" | grep -q "repository is already locked"; then
            log_warning "Repository is locked, attempting to clear stale locks..."
            if ! restic unlock 2>&1 | tee -a "$LOG_FILE"; then
                log_error "Failed to unlock repository"
                return 1
            fi
            log "Locks cleared, retrying..."
        elif echo "$check_result" | grep -q "Is there a repository at"; then
            log "Initializing new restic repository at $RESTIC_REPOSITORY"
            if ! restic init; then
                log_error "Failed to initialize restic repository"
                return 1
            fi
            log "Repository initialized successfully"
            return 0
        else
            log_error "Cannot access repository: $check_result"
            return 1
        fi
    fi
    
    log "Repository already exists"
}

verify_couchdb_data() {
    log "Verifying CouchDB data directory structure..."
    
    if [[ ! -d "$COUCHDB_DATA_DIR" ]]; then
        log_error "CouchDB data directory not found: $COUCHDB_DATA_DIR"
        return 1
    fi
    
    # Check for main database files
    local main_db_files=$(find "$COUCHDB_DATA_DIR" -maxdepth 1 -name "*.couch" 2>/dev/null | wc -l)
    local shard_db_files=$(find "$COUCHDB_DATA_DIR/shards" -name "*.couch" 2>/dev/null | wc -l)
    
    log "Found $main_db_files system database files"
    log "Found $shard_db_files shard database files"
    
    # Check for secondary indexes
    if [[ -d "$COUCHDB_DATA_DIR/.shards" ]]; then
        local index_files=$(find "$COUCHDB_DATA_DIR/.shards" -type f 2>/dev/null | wc -l)
        log "Found $index_files secondary index files"
    else
        log "No .shards directory found (secondary indexes may not be present)"
    fi
    
    if [[ $main_db_files -eq 0 && $shard_db_files -eq 0 ]]; then
        log_error "No .couch files found in $COUCHDB_DATA_DIR"
        return 1
    fi
    
    return 0
}

backup_secondary_indexes() {
    log "=== Phase 1: Backing up secondary indexes (.shards) ==="
    
    local secondary_index_dir="$COUCHDB_DATA_DIR/.shards"
    
    if [[ ! -d "$secondary_index_dir" ]]; then
        log "No secondary index directory found at $secondary_index_dir - skipping"
        return 0
    fi
    
    local start_time=$(date +%s)
    local current_date=$(date +%Y-%m-%d)
    local current_time=$(date +%H:%M:%S)
    
    log "Backing up: $secondary_index_dir"
    
    if restic backup "$secondary_index_dir" \
        --tag "$BACKUP_TAG" \
        --tag "secondary-indexes" \
        --tag "$current_date" \
        --tag "phase-1-indexes" \
        --host "couchdb-indexes" \
        --time "$current_date $current_time" \
        --verbose \
        2>&1 | tee -a "$LOG_FILE"; then
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log "Secondary indexes backed up successfully in ${duration} seconds"
        return 0
    else
        log_error "Secondary index backup failed"
        return 1
    fi
}

backup_main_databases() {
    log "=== Phase 2: Backing up main database files ==="
    
    local start_time=$(date +%s)
    local current_date=$(date +%Y-%m-%d)
    local current_time=$(date +%H:%M:%S)
    
    # Perform backup with exclusion of .shards directory
    if restic backup "$COUCHDB_DATA_DIR" \
        --exclude="$COUCHDB_DATA_DIR/.shards" \
        --tag "$BACKUP_TAG" \
        --tag "main-databases" \
        --tag "$current_date" \
        --tag "phase-2-databases" \
        --host "couchdb-main" \
        --time "$current_date $current_time" \
        --verbose \
        2>&1 | tee -a "$LOG_FILE"; then
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log "Main databases backed up successfully in ${duration} seconds"
        return 0
    else
        log_error "Main database backup failed"
        return 1
    fi
}

perform_backup() {
    log "Starting two-phase CouchDB backup"
    log "Target: $RESTIC_REPOSITORY"
    log "Strategy: Secondary indexes first, then main databases"
    log ""
    
    local overall_start=$(date +%s)
    
    # Phase 1: Backup secondary indexes FIRST
    if ! backup_secondary_indexes; then
        log_error "Phase 1 failed - aborting backup"
        return 1
    fi
    
    log ""
    
    # Small delay to ensure timestamp ordering
    sleep 2
    
    # Phase 2: Backup main databases SECOND
    if ! backup_main_databases; then
        log_error "Phase 2 failed - backup incomplete"
        return 1
    fi
    
    local overall_end=$(date +%s)
    local total_duration=$((overall_end - overall_start))
    
    log ""
    log "=== Backup Complete ==="
    log "Total backup time: ${total_duration} seconds"
    
    return 0
}

apply_retention_policy() {
    log "Applying retention policy..."
    log "Keeping: $KEEP_DAILY daily, $KEEP_WEEKLY weekly, $KEEP_MONTHLY monthly"
    
    # Apply to both secondary indexes and main databases
    local success=0
    
    log "Applying retention to secondary indexes..."
    if ! restic forget \
        --keep-daily "$KEEP_DAILY" \
        --keep-weekly "$KEEP_WEEKLY" \
        --keep-monthly "$KEEP_MONTHLY" \
        --tag "secondary-indexes" \
        --host "couchdb-indexes" \
        --prune \
        --verbose \
        2>&1 | tee -a "$LOG_FILE"; then
        
        # Check if failure was due to lock - if snapshots FAILS, there's a lock
        if ! restic snapshots &>/dev/null; then
            log_warning "Lock detected, attempting to clear and retry..."
            restic unlock 2>&1 | tee -a "$LOG_FILE"
            
            # Retry once after unlock
            if restic forget \
                --keep-daily "$KEEP_DAILY" \
                --keep-weekly "$KEEP_WEEKLY" \
                --keep-monthly "$KEEP_MONTHLY" \
                --tag "secondary-indexes" \
                --host "couchdb-indexes" \
                --prune \
                --verbose \
                2>&1 | tee -a "$LOG_FILE"; then
                log "Retention applied to secondary indexes after unlock"
            else
                log_error "Failed to apply retention to secondary indexes even after unlock"
                success=1
            fi
        else
            log_error "Failed to apply retention to secondary indexes (not a lock issue)"
            success=1
        fi
    else
        log "Retention applied to secondary indexes"
    fi
    
    log "Applying retention to main databases..."
    if ! restic forget \
        --keep-daily "$KEEP_DAILY" \
        --keep-weekly "$KEEP_WEEKLY" \
        --keep-monthly "$KEEP_MONTHLY" \
        --tag "main-databases" \
        --host "couchdb-main" \
        --prune \
        --verbose \
        2>&1 | tee -a "$LOG_FILE"; then
        
        # Check if failure was due to lock - if snapshots FAILS, there's a lock
        if ! restic snapshots &>/dev/null; then
            log_warning "Lock detected, attempting to clear and retry..."
            restic unlock 2>&1 | tee -a "$LOG_FILE"
            
            # Retry once after unlock
            if restic forget \
                --keep-daily "$KEEP_DAILY" \
                --keep-weekly "$KEEP_WEEKLY" \
                --keep-monthly "$KEEP_MONTHLY" \
                --tag "main-databases" \
                --host "couchdb-main" \
                --prune \
                --verbose \
                2>&1 | tee -a "$LOG_FILE"; then
                log "Retention applied to main databases after unlock"
            else
                log_error "Failed to apply retention to main databases even after unlock"
                success=1
            fi
        else
            log_error "Failed to apply retention to main databases (not a lock issue)"
            success=1
        fi
    else
        log "Retention applied to main databases"
    fi
    
    return $success
}

check_repository_health() {
    log "Checking repository health..."
    
    if restic check --read-data-subset=5% 2>&1 | tee -a "$LOG_FILE"; then
        log "Repository health check passed"
        return 0
    else
        log_error "Repository health check failed"
        return 1
    fi
}

show_backup_stats() {
    log "Recent secondary index snapshots:"
    restic snapshots --tag "secondary-indexes" --host "couchdb-indexes" --latest 5 2>&1 | tee -a "$LOG_FILE"
    
    log ""
    log "Recent main database snapshots:"
    restic snapshots --tag "main-databases" --host "couchdb-main" --latest 5 2>&1 | tee -a "$LOG_FILE"
    
    log ""
    log "Repository statistics:"
    restic stats --mode raw-data 2>&1 | tee -a "$LOG_FILE"
}

#############################################
# MAIN EXECUTION
#############################################

main() {
    log "=========================================="
    log "CouchDB Two-Phase Backup Script Started"
    log "=========================================="
    log "Configuration loaded from: $ENV_FILE"
    
    local overall_status=0
    local error_message=""
    
    # Check prerequisites
    if ! command -v restic &> /dev/null; then
        error_message="restic is not installed. Install with: apt-get install restic (or brew install restic on Mac)"
        log_error "$error_message"
        send_notification "FAILED" "$error_message"
        exit 1
    fi
    
    # Initialize repository if needed
    if ! initialize_repository; then
        error_message="Failed to initialize repository"
        send_notification "FAILED" "$error_message"
        exit 1
    fi
    
    # Verify CouchDB data exists
    if ! verify_couchdb_data; then
        error_message="CouchDB data verification failed"
        send_notification "FAILED" "$error_message"
        exit 1
    fi
    
    log ""
    
    # Perform the two-phase backup
    if ! perform_backup; then
        error_message="Backup operation failed"
        overall_status=1
    fi
    
    log ""
    
    # Apply retention policy (even if backup failed, to manage space)
    if ! apply_retention_policy; then
        log_error "Retention policy application failed (non-fatal)"
    fi
    
    # Periodic health check (weekly - check if today is Sunday)
    if [[ $(date +%u) -eq 7 ]]; then
        log ""
        if ! check_repository_health; then
            log_error "Repository health check failed (non-fatal)"
        fi
    fi
    
    log ""
    
    # Show statistics
    show_backup_stats
    
    log "=========================================="
    if [[ $overall_status -eq 0 ]]; then
        log "CouchDB Backup Script Completed Successfully"
        send_notification "SUCCESS" "CouchDB two-phase backup completed successfully. Check logs at $LOG_FILE"
    else
        log "CouchDB Backup Script Completed with Errors"
        send_notification "FAILED" "CouchDB backup failed. Error: $error_message. Check logs at $LOG_FILE"
    fi
    log "=========================================="
    
    # Keep only last 30 days of logs
    find "$LOG_DIR" -name "backup-*.log" -mtime +30 -delete 2>/dev/null || true
    
    exit $overall_status
}

# Run main function
main "$@"
