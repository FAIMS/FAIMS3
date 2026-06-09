#!/usr/bin/env bash
# Debug Prometheus / Pushgateway / Grafana during or after an AWS load test.
#
# Usage:
#   cd load-testing/scripts && ./debug-metrics.sh
#   COORDINATOR_URL=http://x.x.x.x:4000 ./debug-metrics.sh
#
# Requires: aws cli, jq, curl; optional COORDINATOR_URL from a running test.

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

stack_output() {
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='${1}'].OutputValue" \
    --output text
}

METRICS_INSTANCE_ID="$(stack_output MetricsInstanceId)"
METRICS_DNS="$(stack_output MetricsDnsName)"
METRICS_PRIVATE_IP="$(aws ec2 describe-instances \
  --instance-ids "$METRICS_INSTANCE_ID" \
  --region "$AWS_REGION" \
  --query 'Reservations[0].Instances[0].PrivateIpAddress' \
  --output text)"

echo "=== Load test metrics debug ==="
echo "Stack:        ${STACK_NAME} (${AWS_REGION})"
echo "Metrics EC2:  ${METRICS_INSTANCE_ID} private=${METRICS_PRIVATE_IP}"
echo "Grafana:      http://${METRICS_DNS}:3030"
echo "Pushgateway:  http://${METRICS_PRIVATE_IP}:9091 (VPC only)"
echo ""

if [[ -n "${COORDINATOR_URL:-}" ]]; then
  echo "=== Coordinator (${COORDINATOR_URL}) ==="
  curl -sf "${COORDINATOR_URL}/status" | jq . || echo "  /status unreachable"
  echo ""
  echo "Coordinator /metrics (phase gauges — local dev only unless pushed):"
  curl -sf "${COORDINATOR_URL}/metrics" | grep -E '^faims_' | head -20 || echo "  no faims_ metrics on /metrics"
  echo ""
fi

echo "=== Run on metrics EC2 (SSM Session Manager) ==="
cat <<EOF
cd /opt/loadtest

# 1. Observability stack up?
sudo docker compose ps

# 2. Pushgateway has pushed metrics?
curl -s localhost:9091/metrics | grep -E '^faims_' | head -30
# expect jobs: faims_coordinator (phase) and faims_agent_metrics (histograms)

# 3. Prometheus ingesting pushgateway?
curl -s 'localhost:9090/api/v1/query?query=up{job="pushgateway"}' | jq '.data.result'
curl -s 'localhost:9090/api/v1/query?query=faims_run_state' | jq '.data.result'
curl -s 'localhost:9090/api/v1/query?query=faims_record_create_ms_count' | jq '.data.result'

# 4. Scrape targets healthy?
curl -s localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health, lastError: .lastError}'

# 5. From metrics host, pushgateway reachable on private IP (same path coordinator uses)
curl -sf "http://${METRICS_PRIVATE_IP}:9091/metrics" | head -5 || echo "pushgateway not reachable on private IP"
EOF

echo ""
echo "=== Coordinator CloudWatch logs ==="
echo "Look for: 'Pushgateway coordinator push failed' or 'Pushgateway push failed'"
echo "Log group: /aws/ecs/loadtest-dev-CoordinatorLogs-* (adjust for your stack)"
echo ""
echo "=== Common causes ==="
echo "- Observability compose not running on metrics EC2"
echo "- Coordinator task missing PROMETHEUS_PUSHGATEWAY_URL (run-load-test.sh sets it)"
echo "- ECS SG cannot reach metrics EC2 :9091 (check EcsTasksSg → MetricsEc2Sg rule)"
echo "- Run state metrics: coordinator pushes faims_run_state to pushgateway as job faims_coordinator"
