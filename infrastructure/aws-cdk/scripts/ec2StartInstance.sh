#!/usr/bin/env bash
# Start the Couch EC2 instance (e.g. after ec2PrepareReplace.sh + cdk deploy
# left it stopped with a new data volume attached).
#
#   ./scripts/ec2StartInstance.sh
#
# After this: wait for ALB Couch target healthy, then
#   pnpm run couch-upgrade-baseline --instance-id
#   cd api && pnpm run migrate-with-keys
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

usage() {
  cat <<EOF
Usage: $0

  Start EC2_INSTANCE_ID if stopped and wait until running.

Reads EC2_INSTANCE_ID (and optional AWS_REGION, STACK_NAME) from:
  ${ENV_FILE}

If EC2_INSTANCE_ID is missing or still the .env.dist placeholder, looks up the
Couch instance from STACK_NAME via CloudFormation.
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
  local err
  if ! err="$(aws sts get-caller-identity "${REGION_ARGS[@]}" 2>&1)"; then
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

instance_state() {
  local instance_id="$1"
  aws ec2 describe-instances \
    --instance-ids "$instance_id" \
    "${REGION_ARGS[@]}" \
    --query 'Reservations[0].Instances[0].State.Name' \
    --output text
}

resolve_instance_id() {
  local instance_id="${EC2_INSTANCE_ID:-}"
  if [[ -n "$instance_id" && "$instance_id" != "i-0123456789abcdef0" ]]; then
    echo "$instance_id"
    return
  fi

  local stack_name="${STACK_NAME:-}"
  if [[ -z "$stack_name" ]]; then
    echo "Error: EC2_INSTANCE_ID is missing/placeholder and STACK_NAME is unset in ${ENV_FILE}." >&2
    exit 1
  fi

  echo "Looking up CouchDB EC2 instance from STACK_NAME=${stack_name}..." >&2
  instance_id="$(aws cloudformation describe-stack-resources \
    --stack-name "$stack_name" \
    "${REGION_ARGS[@]}" \
    --query "StackResources[?ResourceType=='AWS::EC2::Instance' && contains(LogicalResourceId, 'CouchDBInstance')].PhysicalResourceId | [0]" \
    --output text)"

  if [[ -z "$instance_id" || "$instance_id" == "None" ]]; then
    echo "Error: no CouchDB EC2 instance found in stack ${stack_name}." >&2
    exit 1
  fi
  echo "$instance_id"
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

  local instance_id
  instance_id="$(resolve_instance_id)"
  local istate
  istate="$(instance_state "$instance_id")"

  echo "Instance:  ${instance_id} (${istate})"
  echo

  case "$istate" in
    running)
      echo "Instance already running."
      ;;
    pending)
      echo "Instance already starting; waiting until running..."
      aws ec2 wait instance-running \
        --instance-ids "$instance_id" \
        "${REGION_ARGS[@]}"
      echo "Instance:  running"
      ;;
    stopped | stopping)
      if [[ "$istate" == "stopping" ]]; then
        echo "Waiting for instance to finish stopping..."
        aws ec2 wait instance-stopped \
          --instance-ids "$instance_id" \
          "${REGION_ARGS[@]}"
      fi
      echo "Starting instance..."
      aws ec2 start-instances \
        --instance-ids "$instance_id" \
        "${REGION_ARGS[@]}" \
        --output text >/dev/null
      aws ec2 wait instance-running \
        --instance-ids "$instance_id" \
        "${REGION_ARGS[@]}"
      echo "Instance:  running"
      ;;
    *)
      echo "Error: instance is in state '${istate}'; expected stopped/running." >&2
      exit 1
      ;;
  esac

  cat <<EOF

Next:

  # Wait for ALB Couch target healthy, then:
  pnpm run couch-upgrade-baseline --instance-id
  cd ../../api && pnpm run migrate-with-keys
EOF
}

main "$@"
