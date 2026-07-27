#!/usr/bin/env bash
# Snapshot the CouchDB data EBS volume for the instance in scripts/.env.
#
#   ./scripts/ec2Snapshot.sh list
#   ./scripts/ec2Snapshot.sh create
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

usage() {
  cat <<EOF
Usage: $0 list|create

  list    List recent snapshots for the Couch data volume
  create  Create a new snapshot and wait until completed

Reads EC2_INSTANCE_ID (and optional AWS_REGION, EC2_DATA_DEVICE) from:
  ${ENV_FILE}
EOF
  exit 1
}

load_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Missing ${ENV_FILE}. Copy scripts/.env.dist to scripts/.env and fill in values." >&2
    exit 1
  fi
  # Parse KEY=VALUE; skip blank values so e.g. AWS_REGION= does not clobber
  # a region already set in the shell / AWS config.
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line#"${line%%[![:space:]]*}"}"
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" != *=* ]] && continue
    local key="${line%%=*}"
    local value="${line#*=}"
    key="${key%"${key##*[![:space:]]}"}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    if [[ "${value}" =~ ^\".*\"$ || "${value}" =~ ^\'.*\'$ ]]; then
      value="${value:1:${#value}-2}"
    fi
    [[ -z "$value" ]] && continue
    # Do not overwrite vars already set in the calling environment
    if [[ -z "${!key+x}" ]]; then
      export "$key=$value"
    fi
  done <"$ENV_FILE"
}

require_aws() {
  if ! command -v aws >/dev/null 2>&1; then
    echo "Error: aws CLI is required." >&2
    exit 1
  fi
  if ! command -v jq >/dev/null 2>&1; then
    echo "Error: jq is required." >&2
    exit 1
  fi
  local err
  if ! err="$(aws sts get-caller-identity 2>&1)"; then
    echo "Error: aws sts get-caller-identity failed." >&2
    echo "$err" >&2
    exit 1
  fi
}

# Populated after load_env
REGION_ARGS=()

init_region_args() {
  local region="${AWS_REGION:-${AWS_DEFAULT_REGION:-}}"
  REGION_ARGS=()
  if [[ -n "$region" ]]; then
    REGION_ARGS=(--region "$region")
  fi
}

resolve_volume_id() {
  local instance_id="$1"
  local device="${EC2_DATA_DEVICE:-/dev/xvdf}"

  local mappings
  mappings="$(aws ec2 describe-instances \
    --instance-ids "$instance_id" \
    "${REGION_ARGS[@]}" \
    --query 'Reservations[0].Instances[0].BlockDeviceMappings' \
    --output json)"

  if [[ "$mappings" == "null" || "$mappings" == "[]" ]]; then
    echo "Error: instance ${instance_id} not found (check ID / region / credentials)." >&2
    exit 1
  fi

  local volume_id
  volume_id="$(jq -r --arg d "$device" '
      map(select(.DeviceName == $d or .DeviceName == ($d | ltrimstr("/dev/"))))
      | .[0].Ebs.VolumeId // empty
    ' <<<"$mappings")"

  if [[ -z "$volume_id" ]]; then
    # Fallback: non-root attached volume (expect exactly one data volume)
    volume_id="$(jq -r '
        map(select(.DeviceName != "/dev/xvda" and .DeviceName != "/dev/sda1" and .Ebs.VolumeId != null))
        | if length == 1 then .[0].Ebs.VolumeId else empty end
      ' <<<"$mappings")"
  fi

  if [[ -z "$volume_id" ]]; then
    echo "Error: could not find data volume for device ${device} on ${instance_id}." >&2
    echo "Block devices:" >&2
    jq -r '.[] | "  \(.DeviceName) -> \(.Ebs.VolumeId // "?")"' <<<"$mappings" >&2
    exit 1
  fi

  echo "$volume_id"
}

cmd_list() {
  local instance_id="$1"
  local volume_id
  volume_id="$(resolve_volume_id "$instance_id")"

  echo "Instance:  ${instance_id}"
  echo "Volume:    ${volume_id}"
  echo "Device:    ${EC2_DATA_DEVICE:-/dev/xvdf}"
  echo
  aws ec2 describe-snapshots \
    --owner-ids self \
    --filters "Name=volume-id,Values=${volume_id}" \
    "${REGION_ARGS[@]}" \
    --query 'sort_by(Snapshots, &StartTime) | reverse(@) | [0:20].{SnapshotId:SnapshotId,StartTime:StartTime,State:State,Progress:Progress,Description:Description}' \
    --output table
}

cmd_create() {
  local instance_id="$1"
  local volume_id
  volume_id="$(resolve_volume_id "$instance_id")"
  local ts description snapshot_id
  ts="$(date -u +%Y%m%dT%H%M%SZ)"
  description="pre-couch-upgrade ${ts} ${instance_id} ${volume_id}"

  echo "Instance:    ${instance_id}"
  echo "Volume:      ${volume_id}"
  echo "Description: ${description}"

  snapshot_id="$(aws ec2 create-snapshot \
    --volume-id "$volume_id" \
    --description "$description" \
    --tag-specifications "ResourceType=snapshot,Tags=[{Key=Name,Value=pre-couch-upgrade},{Key=InstanceId,Value=${instance_id}},{Key=VolumeId,Value=${volume_id}}]" \
    "${REGION_ARGS[@]}" \
    --query 'SnapshotId' \
    --output text)"

  echo "SnapshotId:  ${snapshot_id}"
  echo "Waiting for completed..."
  aws ec2 wait snapshot-completed --snapshot-ids "$snapshot_id" "${REGION_ARGS[@]}"
  echo "State:       completed"
  echo "$snapshot_id"
}

main() {
  [[ $# -ge 1 ]] || usage
  local cmd="$1"

  load_env
  init_region_args
  require_aws

  local instance_id="${EC2_INSTANCE_ID:-}"
  if [[ -z "$instance_id" ]]; then
    echo "Error: EC2_INSTANCE_ID is required in scripts/.env" >&2
    exit 1
  fi

  case "$cmd" in
    list) cmd_list "$instance_id" ;;
    create) cmd_create "$instance_id" ;;
    -h | --help | help) usage ;;
    *)
      echo "Unknown command: ${cmd}" >&2
      usage
      ;;
  esac
}

main "$@"
