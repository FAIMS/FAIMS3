#!/bin/bash

# CouchDB Restore Script using Restic from Digital Ocean Spaces
# This script restores CouchDB data from restic backups
# Restores secondary indexes BEFORE main database files (same order as backup)

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
# CONFIGURATION
#############################################

# Restic repository path
RESTIC_REPOSITORY="s3:${DO_SPACES_ENDPOINT}/${DO_SPACES_BUCKET}/couchdb-restic"

# Default restore target (can be overridden with --target)
DEFAULT_RESTORE_TARGET="/tmp/couchdb-restore-$(date +%Y%m%d-%H%M%S)"

# Backup metadata
BACKUP_TAG="${BACKUP_TAG:-couchdb-production}"
LOG_DIR="${LOG_DIR:-/var/log/couchdb-backup}"
LOG_FILE="${LOG_DIR}/restore-$(date +%Y%m%d-%H%M%S).log"

# CouchDB service name (for stopping/starting)
COUCHDB_SERVICE="${COUCHDB_SERVICE:-couchdb}"

# CouchDB user/group for setting permissions
COUCHDB_USER="${COUCHDB_USER:-couchdb}"
COUCHDB_GROUP="${COUCHDB_GROUP:-couchdb}"

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
# COMMAND LINE ARGUMENTS
#############################################

RESTORE_TARGET=""
SNAPSHOT_ID=""
USE_LATEST=false
LIST_ONLY=false
RESTORE_TO_LIVE=false
STOP_COUCHDB=false
START_COUCHDB=false
FORCE=false

show_usage() {
    cat << EOF
CouchDB Restore Script

Usage: $0 [OPTIONS]

Options:
    --list                  List available backups and exit
    --latest               Restore from latest backup
    --snapshot ID          Restore from specific snapshot ID
    --date YYYY-MM-DD      Restore from backups on specific date
    --target PATH          Restore to specific directory (default: temp directory)
    --live                 Restore directly to live CouchDB data directory
    --stop-couchdb         Stop CouchDB before restore (automatic with --live)
    --start-couchdb        Start CouchDB after restore (automatic with --live)
    --force                Skip confirmation prompts
    --help                 Show this help message

Examples:
    # List available backups
    $0 --list

    # Restore latest backup to temporary directory (safe)
    $0 --latest

    # Restore specific snapshot to temporary directory
    $0 --snapshot abc123def456

    # Restore latest backup to live directory (DANGEROUS - stops CouchDB)
    $0 --latest --live

    # Restore from specific date to custom location
    $0 --date 2025-11-15 --target /restore/test

EOF
}

#############################################
# PARSE COMMAND LINE ARGUMENTS
#############################################

while [[ $# -gt 0 ]]; do
    case $1 in
        --list)
            LIST_ONLY=true
            shift
            ;;
        --latest)
            USE_LATEST=true
            shift
            ;;
        --snapshot)
            SNAPSHOT_ID="$2"
            shift 2
            ;;
        --date)
            SNAPSHOT_DATE="$2"
            shift 2
            ;;
        --target)
            RESTORE_TARGET="$2"
            shift 2
            ;;
        --live)
            RESTORE_TO_LIVE=true
            STOP_COUCHDB=true
            START_COUCHDB=true
            shift
            ;;
        --stop-couchdb)
            STOP_COUCHDB=true
            shift
            ;;
        --start-couchdb)
            START_COUCHDB=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            echo "ERROR: Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

#############################################
# LOGGING FUNCTIONS
#############################################

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE" >&2
}

log_error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $*" | tee -a "$LOG_FILE" >&2
}

log_warning() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $*" | tee -a "$LOG_FILE" >&2
}

#############################################
# UTILITY FUNCTIONS
#############################################

check_prerequisites() {
    if ! command -v restic &> /dev/null; then
        log_error "restic is not installed. Install with: apt-get install restic"
        exit 1
    fi
    
    # Check if repository is accessible
    if ! restic snapshots &>/dev/null; then
        log_error "Cannot access restic repository at $RESTIC_REPOSITORY"
        log_error "Check your credentials and network connection"
        exit 1
    fi
}

confirm_action() {
    local message=$1
    
    if [[ "$FORCE" == "true" ]]; then
        return 0
    fi
    
    echo ""
    echo "WARNING: $message"
    read -p "Are you sure you want to continue? (yes/no): " -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log "Operation cancelled by user"
        exit 0
    fi
}

#############################################
# LISTING FUNCTIONS
#############################################

list_backups() {
    log "=========================================="
    log "Available CouchDB Backups"
    log "=========================================="
    log ""
    
    log "Secondary Index Snapshots:"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    restic snapshots --tag "secondary-indexes" --host "couchdb-indexes" --compact
    
    log ""
    log "Main Database Snapshots:"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    restic snapshots --tag "main-databases" --host "couchdb-main" --compact
    
    log ""
    log "Repository Statistics:"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    restic stats --mode raw-data
}

find_snapshot_pair() {
    local index_snapshot=""
    local database_snapshot=""
    
    log "Searching for matching snapshot pair..."
    
    # Find index snapshot
    if [[ "$USE_LATEST" == "true" ]]; then
        # Get the LAST snapshot (newest) - restic sorts by time, oldest first
        index_snapshot=$(restic snapshots --tag "secondary-indexes" --host "couchdb-indexes" --json | jq -r 'sort_by(.time) | .[-1].short_id')
    elif [[ -n "${SNAPSHOT_DATE:-}" ]]; then
        # Get the LAST snapshot from that date
        index_snapshot=$(restic snapshots --tag "secondary-indexes" --host "couchdb-indexes" --tag "$SNAPSHOT_DATE" --json | jq -r 'sort_by(.time) | .[-1].short_id')
    elif [[ -n "$SNAPSHOT_ID" ]]; then
        # Verify if this is an index or database snapshot
        local snapshot_info=$(restic snapshots "$SNAPSHOT_ID" --json 2>/dev/null || echo "[]")
        local snapshot_host=$(echo "$snapshot_info" | jq -r '.[0].hostname // empty')
        
        if [[ "$snapshot_host" == "couchdb-indexes" ]]; then
            index_snapshot="$SNAPSHOT_ID"
            # Find corresponding database snapshot with similar time
            local snapshot_time=$(echo "$snapshot_info" | jq -r '.[0].time')
            database_snapshot=$(restic snapshots --tag "main-databases" --host "couchdb-main" --json | \
                jq -r --arg time "$snapshot_time" 'map(select(.time >= $time)) | sort_by(.time) | .[0].short_id')
        else
            database_snapshot="$SNAPSHOT_ID"
            # Find corresponding index snapshot with earlier time
            local snapshot_time=$(echo "$snapshot_info" | jq -r '.[0].time')
            index_snapshot=$(restic snapshots --tag "secondary-indexes" --host "couchdb-indexes" --json | \
                jq -r --arg time "$snapshot_time" 'map(select(.time <= $time)) | sort_by(.time) | .[-1].short_id')
        fi
    fi
    
    # If we found index, find matching database snapshot
    if [[ -n "$index_snapshot" ]] && [[ -z "$database_snapshot" ]]; then
        local index_time=$(restic snapshots "$index_snapshot" --json | jq -r '.[0].time')
        database_snapshot=$(restic snapshots --tag "main-databases" --host "couchdb-main" --json | \
            jq -r --arg time "$index_time" 'map(select(.time >= $time)) | sort_by(.time) | .[0].short_id')
    fi
    
    # Check for null or empty values
    if [[ "$index_snapshot" == "null" ]] || [[ -z "$index_snapshot" ]]; then
        log_error "Could not find index snapshot"
        return 1
    fi
    
    if [[ "$database_snapshot" == "null" ]] || [[ -z "$database_snapshot" ]]; then
        log_error "Could not find database snapshot"
        return 1
    fi
    
    log "Found snapshot pair:"
    log "  Secondary indexes: $index_snapshot"
    log "  Main databases:    $database_snapshot"
    
    echo "$index_snapshot $database_snapshot"
}

#############################################
# COUCHDB CONTROL FUNCTIONS
#############################################

stop_couchdb_service() {
    log "Stopping CouchDB service..."
    
    if systemctl is-active --quiet "$COUCHDB_SERVICE"; then
        if sudo systemctl stop "$COUCHDB_SERVICE"; then
            log "CouchDB service stopped"
            sleep 2  # Give it time to fully stop
            return 0
        else
            log_error "Failed to stop CouchDB service"
            return 1
        fi
    else
        log "CouchDB service is not running"
        return 0
    fi
}

start_couchdb_service() {
    log "Starting CouchDB service..."
    
    if ! systemctl is-active --quiet "$COUCHDB_SERVICE"; then
        if sudo systemctl start "$COUCHDB_SERVICE"; then
            log "CouchDB service started"
            sleep 5  # Give it time to start
            return 0
        else
            log_error "Failed to start CouchDB service"
            return 1
        fi
    else
        log "CouchDB service is already running"
        return 0
    fi
}

#############################################
# RESTORE FUNCTIONS
#############################################

restore_secondary_indexes() {
    local snapshot_id=$1
    local target=$2
    
    log "=== Phase 1: Restoring secondary indexes (.shards) ==="
    log "Snapshot: $snapshot_id"
    log "Target: $target"
    
    local start_time=$(date +%s)
    
    # Create target directory
    mkdir -p "$target"
    
    if restic restore "$snapshot_id" \
        --target "$target" \
        --verbose \
        2>&1 | tee -a "$LOG_FILE"; then
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log "Secondary indexes restored successfully in ${duration} seconds"
        return 0
    else
        log_error "Secondary index restore failed"
        return 1
    fi
}

restore_main_databases() {
    local snapshot_id=$1
    local target=$2
    
    log "=== Phase 2: Restoring main database files ==="
    log "Snapshot: $snapshot_id"
    log "Target: $target"
    
    local start_time=$(date +%s)
    
    # Create target directory
    mkdir -p "$target"
    
    if restic restore "$snapshot_id" \
        --target "$target" \
        --verbose \
        2>&1 | tee -a "$LOG_FILE"; then
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log "Main databases restored successfully in ${duration} seconds"
        return 0
    else
        log_error "Main database restore failed"
        return 1
    fi
}

fix_permissions() {
    local target=$1
    
    log "Setting correct file permissions and ownership..."
    
    # Get the actual data directory path within restore
    local data_dir=$(find "$target" -type d -name "data" | head -1)
    
    if [[ -z "$data_dir" ]]; then
        # If no 'data' subdir, the target itself is the data directory
        data_dir="$target"
    fi
    
    log "Adjusting permissions on: $data_dir"
    
    # Set ownership
    if sudo chown -R "$COUCHDB_USER:$COUCHDB_GROUP" "$data_dir" 2>&1 | tee -a "$LOG_FILE"; then
        log "Ownership set to $COUCHDB_USER:$COUCHDB_GROUP"
    else
        log_warning "Could not set ownership (you may need to run with sudo)"
    fi
    
    # Set permissions
    sudo chmod -R 0770 "$data_dir" 2>&1 | tee -a "$LOG_FILE"
    
    log "Permissions corrected"
}

verify_restored_data() {
    local target=$1
    
    log "Verifying restored data..."
    
    # Find the actual data directory
    local data_dir=$(find "$target" -type d -name "data" | head -1)
    if [[ -z "$data_dir" ]]; then
        data_dir="$target"
    fi
    
    # Count restored files
    local couch_files=$(find "$data_dir" -name "*.couch" 2>/dev/null | wc -l)
    log "Found $couch_files .couch files in restored data"
    
    if [[ $couch_files -eq 0 ]]; then
        log_error "No .couch files found in restored data"
        return 1
    fi
    
    # Check for main components
    local has_system_dbs=false
    local has_shards=false
    
    if [[ -f "$data_dir/_users.couch" ]]; then
        has_system_dbs=true
        log "✓ System databases found"
    fi
    
    if [[ -d "$data_dir/shards" ]]; then
        has_shards=true
        log "✓ Shard directory found"
    fi
    
    if [[ "$has_system_dbs" == "true" ]] || [[ "$has_shards" == "true" ]]; then
        log "Restored data appears valid"
        return 0
    else
        log_error "Restored data may be incomplete"
        return 1
    fi
}

move_to_live_directory() {
    local source=$1
    local backup_dir="${COUCHDB_DATA_DIR}.backup-$(date +%Y%m%d-%H%M%S)"
    
    log "Moving current data to backup location..."
    
    if [[ -d "$COUCHDB_DATA_DIR" ]]; then
        if sudo mv "$COUCHDB_DATA_DIR" "$backup_dir"; then
            log "Current data backed up to: $backup_dir"
        else
            log_error "Failed to backup current data"
            return 1
        fi
    fi
    
    log "Moving restored data to live location..."
    
    # Find the actual data directory in restore
    local restored_data=$(find "$source" -type d -name "data" | head -1)
    if [[ -z "$restored_data" ]]; then
        restored_data="$source"
    fi
    
    if sudo mv "$restored_data" "$COUCHDB_DATA_DIR"; then
        log "Restored data moved to: $COUCHDB_DATA_DIR"
        log "Previous data saved at: $backup_dir"
        return 0
    else
        log_error "Failed to move restored data"
        log "Attempting to restore original data..."
        sudo mv "$backup_dir" "$COUCHDB_DATA_DIR"
        return 1
    fi
}

#############################################
# MAIN EXECUTION
#############################################

main() {
    log "=========================================="
    log "CouchDB Restore Script Started"
    log "=========================================="
    log "Configuration loaded from: $ENV_FILE"
    log ""
    
    # Check prerequisites
    check_prerequisites
    
    # Handle --list flag
    if [[ "$LIST_ONLY" == "true" ]]; then
        list_backups
        exit 0
    fi
    
    # Validate restore options
    if [[ "$USE_LATEST" == "false" ]] && [[ -z "$SNAPSHOT_ID" ]] && [[ -z "${SNAPSHOT_DATE:-}" ]]; then
        log_error "Must specify --latest, --snapshot, or --date"
        show_usage
        exit 1
    fi
    
    # Find snapshot pair
    read -r index_snapshot database_snapshot < <(find_snapshot_pair)
    
    if [[ -z "$index_snapshot" ]] || [[ -z "$database_snapshot" ]]; then
        log_error "Failed to find valid snapshot pair"
        exit 1
    fi
    
    log ""
    
    # Determine restore target
    if [[ "$RESTORE_TO_LIVE" == "true" ]]; then
        RESTORE_TARGET="$DEFAULT_RESTORE_TARGET"
        confirm_action "This will STOP CouchDB and REPLACE live data!"
    elif [[ -z "$RESTORE_TARGET" ]]; then
        RESTORE_TARGET="$DEFAULT_RESTORE_TARGET"
        log "No target specified, using temporary directory: $RESTORE_TARGET"
    fi
    
    log "Restore target: $RESTORE_TARGET"
    log ""
    
    # Stop CouchDB if requested
    if [[ "$STOP_COUCHDB" == "true" ]]; then
        if ! stop_couchdb_service; then
            log_error "Failed to stop CouchDB"
            exit 1
        fi
        log ""
    fi
    
    # Perform restore
    local overall_start=$(date +%s)
    local restore_status=0
    
    # Phase 1: Restore secondary indexes
    if ! restore_secondary_indexes "$index_snapshot" "$RESTORE_TARGET"; then
        log_error "Phase 1 restore failed"
        restore_status=1
    fi
    
    log ""
    
    # Phase 2: Restore main databases
    if [[ $restore_status -eq 0 ]]; then
        if ! restore_main_databases "$database_snapshot" "$RESTORE_TARGET"; then
            log_error "Phase 2 restore failed"
            restore_status=1
        fi
    fi
    
    local overall_end=$(date +%s)
    local total_duration=$((overall_end - overall_start))
    
    log ""
    log "=== Restore Complete ==="
    log "Total restore time: ${total_duration} seconds"
    log ""
    
    # Verify restored data
    if [[ $restore_status -eq 0 ]]; then
        if ! verify_restored_data "$RESTORE_TARGET"; then
            log_warning "Data verification found issues"
            restore_status=1
        fi
    fi
    
    log ""
    
    # Fix permissions
    if [[ $restore_status -eq 0 ]]; then
        fix_permissions "$RESTORE_TARGET"
        log ""
    fi
    
    # Move to live directory if requested
    if [[ "$RESTORE_TO_LIVE" == "true" ]] && [[ $restore_status -eq 0 ]]; then
        if ! move_to_live_directory "$RESTORE_TARGET"; then
            log_error "Failed to move restored data to live directory"
            restore_status=1
        fi
        log ""
    fi
    
    # Start CouchDB if requested
    if [[ "$START_COUCHDB" == "true" ]] && [[ $restore_status -eq 0 ]]; then
        if ! start_couchdb_service; then
            log_error "Failed to start CouchDB"
            restore_status=1
        fi
        log ""
    fi
    
    # Final status
    log "=========================================="
    if [[ $restore_status -eq 0 ]]; then
        log "CouchDB Restore Completed Successfully"
        if [[ "$RESTORE_TO_LIVE" == "false" ]]; then
            log ""
            log "Restored data is available at: $RESTORE_TARGET"
            log "To use this data:"
            log "  1. Stop CouchDB: sudo systemctl stop $COUCHDB_SERVICE"
            log "  2. Backup current data: sudo mv $COUCHDB_DATA_DIR ${COUCHDB_DATA_DIR}.backup"
            log "  3. Move restored data: sudo mv $RESTORE_TARGET/data $COUCHDB_DATA_DIR"
            log "  4. Fix permissions: sudo chown -R $COUCHDB_USER:$COUCHDB_GROUP $COUCHDB_DATA_DIR"
            log "  5. Start CouchDB: sudo systemctl start $COUCHDB_SERVICE"
        fi
    else
        log "CouchDB Restore Completed with Errors"
        if [[ "$STOP_COUCHDB" == "true" ]]; then
            log_warning "CouchDB was stopped but restore failed - you may need to start it manually"
        fi
    fi
    log "=========================================="
    
    exit $restore_status
}

# Run main function
main "$@"