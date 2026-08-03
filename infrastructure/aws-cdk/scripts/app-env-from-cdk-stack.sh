#!/usr/bin/env bash
# Build an app/.env file from a deployed FAIMS CDK stack (static app bundle).
#
# Discovers the FAIMS app S3 bucket via CloudFormation outputs, downloads the
# Vite-built JS asset, and extracts the build-time VITE_* values that were
# inlined into import.meta.env (same values used for the CDK app deployment).
#
# Usage (from infrastructure/aws-cdk):
#   ./scripts/app-env-from-cdk-stack.sh <stack-name> [--region REGION] [-o OUTPUT]
#
# Examples:
#   ./scripts/app-env-from-cdk-stack.sh my-faims-stack
#   ./scripts/app-env-from-cdk-stack.sh my-faims-stack -o ../../app/.env -r ap-southeast-2
#
# Requires: aws CLI v2, jq, node, and IAM permission to describe the stack and
# read objects from the FAIMS app S3 bucket.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
APP_DIR="${REPO_ROOT}/app"

usage() {
  sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

STACK_NAME=""
OUTPUT_FILE="${APP_DIR}/.env.cdk-export"
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

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is not installed." >&2
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

BUCKET_NAME="$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$AWS_REGION" \
  --query "Stacks[0].Outputs[?contains(OutputKey, 'FaimsBucketName')].OutputValue | [0]" \
  --output text)"

if [[ -z "$BUCKET_NAME" || "$BUCKET_NAME" == "None" ]]; then
  echo "Error: no FaimsBucketName CloudFormation output found in stack ${STACK_NAME}." >&2
  echo "Expected an output whose OutputKey contains 'FaimsBucketName'." >&2
  exit 1
fi

echo "App bucket:      ${BUCKET_NAME}" >&2

TMP_DIR="$(mktemp -d)"
TMP_ENV="$(mktemp)"
trap 'rm -rf "$TMP_DIR"; rm -f "$TMP_ENV"' EXIT

INDEX_HTML="${TMP_DIR}/index.html"
if ! aws s3 cp "s3://${BUCKET_NAME}/index.html" "$INDEX_HTML" \
  --region "$AWS_REGION" >/dev/null; then
  echo "Error: failed to download s3://${BUCKET_NAME}/index.html" >&2
  exit 1
fi

# Vite emits <script type="module" … src="/assets/index-….js">
ASSET_PATH="$(grep -oE 'src="(/assets/[^"]+\.js)"' "$INDEX_HTML" | head -1 | sed -E 's/^src="//; s/"$//')"
if [[ -z "$ASSET_PATH" ]]; then
  ASSET_PATH="$(grep -oE '/assets/[^"[:space:]]+\.js' "$INDEX_HTML" | head -1 || true)"
fi

if [[ -z "$ASSET_PATH" ]]; then
  echo "Error: could not find a Vite /assets/*.js script in index.html" >&2
  exit 1
fi

# Strip leading slash for S3 key
ASSET_KEY="${ASSET_PATH#/}"
echo "App asset:       s3://${BUCKET_NAME}/${ASSET_KEY}" >&2

JS_FILE="${TMP_DIR}/app.js"
if ! aws s3 cp "s3://${BUCKET_NAME}/${ASSET_KEY}" "$JS_FILE" \
  --region "$AWS_REGION" >/dev/null; then
  echo "Error: failed to download s3://${BUCKET_NAME}/${ASSET_KEY}" >&2
  exit 1
fi

# Escape a value for a double-quoted .env line (same convention as api script).
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
  [[ "$value" == *'`'* ]] && quote=1

  if ((quote)); then
    printf '%s="%s"\n' "$key" "$(escape_env_value "$value")"
  else
    printf '%s=%s\n' "$key" "$value"
  fi
}

# Extract first occurrence of each VITE_*:"…" pair from the Vite bundle.
# import.meta.env is inlined as KEY:"value"; Zod schema fields use KEY:fn(…)
# and are ignored.
ENV_JSON="$(JS_FILE="$JS_FILE" node --input-type=module <<'NODE'
import fs from 'node:fs';

const text = fs.readFileSync(process.env.JS_FILE, 'utf8');
const re = /(VITE_[A-Z0-9_]+):("(?:\\.|[^"\\])*")/g;
const env = {};
let match;
while ((match = re.exec(text)) !== null) {
  const key = match[1];
  if (Object.prototype.hasOwnProperty.call(env, key)) continue;
  env[key] = JSON.parse(match[2]);
}
if (Object.keys(env).length === 0) {
  console.error('Error: no VITE_* string bindings found in app bundle.');
  process.exit(1);
}
process.stdout.write(JSON.stringify(env));
NODE
)" || {
  echo "Error: failed to extract VITE_* values from ${ASSET_KEY}" >&2
  exit 1
}

while IFS=$'\t' read -r key value; do
  [[ -z "$key" ]] && continue
  emit_env_line "$key" "$value" >>"$TMP_ENV"
done < <(jq -r 'to_entries[] | [.key, .value] | @tsv' <<<"$ENV_JSON")

KEY_COUNT="$(grep -cE '^[A-Za-z_][A-Za-z0-9_]*=' "$TMP_ENV" || true)"
if [[ "$KEY_COUNT" -eq 0 ]]; then
  echo "Error: extracted zero VITE_* keys from app bundle." >&2
  exit 1
fi

{
  echo "# Generated by infrastructure/aws-cdk/scripts/app-env-from-cdk-stack.sh"
  echo "# Stack: ${STACK_NAME} (${AWS_REGION})"
  echo "# App bucket: ${BUCKET_NAME}"
  echo "# Asset: ${ASSET_KEY}"
  echo "# Generated at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "#"
  echo "# Review before use. These are build-time VITE_* values baked into the"
  echo "# deployed static app (not runtime ECS env). For local Vite against this"
  echo "# stack you typically want VITE_CONDUCTOR_URL pointing at the deployed API."
  echo "# Keys omitted at CDK build time will be missing (app defaults then apply)."
  echo "#"
  grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$TMP_ENV" | LC_ALL=C sort -t= -k1,1
} >"$OUTPUT_FILE"

echo "" >&2
echo "Wrote $(wc -l <"$OUTPUT_FILE") lines (${KEY_COUNT} vars) to ${OUTPUT_FILE}" >&2
echo "Merge into app/.env after review: cp ${OUTPUT_FILE} ${APP_DIR}/.env" >&2
