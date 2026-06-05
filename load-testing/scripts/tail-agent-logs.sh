#!/usr/bin/env bash
# Tail recent CloudWatch logs for ECS agent RunTask containers.
#
# Usage:
#   ./tail-agent-logs.sh              # follow latest stream
#   ./tail-agent-logs.sh --list       # list recent streams only
#   ./tail-agent-logs.sh <task-id-fragment>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

: "${STACK_NAME:?Set STACK_NAME in scripts/.env}"
: "${AWS_REGION:?Set AWS_REGION in scripts/.env}"

LIST_ONLY=false
TASK_FILTER=""
for arg in "$@"; do
  case "$arg" in
    --list) LIST_ONLY=true ;;
    -h|--help)
      sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) TASK_FILTER="$arg" ;;
  esac
done

LOG_GROUP="$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$AWS_REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='AgentLogGroupName'].OutputValue" \
  --output text)"

if [[ -z "$LOG_GROUP" || "$LOG_GROUP" == "None" ]]; then
  echo "AgentLogGroupName output missing — redeploy load-testing/infra." >&2
  exit 1
fi

echo "Log group: ${LOG_GROUP}" >&2
echo "Streams:   agent/agent/<ecs-task-id> (one per agent RunTask)" >&2
echo "" >&2

STREAMS="$(aws logs describe-log-streams \
  --log-group-name "$LOG_GROUP" \
  --region "$AWS_REGION" \
  --order-by LastEventTime \
  --descending \
  --max-items 20 \
  --query 'logStreams[].logStreamName' \
  --output text)"

if [[ -z "$STREAMS" ]]; then
  echo "No log streams yet. Agent tasks may still be starting, or logging is misconfigured." >&2
  echo "Check ECS → cluster → Tasks → agent container → Logs." >&2
  exit 1
fi

if [[ -n "$TASK_FILTER" ]]; then
  MATCH=""
  for s in $STREAMS; do
    if [[ "$s" == *"$TASK_FILTER"* ]]; then
      MATCH="$s"
      break
    fi
  done
  if [[ -z "$MATCH" ]]; then
    echo "No stream matching '${TASK_FILTER}'. Recent streams:" >&2
    for s in $STREAMS; do echo "  $s" >&2; done
    exit 1
  fi
  STREAM="$MATCH"
else
  STREAM="$(echo "$STREAMS" | awk '{print $1}')"
fi

echo "Stream: ${STREAM}" >&2

if $LIST_ONLY; then
  echo "Recent streams:" >&2
  for s in $STREAMS; do echo "  $s" >&2; done
  exit 0
fi

aws logs tail "$LOG_GROUP" \
  --log-stream-names "$STREAM" \
  --region "$AWS_REGION" \
  --follow \
  --format short
