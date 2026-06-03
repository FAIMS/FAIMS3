#!/usr/bin/env bash
# Launch a DASS load test run using ECS RunTask (coordinator + N agents).
#
# Prerequisites:
#   - AWS CLI v2, jq, curl
#   - Stack deployed: cd load-testing/infra && pnpm run deploy
#   - Metrics EC2: SSM in, cd /opt/loadtest && docker compose up -d
#
# Usage:
#   ./scripts/run-load-test.sh --agents 10 \
#     --invite DEV-XXXXXX \
#     --notebook-project-id 1780442865830-fa-fa-fds \
#     --notebook-server-id development-faims-server
#
# Environment (or flags):
#   STACK_NAME, AWS_REGION — must match load-testing/infra/.env

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

STACK_NAME="${STACK_NAME:-loadtest-dev}"
AWS_REGION="${AWS_REGION:-ap-southeast-2}"
AGENT_COUNT=1
INVITE_CODE=""
NOTEBOOK_PROJECT_ID=""
NOTEBOOK_SERVER_ID=""
NOTEBOOK_NAME="survey"
PARTICIPATE_IN_EXPORT="false"
OFFLINE_DURATION_MS="30000"
SYNC_STORM_DELAY_MS="60000"
EXPECTED_AGENT_COUNT=""
WAIT_TIMEOUT_SEC=3600

usage() {
  sed -n '2,20p' "$0"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agents) AGENT_COUNT="$2"; shift 2 ;;
    --invite) INVITE_CODE="$2"; shift 2 ;;
    --notebook-project-id) NOTEBOOK_PROJECT_ID="$2"; shift 2 ;;
    --notebook-server-id) NOTEBOOK_SERVER_ID="$2"; shift 2 ;;
    --notebook-name) NOTEBOOK_NAME="$2"; shift 2 ;;
    --stack) STACK_NAME="$2"; shift 2 ;;
    --region) AWS_REGION="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $1" >&2; usage ;;
  esac
done

if [[ -z "$INVITE_CODE" || -z "$NOTEBOOK_PROJECT_ID" || -z "$NOTEBOOK_SERVER_ID" ]]; then
  echo "Required: --invite --notebook-project-id --notebook-server-id" >&2
  exit 1
fi

EXPECTED_AGENT_COUNT="${EXPECTED_AGENT_COUNT:-$AGENT_COUNT}"

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
DASS_APP_URL="$(stack_output TargetDassAppUrl)"

for v in CLUSTER COORD_TASK_DEF AGENT_TASK_DEF ECS_SG SUBNETS METRICS_INSTANCE_ID; do
  if [[ -z "$v" || "$v" == "None" ]]; then
    echo "Missing CloudFormation output. Deploy the stack first." >&2
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
  '[{name:"EXPECTED_AGENT_COUNT",value:$n},{name:"PROMETHEUS_PUSHGATEWAY_URL",value:$pg}]')"

echo "Starting coordinator task…"

COORD_TASK_ARN="$(aws ecs run-task \
  --cluster "$CLUSTER" \
  --task-definition "$COORD_TASK_DEF" \
  --launch-type FARGATE \
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
  --arg offline "$OFFLINE_DURATION_MS" \
  --arg sync "$SYNC_STORM_DELAY_MS" \
  --arg app "$DASS_APP_URL" \
  '[{name:"COORDINATOR_URL",value:$url},
    {name:"INVITE_CODE",value:$invite},
    {name:"NOTEBOOK_PROJECT_ID",value:$proj},
    {name:"NOTEBOOK_SERVER_ID",value:$server},
    {name:"NOTEBOOK_NAME",value:$nb},
    {name:"PARTICIPATE_IN_EXPORT",value:$export},
    {name:"OFFLINE_DURATION_MS",value:$offline},
    {name:"SYNC_STORM_DELAY_MS",value:$sync},
    {name:"DASS_APP_URL",value:$app}]')"

echo "Launching ${AGENT_COUNT} agent task(s)…"
AGENT_TASK_ARNS=()

for i in $(seq 1 "$AGENT_COUNT"); do
  agent_id="agent-${i}-$(date +%s)"
  agent_env="$(jq --arg id "$agent_id" '. + [{name:"AGENT_ID",value:$id}]' <<< "$agent_env_base")"
  overrides="$(jq -n --argjson env "$agent_env" '{containerOverrides:[{name:"agent",environment:$env}]}')"

  arn="$(aws ecs run-task \
    --cluster "$CLUSTER" \
    --task-definition "$AGENT_TASK_DEF" \
    --launch-type FARGATE \
    --network-configuration "$NETWORK_CONFIG" \
    --overrides "$overrides" \
    --region "$AWS_REGION" \
    --query 'tasks[0].taskArn' \
    --output text)"

  echo "  started ${agent_id}: ${arn}"
  AGENT_TASK_ARNS+=("$arn")
done

echo ""
echo "Load test running."
echo "  Coordinator task: ${COORD_TASK_ARN}"
echo "  Grafana:          http://${METRICS_DNS}:3030"
echo ""
echo "Monitor coordinator:"
echo "  curl ${COORDINATOR_URL}/status"
echo ""
echo "Wait for coordinator task to STOP (exit 0) — indicates run complete."

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
echo "Coordinator finished. Check agent tasks in ECS console or CloudWatch logs."
