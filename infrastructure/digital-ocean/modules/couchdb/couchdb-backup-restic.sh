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
    "COUCHDB_USER"
    "COUCHDB_PASSWORD"
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
COUCHDB_SERVICE="${COUCHDB_SERVICE:-couchdb}"
BACKUP_METADATA_FILE="/var/tmp/faims-couchdb-backup-metadata.json"

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
export GOMAXPROCS="${GOMAXPROCS:-1}"
export GOGC="${GOGC:-25}"
export GOMEMLIMIT="${GOMEMLIMIT:-512MiB}"

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

verify_couchdb_metadata() {
    local couchdb_node_name
    local membership
    local db_metadata
    local unexpected_nodes
    local node_url

    couchdb_node_name="$(sed -n 's/^-name[[:space:]]*//p' /opt/couchdb/etc/vm.args | head -1)"
    if [[ -z "$couchdb_node_name" ]]; then
        log_error "Could not determine CouchDB node name"
        return 1
    fi

    membership="$(curl -fsS --max-time 15 \
        -u "$COUCHDB_USER:$COUCHDB_PASSWORD" \
        http://127.0.0.1:5984/_membership)" || {
        log_error "Could not query CouchDB membership before backup"
        return 1
    }
    if ! jq -e --arg node "$couchdb_node_name" \
        '.cluster_nodes == [$node] and (.all_nodes | index($node) != null)' \
        <<<"$membership" >/dev/null; then
        log_error "CouchDB membership is inconsistent with the configured single node $couchdb_node_name"
        log_error "$membership"
        return 1
    fi

    node_url="http://127.0.0.1:5984/_node/$couchdb_node_name/_dbs"
    db_metadata="$(curl -fsS --max-time 30 \
        -u "$COUCHDB_USER:$COUCHDB_PASSWORD" \
        "$node_url/_all_docs?include_docs=true")" || {
        log_error "Could not query CouchDB shard metadata before backup"
        return 1
    }

    unexpected_nodes="$(jq -r --arg node "$couchdb_node_name" '
        [
            .rows[]?.doc
            | (
                (.by_node? // {} | keys[]),
                (.by_range? // {} | .[] | .[]),
                (.changelog? // [] | .[][2])
            )
        ]
        | unique
        | map(select(. != $node))
        | .[]
    ' <<<"$db_metadata")"
    if [[ -n "$unexpected_nodes" ]]; then
        log_error "CouchDB shard metadata references unexpected nodes:"
        log_error "$unexpected_nodes"
        log_error "Repair the database placement metadata before creating a backup"
        return 1
    fi

    log "Verified CouchDB membership and shard placement for $couchdb_node_name"
}

write_backup_metadata() {
    local backup_run_id=$1
    local couchdb_package_version
    local couchdb_node_name

    couchdb_package_version="$(dpkg-query -W -f='${Version}' couchdb)"
    couchdb_node_name="$(sed -n 's/^-name[[:space:]]*//p' /opt/couchdb/etc/vm.args | head -1)"
    if [[ -z "$couchdb_package_version" || -z "$couchdb_node_name" ]]; then
        log_error "Could not determine CouchDB package version or node name"
        return 1
    fi

    jq -n \
        --arg format_version "2" \
        --arg backup_run_id "$backup_run_id" \
        --arg created_at "$(date --iso-8601=seconds)" \
        --arg couchdb_package_version "$couchdb_package_version" \
        --arg couchdb_node_name "$couchdb_node_name" \
        '{
            formatVersion: $format_version,
            backupRunId: $backup_run_id,
            createdAt: $created_at,
            couchdbPackageVersion: $couchdb_package_version,
            couchdbNodeName: $couchdb_node_name
        }' > "$BACKUP_METADATA_FILE"
    chmod 0600 "$BACKUP_METADATA_FILE"
}

backup_secondary_indexes() {
    local backup_run_id=$1
    local start_time=$(date +%s)
    local current_date=$(date +%Y-%m-%d)
    local index_dir="$COUCHDB_DATA_DIR/.shards"

    if [[ ! -d "$index_dir" ]]; then
        log "No secondary index directory; skipping index snapshot"
        return 0
    fi

    if restic backup "$index_dir" "$BACKUP_METADATA_FILE" \
        --tag "$BACKUP_TAG" \
        --tag "secondary-indexes" \
        --tag "run:$backup_run_id" \
        --tag "$current_date" \
        --host "couchdb-indexes" \
        --verbose \
        2>&1 | tee -a "$LOG_FILE"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log "Secondary index backup succeeded in ${duration} seconds"
        return 0
    else
        log_error "Secondary index backup failed"
        return 1
    fi
}

backup_main_databases() {
    local backup_run_id=$1
    local start_time=$(date +%s)
    local current_date=$(date +%Y-%m-%d)

    if restic backup "$COUCHDB_DATA_DIR" "$BACKUP_METADATA_FILE" \
        --exclude="$COUCHDB_DATA_DIR/.shards" \
        --tag "$BACKUP_TAG" \
        --tag "main-databases" \
        --tag "run:$backup_run_id" \
        --tag "$current_date" \
        --host "couchdb-main" \
        --verbose \
        2>&1 | tee -a "$LOG_FILE"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log "Main database backup succeeded in ${duration} seconds"
        return 0
    else
        log_error "Main database backup failed"
        return 1
    fi
}

perform_backup() {
    local backup_run_id
    local overall_start
    local overall_end
    local total_duration

    backup_run_id="$(date -u +%Y%m%dT%H%M%SZ)-$(cat /proc/sys/kernel/random/uuid | tr -d '-' | cut -c1-8)"
    overall_start=$(date +%s)

    log "Starting live CouchDB backup"
    log "Target: $RESTIC_REPOSITORY"
    log "Run: $backup_run_id"
    log "Strategy: secondary indexes first, then main database files"

    if ! verify_couchdb_metadata; then
        return 1
    fi

    if ! write_backup_metadata "$backup_run_id"; then
        return 1
    fi
    trap 'rm -f "$BACKUP_METADATA_FILE"' EXIT INT TERM

    if ! backup_secondary_indexes "$backup_run_id"; then
        rm -f "$BACKUP_METADATA_FILE"
        trap - EXIT INT TERM
        return 1
    fi

    if ! backup_main_databases "$backup_run_id"; then
        rm -f "$BACKUP_METADATA_FILE"
        trap - EXIT INT TERM
        return 1
    fi
    rm -f "$BACKUP_METADATA_FILE"
    trap - EXIT INT TERM

    overall_end=$(date +%s)
    total_duration=$((overall_end - overall_start))
    log "Live backup completed in ${total_duration} seconds without stopping CouchDB"
}

apply_retention_policy() {
    log "Applying retention policy..."
    log "Keeping: $KEEP_DAILY daily, $KEEP_WEEKLY weekly, $KEEP_MONTHLY monthly"
    
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
    log "CouchDB Live Backup Script Started"
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
        send_notification "SUCCESS" "CouchDB live backup completed successfully. Check logs at $LOG_FILE"
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
