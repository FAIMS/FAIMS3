#!/usr/bin/env bash
# Build an api/.env file from a deployed FAIMS CDK stack (Conductor ECS task definition).
#
# Discovers the Conductor task definition via CloudFormation, copies plain environment
# variables, and resolves Secrets Manager (and SSM) references from the task secrets block.
#
# Usage:
#   ./scripts/env-from-cdk-stack.sh <stack-name> [--region REGION] [-o OUTPUT]
#
# Examples:
#   ./scripts/env-from-cdk-stack.sh my-faims-stack
#   ./scripts/env-from-cdk-stack.sh my-faims-stack -o .env -r ap-southeast-2
#
# Requires: aws CLI v2, jq, and IAM permission to describe the stack, ECS task definition,
# and read the secrets referenced by the task.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

usage() {
  sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

STACK_NAME=""
OUTPUT_FILE="${API_DIR}/.env.cdk-export"
AWS_REGION="${AWS_REGION:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage 0
      ;;
    -r|--region)
      AWS_REGION="$2"
      shift 2
      ;;
    -o|--output)
      OUTPUT_FILE="$2"
      shift 2
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage 1
      ;;
    *)
      if [[ -z "$STACK_NAME" ]]; then
        STACK_NAME="$1"
      else
        echo "Unexpected argument: $1" >&2
        usage 1
      fi
      shift
      ;;
  esac
done

if [[ -z "$STACK_NAME" ]]; then
  echo "Error: CDK stack name is required." >&2
  echo "" >&2
  usage 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "Error: aws CLI is not installed." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is not installed." >&2
  exit 1
fi

if [[ -z "$AWS_REGION" ]]; then
  AWS_REGION="$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].StackRegion' \
    --output text 2>/dev/null || true)"
  if [[ -z "$AWS_REGION" || "$AWS_REGION" == "None" ]]; then
    echo "Error: could not determine region; set AWS_REGION or pass --region." >&2
    exit 1
  fi
fi

echo "Stack:  ${STACK_NAME}" >&2
echo "Region: ${AWS_REGION}" >&2

TASK_DEF_ID="$(aws cloudformation describe-stack-resources \
  --stack-name "$STACK_NAME" \
  --region "$AWS_REGION" \
  --query "StackResources[?ResourceType=='AWS::ECS::TaskDefinition' && (contains(LogicalResourceId, 'conductor') || contains(LogicalResourceId, 'Conductor'))].PhysicalResourceId | [0]" \
  --output text)"

if [[ -z "$TASK_DEF_ID" || "$TASK_DEF_ID" == "None" ]]; then
  echo "Error: no Conductor ECS task definition found in stack ${STACK_NAME}." >&2
  echo "Looked for AWS::ECS::TaskDefinition with LogicalResourceId containing 'conductor'." >&2
  exit 1
fi

echo "Task definition: ${TASK_DEF_ID}" >&2

TASK_JSON="$(aws ecs describe-task-definition \
  --task-definition "$TASK_DEF_ID" \
  --region "$AWS_REGION" \
  --query 'taskDefinition' \
  --output json)"

CONTAINER_JSON="$(jq -c '
  .containerDefinitions as $defs
  | ($defs | map(select(.name | test("conductor"; "i")))) as $match
  | if ($match | length) > 0 then $match[0] else $defs[0] end
' <<<"$TASK_JSON")"

if [[ "$CONTAINER_JSON" == "null" ]]; then
  echo "Error: task definition has no container definitions." >&2
  exit 1
fi

CONTAINER_NAME="$(jq -r '.name' <<<"$CONTAINER_JSON")"
echo "Container:       ${CONTAINER_NAME}" >&2

# --- Resolve Secrets Manager / SSM secret references ---
resolve_secret_value() {
  local value_from="$1"
  local secret_id="" json_key=""

  value_from="${value_from%::}"

  if [[ "$value_from" == arn:aws:secretsmanager:* ]]; then
    if [[ "$value_from" =~ ^(arn:aws:secretsmanager:[^:]+:[^:]+:secret:[^:]+):([^:]+)$ ]]; then
      secret_id="${BASH_REMATCH[1]}"
      json_key="${BASH_REMATCH[2]}"
    else
      secret_id="$value_from"
    fi

    local raw
    raw="$(aws secretsmanager get-secret-value \
      --secret-id "$secret_id" \
      --region "$AWS_REGION" \
      --query SecretString \
      --output text 2>/dev/null)" || {
      echo "Error: failed to read secret ${secret_id}" >&2
      return 1
    }

    if [[ -n "$json_key" ]]; then
      local extracted
      extracted="$(jq -r --arg k "$json_key" '
        if type == "object" then (.[$k] // empty | if . == null then empty else tostring end)
        else empty
        end
      ' <<<"$raw" 2>/dev/null || true)"
      if [[ -z "$extracted" ]]; then
        echo "Error: secret ${secret_id} has no JSON key '${json_key}'" >&2
        return 1
      fi
      printf '%s' "$extracted"
    else
      printf '%s' "$raw"
    fi
    return 0
  fi

  if [[ "$value_from" == arn:aws:ssm:* ]]; then
    aws ssm get-parameter \
      --name "$value_from" \
      --with-decryption \
      --region "$AWS_REGION" \
      --query Parameter.Value \
      --output text 2>/dev/null || {
      echo "Error: failed to read SSM parameter ${value_from}" >&2
      return 1
    }
    return 0
  fi

  echo "Error: unsupported secret reference: ${value_from}" >&2
  return 1
}

# Escape a value for a double-quoted .env line (see api/.env.dist SAML PEM convention).
escape_env_value() {
  local v="$1"
  v="${v//\\/\\\\}"
  v="${v//$'\n'/\\n}"
  v="${v//$'\r'/}"
  v="${v//\"/\\\"}"
  printf '%s' "$v"
}

# Write a single KEY=VALUE line (must be exactly one line in the output file).
emit_env_line() {
  local key="$1"
  local value="$2"
  local force_quote="${3:-0}"
  local quote=$force_quote

  if [[ "$value" == *$'\n'* || "$value" == *$'\r'* ]]; then
    quote=1
  fi
  [[ "$value" =~ [[:space:]#] ]] && quote=1
  [[ "$value" == *\"* ]] && quote=1
  [[ "$value" == *\'* ]] && quote=1
  [[ "$value" == *'$'* ]] && quote=1

  if ((quote)); then
    printf '%s="%s"\n' "$key" "$(escape_env_value "$value")"
  else
    printf '%s=%s\n' "$key" "$value"
  fi
}

TMP_ENV="$(mktemp)"
trap 'rm -f "$TMP_ENV"' EXIT

# Plain environment variables from the task definition
while IFS=$'\t' read -r key value; do
  [[ -z "$key" ]] && continue
  emit_env_line "$key" "$value" >>"$TMP_ENV"
done < <(jq -r '.environment[]? | [.name, .value] | @tsv' <<<"$CONTAINER_JSON")

# Secrets (name -> resolved value)
SECRET_COUNT="$(jq '.secrets | length' <<<"$CONTAINER_JSON")"
if [[ "$SECRET_COUNT" != "0" && "$SECRET_COUNT" != "null" ]]; then
  while IFS=$'\t' read -r name value_from; do
    [[ -z "$name" ]] && continue
    echo "Resolving secret ${name}…" >&2
    # Use printf/read pattern so PEM values keep internal newlines (not stripped by $( )).
    value="$(resolve_secret_value "$value_from")" || exit 1
    emit_env_line "$name" "$value" 1 >>"$TMP_ENV"
  done < <(jq -r '.secrets[]? | [.name, .valueFrom] | @tsv' <<<"$CONTAINER_JSON")
fi

# Derived values useful for local tooling (not always set on ECS)
if ! grep -q '^CONDUCTOR_INTERNAL_PORT=' "$TMP_ENV" 2>/dev/null; then
  internal_port="$(jq -r '.portMappings[0].containerPort // 8000' <<<"$CONTAINER_JSON")"
  emit_env_line "CONDUCTOR_INTERNAL_PORT" "$internal_port" >>"$TMP_ENV"
fi

if ! grep -q '^CONDUCTOR_EXTERNAL_PORT=' "$TMP_ENV" 2>/dev/null; then
  emit_env_line "CONDUCTOR_EXTERNAL_PORT" "$(grep '^CONDUCTOR_INTERNAL_PORT=' "$TMP_ENV" | cut -d= -f2- | tr -d '"')" >>"$TMP_ENV"
fi

if ! grep -q '^KEY_FILE_PATH=' "$TMP_ENV" 2>/dev/null; then
  emit_env_line "KEY_FILE_PATH" "." >>"$TMP_ENV"
fi

# AWS SDK (migrate-with-keys / KEY_SOURCE=AWS_SM) needs a region in the env file.
if ! grep -q '^AWS_DEFAULT_REGION=' "$TMP_ENV" 2>/dev/null; then
  emit_env_line "AWS_DEFAULT_REGION" "$AWS_REGION" >>"$TMP_ENV"
fi
if ! grep -q '^AWS_REGION=' "$TMP_ENV" 2>/dev/null; then
  emit_env_line "AWS_REGION" "$AWS_REGION" >>"$TMP_ENV"
fi

{
  echo "# Generated by api/scripts/env-from-cdk-stack.sh"
  echo "# Stack: ${STACK_NAME} (${AWS_REGION})"
  echo "# Task definition: ${TASK_DEF_ID}"
  echo "# Container: ${CONTAINER_NAME}"
  echo "# Generated at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "#"
  echo "# Review before use. For local Node/scripts against AWS CouchDB you may need:"
  echo "#   - COUCHDB_INTERNAL_URL → VPN/tunnel URL (public URL is often in this file)"
  echo "#   - KEY_SOURCE=file and local keys under KEY_FILE_PATH (ECS uses AWS_SM)"
  echo "#   - PEM secrets use \\n for line breaks (same as api/.env.dist)"
  echo "#   - AWS_DEFAULT_REGION is set for Secrets Manager / AWS SDK local runs"
  echo "#"
  # Only sort KEY= lines; ignore any accidental non-assignments.
  grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$TMP_ENV" | LC_ALL=C sort -t= -k1,1
} >"$OUTPUT_FILE"

echo "" >&2
echo "Wrote $(wc -l <"$OUTPUT_FILE") lines to ${OUTPUT_FILE}" >&2
echo "Merge into .env after review: cp ${OUTPUT_FILE} .env" >&2
