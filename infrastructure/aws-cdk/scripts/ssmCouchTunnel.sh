#!/usr/bin/env bash
# SSM port-forward CouchDB :5984 from the stack's Couch EC2 instance to localhost.
#
#   ./scripts/ssmCouchTunnel.sh [-r|--region <region>] [-l|--local-port <port>]
#
# Reads STACK_NAME (and optional AWS_REGION / EC2_INSTANCE_ID) from scripts/.env.
# Leave running, then point local API scripts at the tunnel:
#   COUCHDB_INTERNAL_URL=http://127.0.0.1:5984
#
# Requires: aws CLI, session-manager-plugin, credentials that can SSM to the instance.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

usage() {
  cat <<EOF
Usage: $0 [-r|--region <region>] [-l|--local-port <port>]

  Resolve the CouchDB EC2 instance from STACK_NAME in scripts/.env and start
  an SSM port-forward of remote :5984 to localhost (default local port 5984).

Reads STACK_NAME (and optional AWS_REGION, EC2_INSTANCE_ID) from:
  ${ENV_FILE}

Examples:
  $0
  $0 -r ap-southeast-2 -l 15984
EOF
  exit 1
}

load_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Missing ${ENV_FILE}. Copy scripts/.env.dist to scripts/.env and set STACK_NAME." >&2
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

AWS_REGION_ARG=""
LOCAL_PORT="5984"
REMOTE_PORT="5984"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h | --help | help) usage ;;
    -r | --region)
      [[ $# -ge 2 ]] || usage
      AWS_REGION_ARG="$2"
      shift 2
      ;;
    -l | --local-port)
      [[ $# -ge 2 ]] || usage
      LOCAL_PORT="$2"
      shift 2
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage
      ;;
    *)
      echo "Unexpected argument: $1 (stack name comes from scripts/.env STACK_NAME)" >&2
      usage
      ;;
  esac
done

load_env

STACK_NAME="${STACK_NAME:-}"
if [[ -z "$STACK_NAME" ]]; then
  echo "Error: STACK_NAME is required in ${ENV_FILE}" >&2
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "Error: aws CLI is required." >&2
  exit 1
fi
if ! command -v session-manager-plugin >/dev/null 2>&1; then
  echo "Error: session-manager-plugin is required (AWS SSM Session Manager plugin)." >&2
  exit 1
fi

REGION_ARGS=()
if [[ -n "$AWS_REGION_ARG" ]]; then
  REGION_ARGS=(--region "$AWS_REGION_ARG")
elif [[ -n "${AWS_REGION:-${AWS_DEFAULT_REGION:-}}" ]]; then
  REGION_ARGS=(--region "${AWS_REGION:-$AWS_DEFAULT_REGION}")
fi

if ! err="$(aws sts get-caller-identity "${REGION_ARGS[@]}" 2>&1)"; then
  echo "Error: aws sts get-caller-identity failed." >&2
  echo "$err" >&2
  exit 1
fi

echo "Stack:       ${STACK_NAME}"

INSTANCE_ID="${EC2_INSTANCE_ID:-}"
# Ignore placeholder from .env.dist
if [[ "$INSTANCE_ID" == "i-0123456789abcdef0" ]]; then
  INSTANCE_ID=""
fi

if [[ -z "$INSTANCE_ID" ]]; then
  echo "Looking up CouchDB EC2 instance..."
  INSTANCE_ID="$(aws cloudformation describe-stack-resources \
    --stack-name "$STACK_NAME" \
    "${REGION_ARGS[@]}" \
    --query "StackResources[?ResourceType=='AWS::EC2::Instance' && contains(LogicalResourceId, 'CouchDBInstance')].PhysicalResourceId | [0]" \
    --output text)"
fi

if [[ -z "$INSTANCE_ID" || "$INSTANCE_ID" == "None" ]]; then
  echo "Error: no CouchDB EC2 instance found in stack ${STACK_NAME}" >&2
  echo "(expected AWS::EC2::Instance with LogicalResourceId containing CouchDBInstance)." >&2
  echo "Set STACK_NAME correctly, or set EC2_INSTANCE_ID in scripts/.env." >&2
  exit 1
fi

echo "Instance:    ${INSTANCE_ID}"
echo "Forward:     localhost:${LOCAL_PORT} -> ${INSTANCE_ID}:${REMOTE_PORT}"
echo
echo "Leave this running. Point local env at the tunnel:"
echo "  # api/.env"
echo "  COUCHDB_INTERNAL_URL=http://127.0.0.1:${LOCAL_PORT}"
echo "  # infrastructure/aws-cdk/scripts/.env"
echo "  COUCH_URL=http://127.0.0.1:${LOCAL_PORT}"
echo

exec aws ssm start-session \
  --target "$INSTANCE_ID" \
  "${REGION_ARGS[@]}" \
  --document-name AWS-StartPortForwardingSession \
  --parameters "{\"portNumber\":[\"${REMOTE_PORT}\"],\"localPortNumber\":[\"${LOCAL_PORT}\"]}"
