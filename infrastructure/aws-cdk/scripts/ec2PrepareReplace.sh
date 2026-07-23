#!/usr/bin/env bash
# Stop the Couch EC2 instance and detach its data volume so CDK can replace
# the instance and re-attach (avoids VolumeAttachment "already attached").
#
#   ./scripts/ec2PrepareReplace.sh
#
# Prerequisites: stack idle (e.g. UPDATE_ROLLBACK_COMPLETE), snapshot taken.
# After this: pnpm cdk deploy, then refresh EC2_INSTANCE_ID via
#   pnpm run couch-upgrade-baseline -- --instance-id
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

usage() {
  cat <<EOF
Usage: $0

  1. Stop EC2_INSTANCE_ID
  2. Detach the Couch data volume (EC2_DATA_DEVICE, default /dev/xvdf)
  3. Wait until the volume is available

Reads EC2_INSTANCE_ID (and optional AWS_REGION, EC2_DATA_DEVICE, EC2_VOLUME_ID)
from:
  ${ENV_FILE}

If the volume is already detached, set EC2_VOLUME_ID in .env.
EOF
  exit 1
}

load_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Missing ${ENV_FILE}. Copy scripts/.env.dist to scripts/.env and fill in values." >&2
    exit 1
  fi
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

  if [[ -n "${EC2_VOLUME_ID:-}" ]]; then
    echo "$EC2_VOLUME_ID"
    return
  fi

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
    volume_id="$(jq -r '
        map(select(.DeviceName != "/dev/xvda" and .DeviceName != "/dev/sda1" and .Ebs.VolumeId != null))
        | if length == 1 then .[0].Ebs.VolumeId else empty end
      ' <<<"$mappings")"
  fi

  if [[ -z "$volume_id" ]]; then
    echo "Error: could not find data volume for device ${device} on ${instance_id}." >&2
    echo "If already detached, set EC2_VOLUME_ID in scripts/.env." >&2
    echo "Block devices:" >&2
    jq -r '.[] | "  \(.DeviceName) -> \(.Ebs.VolumeId // "?")"' <<<"$mappings" >&2
    exit 1
  fi

  echo "$volume_id"
}

volume_state() {
  local volume_id="$1"
  aws ec2 describe-volumes \
    --volume-ids "$volume_id" \
    "${REGION_ARGS[@]}" \
    --query 'Volumes[0].State' \
    --output text
}

instance_state() {
  local instance_id="$1"
  aws ec2 describe-instances \
    --instance-ids "$instance_id" \
    "${REGION_ARGS[@]}" \
    --query 'Reservations[0].Instances[0].State.Name' \
    --output text
}

main() {
  if [[ $# -gt 0 ]]; then
    case "$1" in
      -h | --help | help) usage ;;
      *)
        echo "Unknown argument: $1" >&2
        usage
        ;;
    esac
  fi

  load_env
  init_region_args
  require_aws

  local instance_id="${EC2_INSTANCE_ID:-}"
  if [[ -z "$instance_id" ]]; then
    echo "Error: EC2_INSTANCE_ID is required in scripts/.env" >&2
    exit 1
  fi

  local volume_id
  volume_id="$(resolve_volume_id "$instance_id")"
  local istate vstate
  istate="$(instance_state "$instance_id")"
  vstate="$(volume_state "$volume_id")"

  echo "Instance:  ${instance_id} (${istate})"
  echo "Volume:    ${volume_id} (${vstate})"
  echo "Device:    ${EC2_DATA_DEVICE:-/dev/xvdf}"
  echo

  if [[ "$istate" != "stopped" ]]; then
    echo "Stopping instance..."
    aws ec2 stop-instances \
      --instance-ids "$instance_id" \
      "${REGION_ARGS[@]}" \
      --output text >/dev/null
    aws ec2 wait instance-stopped \
      --instance-ids "$instance_id" \
      "${REGION_ARGS[@]}"
    echo "Instance:  stopped"
  else
    echo "Instance already stopped."
  fi

  vstate="$(volume_state "$volume_id")"
  if [[ "$vstate" == "available" ]]; then
    echo "Volume already available (detached)."
  else
    echo "Detaching volume..."
    aws ec2 detach-volume \
      --volume-id "$volume_id" \
      "${REGION_ARGS[@]}" \
      --output text >/dev/null
    aws ec2 wait volume-available \
      --volume-ids "$volume_id" \
      "${REGION_ARGS[@]}"
    echo "Volume:    available"
  fi

  cat <<EOF

Ready for instance replace. Next:

  pnpm cdk deploy

Then refresh EC2_INSTANCE_ID:

  pnpm run couch-upgrade-baseline -- --instance-id
EOF
}

main "$@"
