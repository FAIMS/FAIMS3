#!/usr/bin/env bash
# Launch a DASS load test on AWS using ECS RunTask (coordinator + N agents).
#
# Configuration: load-testing/scripts/.env (see .env.example)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing ${ENV_FILE}" >&2
  echo "Copy load-testing/scripts/.env.example to load-testing/scripts/.env and edit." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Required variable ${name} is not set in ${ENV_FILE}" >&2
    exit 1
  fi
}

require_var STACK_NAME
require_var AWS_REGION
require_var INVITE_CODE
require_var NOTEBOOK_PROJECT_ID
require_var NOTEBOOK_SERVER_ID

AGENT_COUNT="${AGENT_COUNT:-1}"
NOTEBOOK_NAME="${NOTEBOOK_NAME:-survey}"
PARTICIPATE_IN_EXPORT="${PARTICIPATE_IN_EXPORT:-false}"
WAIT_TIMEOUT_SEC="${WAIT_TIMEOUT_SEC:-3600}"
EXPECTED_AGENT_COUNT="${EXPECTED_AGENT_COUNT:-$AGENT_COUNT}"

SEQUENCE_PLAN_FILE="${SEQUENCE_PLAN_FILE:-${SCRIPT_DIR}/../shared/sequence-plans/online-offline-loops-patchy.json}"
if [[ ! -f "$SEQUENCE_PLAN_FILE" ]]; then
  echo "Sequence plan not found: ${SEQUENCE_PLAN_FILE}" >&2
  exit 1
fi

if [[ -n "${SEQUENCE_PLAN_B64:-}" ]]; then
  PLAN_B64="$SEQUENCE_PLAN_B64"
else
  PLAN_B64="$(base64 -w0 "$SEQUENCE_PLAN_FILE")"
fi

PLAN_NAME="$(jq -r '.name // "unnamed"' "$SEQUENCE_PLAN_FILE")"
echo "Sequence plan: ${PLAN_NAME} (${SEQUENCE_PLAN_FILE})"

stack_output() {
  local key="$1"
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='${key}'].OutputValue" \
    --output text
}

echo "Reading stack outputs from ${STACK_NAME} (${AWS_REGION})…"

CLUSTER="$(stack_output ClusterName)"
COORD_TASK_DEF="$(stack_output CoordinatorTaskDefinitionArn)"
AGENT_TASK_DEF="$(stack_output AgentTaskDefinitionArn)"
ECS_SG="$(stack_output EcsSecurityGroupId)"
SUBNETS="$(stack_output PublicSubnetIds)"
METRICS_INSTANCE_ID="$(stack_output MetricsInstanceId)"
METRICS_DNS="$(stack_output MetricsDnsName)"

DASS_APP_URL="${DASS_APP_URL:-$(stack_output TargetDassAppUrl)}"
DASS_API_URL="${DASS_API_URL:-$(stack_output TargetDassApiUrl)}"
COUCH_URL="${COUCH_URL:-$(stack_output TargetCouchUrl)}"

for v in CLUSTER COORD_TASK_DEF AGENT_TASK_DEF ECS_SG SUBNETS METRICS_INSTANCE_ID; do
  if [[ -z "$v" || "$v" == "None" ]]; then
    echo "Missing CloudFormation output. Deploy the stack first (load-testing/infra)." >&2
    exit 1
  fi
done

METRICS_PRIVATE_IP="$(aws ec2 describe-instances \
  --instance-ids "$METRICS_INSTANCE_ID" \
  --region "$AWS_REGION" \
  --query 'Reservations[0].Instances[0].PrivateIpAddress' \
  --output text)"

PUSHGATEWAY_URL="http://${METRICS_PRIVATE_IP}:9091"
echo "Pushgateway: ${PUSHGATEWAY_URL}"
echo "Grafana:     http://${METRICS_DNS}:3030"

NETWORK_CONFIG="$(jq -n \
  --arg subnets "$SUBNETS" \
  --arg sg "$ECS_SG" \
  '{awsvpcConfiguration: {
    subnets: ($subnets | split(",")),
    securityGroups: [$sg],
    assignPublicIp: "ENABLED"
  }}')"

coord_env="$(jq -n \
  --arg n "$EXPECTED_AGENT_COUNT" \
  --arg pg "$PUSHGATEWAY_URL" \
  --arg plan "$PLAN_B64" \
  '[{name:"EXPECTED_AGENT_COUNT",value:$n},
    {name:"PROMETHEUS_PUSHGATEWAY_URL",value:$pg},
    {name:"SEQUENCE_PLAN_B64",value:$plan}]')"

echo "Starting coordinator task (expecting ${EXPECTED_AGENT_COUNT} agent(s))…"

COORD_TASK_ARN="$(aws ecs run-task \
  --cluster "$CLUSTER" \
  --task-definition "$COORD_TASK_DEF" \
  --launch-type FARGATE \
  --enable-execute-command \
  --network-configuration "$NETWORK_CONFIG" \
  --overrides "$(jq -n --argjson env "$coord_env" '{containerOverrides:[{name:"coordinator",environment:$env}]}')" \
  --region "$AWS_REGION" \
  --query 'tasks[0].taskArn' \
  --output text)"

if [[ -z "$COORD_TASK_ARN" || "$COORD_TASK_ARN" == "None" ]]; then
  echo "Failed to start coordinator task" >&2
  exit 1
fi

wait_task_running() {
  local task_arn="$1"
  local label="$2"
  local elapsed=0
  while [[ $elapsed -lt $WAIT_TIMEOUT_SEC ]]; do
    local last="$(aws ecs describe-tasks \
      --cluster "$CLUSTER" \
      --tasks "$task_arn" \
      --region "$AWS_REGION" \
      --query 'tasks[0].lastStatus' \
      --output text)"
    if [[ "$last" == "RUNNING" ]]; then
      echo "${label} is RUNNING"
      return 0
    fi
    if [[ "$last" == "STOPPED" ]]; then
      echo "${label} stopped before ready" >&2
      aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$task_arn" --region "$AWS_REGION" \
        --query 'tasks[0].{reason:stoppedReason,exit:containers[0].exitCode}' --output json >&2
      exit 1
    fi
    sleep 5
    elapsed=$((elapsed + 5))
  done
  echo "Timeout waiting for ${label}" >&2
  exit 1
}

wait_task_running "$COORD_TASK_ARN" "Coordinator"

COORD_ENI="$(aws ecs describe-tasks \
  --cluster "$CLUSTER" \
  --tasks "$COORD_TASK_ARN" \
  --region "$AWS_REGION" \
  --query "tasks[0].attachments[0].details[?name=='networkInterfaceId'].value | [0]" \
  --output text)"

COORD_PUBLIC_IP="$(aws ec2 describe-network-interfaces \
  --network-interface-ids "$COORD_ENI" \
  --region "$AWS_REGION" \
  --query 'NetworkInterfaces[0].Association.PublicIp' \
  --output text)"

COORDINATOR_URL="http://${COORD_PUBLIC_IP}:4000"
echo "Coordinator URL: ${COORDINATOR_URL}"
echo "Metrics debug:   COORDINATOR_URL=${COORDINATOR_URL} ${SCRIPT_DIR}/debug-metrics.sh"

echo "Waiting for coordinator /health…"
health_elapsed=0
while [[ $health_elapsed -lt 120 ]]; do
  if curl -sf "${COORDINATOR_URL}/health" >/dev/null; then
    echo "Coordinator healthy."
    break
  fi
  sleep 3
  health_elapsed=$((health_elapsed + 3))
done

if [[ $health_elapsed -ge 120 ]]; then
  echo "Coordinator health check failed" >&2
  exit 1
fi

agent_env_base="$(jq -n \
  --arg url "$COORDINATOR_URL" \
  --arg invite "$INVITE_CODE" \
  --arg proj "$NOTEBOOK_PROJECT_ID" \
  --arg server "$NOTEBOOK_SERVER_ID" \
  --arg nb "$NOTEBOOK_NAME" \
  --arg export "$PARTICIPATE_IN_EXPORT" \
  --arg app "$DASS_APP_URL" \
  --arg api "$DASS_API_URL" \
  --arg couch "$COUCH_URL" \
  '[{name:"COORDINATOR_URL",value:$url},
    {name:"INVITE_CODE",value:$invite},
    {name:"NOTEBOOK_PROJECT_ID",value:$proj},
    {name:"NOTEBOOK_SERVER_ID",value:$server},
    {name:"NOTEBOOK_NAME",value:$nb},
    {name:"PARTICIPATE_IN_EXPORT",value:$export},
    {name:"DASS_APP_URL",value:$app},
    {name:"DASS_API_URL",value:$api},
    {name:"COUCH_URL",value:$couch}]')"

echo "Launching ${AGENT_COUNT} agent task(s)…"

for i in $(seq 1 "$AGENT_COUNT"); do
  agent_id="agent-${i}-$(date +%s)"
  agent_env="$(jq --arg id "$agent_id" '. + [{name:"AGENT_ID",value:$id}]' <<< "$agent_env_base")"
  overrides="$(jq -n --argjson env "$agent_env" '{containerOverrides:[{name:"agent",environment:$env}]}')"

  arn="$(aws ecs run-task \
    --cluster "$CLUSTER" \
    --task-definition "$AGENT_TASK_DEF" \
    --launch-type FARGATE \
    --enable-execute-command \
    --network-configuration "$NETWORK_CONFIG" \
    --overrides "$overrides" \
    --region "$AWS_REGION" \
    --query 'tasks[0].taskArn' \
    --output text)"

  echo "  started ${agent_id}: ${arn}"
done

echo ""
echo "Load test running."
echo "  Coordinator task: ${COORD_TASK_ARN}"
echo "  Grafana:          http://${METRICS_DNS}:3030"
echo ""
STATUS_POLL_INTERVAL_SEC="${STATUS_POLL_INTERVAL_SEC:-5}"
export COORDINATOR_URL
echo "Live status (Ctrl+C to stop polling; test continues):"
echo ""

poll_coordinator_once() {
  local script="${SCRIPT_DIR}/poll-coordinator-status.sh"
  if [[ ! -x "$script" ]]; then
    chmod +x "$script"
  fi
  "$script" --once
}

# Poll status in background while waiting for coordinator to stop
(
  sleep 2
  while true; do
    if ! poll_coordinator_once; then
      break
    fi
    run_state="$(curl -sf "${COORDINATOR_URL}/status" 2>/dev/null | jq -r '.runState // empty')" || break
    if [[ "$run_state" == "complete" ]]; then
      sleep 1
      poll_coordinator_once || true
      break
    fi
    sleep "$STATUS_POLL_INTERVAL_SEC"
  done
) &
POLL_PID=$!

echo "Waiting for coordinator task to stop (test complete)…"

wait_task_stopped() {
  local task_arn="$1"
  local elapsed=0
  while [[ $elapsed -lt $WAIT_TIMEOUT_SEC ]]; do
    local last="$(aws ecs describe-tasks \
      --cluster "$CLUSTER" \
      --tasks "$task_arn" \
      --region "$AWS_REGION" \
      --query 'tasks[0].lastStatus' \
      --output text)"
    if [[ "$last" == "STOPPED" ]]; then
      aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$task_arn" --region "$AWS_REGION" \
        --query 'tasks[0].containers[0].{exit:exitCode,reason:reason}' --output json
      return 0
    fi
    sleep 10
    elapsed=$((elapsed + 10))
  done
  echo "Timeout waiting for task to stop: ${task_arn}" >&2
  exit 1
}

wait_task_stopped "$COORD_TASK_ARN"
kill "$POLL_PID" 2>/dev/null || true
wait "$POLL_PID" 2>/dev/null || true

echo ""
echo "Final status:"
"${SCRIPT_DIR}/poll-coordinator-status.sh" --once || true

echo "Coordinator finished. Check agent tasks in ECS console or CloudWatch logs."
