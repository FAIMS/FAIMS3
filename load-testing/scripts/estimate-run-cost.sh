#!/usr/bin/env bash
# Estimate AWS cost for a FAIMS load test RunTask (coordinator + N agents on Fargate).
#
# Usage:
#   ./estimate-run-cost.sh [duration_minutes]
#   AGENT_COUNT=20 ./estimate-run-cost.sh 15
#
# Configuration: load-testing/scripts/.env (same as run-load-test.sh)
# Task sizing defaults match load-testing/infra/lib/config.ts (override via env).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

usage() {
  cat <<'EOF'
Estimate AWS cost for a load test run (Fargate + minor extras).

Usage:
  ./estimate-run-cost.sh [duration_minutes]

Environment (from .env or shell):
  AGENT_COUNT                 Number of agent tasks (default: 1)
  AWS_REGION                  Pricing region (default: ap-southeast-2)
  COORDINATOR_CPU             Fargate CPU units, 1024 = 1 vCPU (default: 2048)
  COORDINATOR_MEMORY_MIB      Coordinator memory MiB (default: 4096)
  AGENT_CPU                   Agent CPU units (default: 2048)
  AGENT_MEMORY_MIB            Agent memory MiB (default: 4096)
  ESTIMATE_DURATION_MIN         Default duration if no arg (default: 15)
  ESTIMATE_COORDINATOR_LEAD_MIN Extra coordinator-only minutes (default: 3)
  ESTIMATE_EGRESS_GB_PER_AGENT  Internet egress GiB per agent (default: 0.2)
  ESTIMATE_LOG_GB               CloudWatch log ingest GiB total (default: 0.15)
  ESTIMATE_INCLUDE_METRICS_EC2  Include t3.medium metrics host (default: false)
  METRICS_INSTANCE_TYPE         EC2 type when included (default: t3.medium)

Examples:
  ./estimate-run-cost.sh 15
  AGENT_COUNT=20 ESTIMATE_INCLUDE_METRICS_EC2=true ./estimate-run-cost.sh 20
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

AGENT_COUNT="${AGENT_COUNT:-1}"
AWS_REGION="${AWS_REGION:-ap-southeast-2}"
COORDINATOR_CPU="${COORDINATOR_CPU:-2048}"
COORDINATOR_MEMORY_MIB="${COORDINATOR_MEMORY_MIB:-4096}"
AGENT_CPU="${AGENT_CPU:-2048}"
AGENT_MEMORY_MIB="${AGENT_MEMORY_MIB:-4096}"
ESTIMATE_DURATION_MIN="${1:-${ESTIMATE_DURATION_MIN:-15}}"
ESTIMATE_COORDINATOR_LEAD_MIN="${ESTIMATE_COORDINATOR_LEAD_MIN:-3}"
ESTIMATE_EGRESS_GB_PER_AGENT="${ESTIMATE_EGRESS_GB_PER_AGENT:-0.2}"
ESTIMATE_LOG_GB="${ESTIMATE_LOG_GB:-0.15}"
ESTIMATE_INCLUDE_METRICS_EC2="${ESTIMATE_INCLUDE_METRICS_EC2:-false}"
METRICS_INSTANCE_TYPE="${METRICS_INSTANCE_TYPE:-t3.medium}"

if ! [[ "$AGENT_COUNT" =~ ^[0-9]+$ ]] || (( AGENT_COUNT < 1 )); then
  echo "AGENT_COUNT must be a positive integer (got: ${AGENT_COUNT})" >&2
  exit 1
fi
if ! [[ "$ESTIMATE_DURATION_MIN" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
  echo "Duration must be a number of minutes (got: ${ESTIMATE_DURATION_MIN})" >&2
  exit 1
fi

# Fargate Linux/x86 on-demand (USD per vCPU-hour and per GiB-hour), approximate.
# Source: AWS Fargate pricing — verify at https://calculator.aws/
fargate_rates() {
  local region="$1"
  case "$region" in
    us-east-1|us-east-2|us-west-2)
      FARGATE_VCPU_HR=0.04048
      FARGATE_GIB_HR=0.004445
      DT_OUT_GIB=0.090
      CW_LOG_GIB=0.50
      EC2_T3_MEDIUM_HR=0.0416
      ;;
    eu-west-1|eu-west-2)
      FARGATE_VCPU_HR=0.04419
      FARGATE_GIB_HR=0.004845
      DT_OUT_GIB=0.090
      CW_LOG_GIB=0.57
      EC2_T3_MEDIUM_HR=0.0456
      ;;
    eu-central-1)
      FARGATE_VCPU_HR=0.04698
      FARGATE_GIB_HR=0.005147
      DT_OUT_GIB=0.090
      CW_LOG_GIB=0.57
      EC2_T3_MEDIUM_HR=0.048
      ;;
    ap-southeast-1|ap-southeast-2)
      FARGATE_VCPU_HR=0.04656
      FARGATE_GIB_HR=0.00511
      DT_OUT_GIB=0.114
      CW_LOG_GIB=0.76
      EC2_T3_MEDIUM_HR=0.0528
      ;;
    ap-northeast-1)
      FARGATE_VCPU_HR=0.04836
      FARGATE_GIB_HR=0.005307
      DT_OUT_GIB=0.114
      CW_LOG_GIB=0.76
      EC2_T3_MEDIUM_HR=0.0544
      ;;
    *)
      echo "Warning: unknown region ${region}; using ap-southeast-2 rates." >&2
      FARGATE_VCPU_HR=0.04656
      FARGATE_GIB_HR=0.00511
      DT_OUT_GIB=0.114
      CW_LOG_GIB=0.76
      EC2_T3_MEDIUM_HR=0.0528
      ;;
  esac
  PUBLIC_IPV4_HR=0.005
}

fargate_rates "$AWS_REGION"

bc_calc() {
  echo "scale=4; $1" | bc
}

bc_usd() {
  printf '$%.2f' "$(bc_calc "$1")"
}

cpu_to_vcpu() {
  bc_calc "$1 / 1024"
}

mib_to_gib() {
  bc_calc "$1 / 1024"
}

task_fargate_cost() {
  local cpu_units="$1"
  local mem_mib="$2"
  local hours="$3"
  local count="$4"
  local vcpu
  local gib
  vcpu="$(cpu_to_vcpu "$cpu_units")"
  gib="$(mib_to_gib "$mem_mib")"
  bc_calc "($vcpu * $FARGATE_VCPU_HR + $gib * $FARGATE_GIB_HR) * $hours * $count"
}

agent_hours="$(bc_calc "$ESTIMATE_DURATION_MIN / 60")"
coord_test_hours="$agent_hours"
coord_total_hours="$(bc_calc "$ESTIMATE_COORDINATOR_LEAD_MIN / 60 + $coord_test_hours")"
task_count=$((AGENT_COUNT + 1))
public_ip_count=$task_count

coord_cost="$(task_fargate_cost "$COORDINATOR_CPU" "$COORDINATOR_MEMORY_MIB" "$coord_total_hours" 1)"
agents_cost="$(task_fargate_cost "$AGENT_CPU" "$AGENT_MEMORY_MIB" "$agent_hours" "$AGENT_COUNT")"
fargate_total="$(bc_calc "$coord_cost + $agents_cost")"

# Public IPv4: billed while task ENI has a public address
coord_ip_cost="$(bc_calc "$PUBLIC_IPV4_HR * $coord_total_hours")"
agents_ip_cost="$(bc_calc "$PUBLIC_IPV4_HR * $agent_hours * $AGENT_COUNT")"
public_ip_total="$(bc_calc "$coord_ip_cost + $agents_ip_cost")"

egress_gib="$(bc_calc "$ESTIMATE_EGRESS_GB_PER_AGENT * $AGENT_COUNT")"
egress_cost="$(bc_calc "$egress_gib * $DT_OUT_GIB")"
logs_cost="$(bc_calc "$ESTIMATE_LOG_GB * $CW_LOG_GIB")"

marginal_total="$(bc_calc "$fargate_total + $public_ip_total + $egress_cost + $logs_cost")"

metrics_cost=0
if [[ "${ESTIMATE_INCLUDE_METRICS_EC2,,}" == "true" ]]; then
  metrics_hours="$coord_total_hours"
  metrics_cost="$(bc_calc "$EC2_T3_MEDIUM_HR * $metrics_hours + $PUBLIC_IPV4_HR * $metrics_hours")"
fi

grand_total="$(bc_calc "$marginal_total + $metrics_cost")"

coord_vcpu="$(cpu_to_vcpu "$COORDINATOR_CPU")"
agent_vcpu="$(cpu_to_vcpu "$AGENT_CPU")"
coord_gib="$(mib_to_gib "$COORDINATOR_MEMORY_MIB")"
agent_gib="$(mib_to_gib "$AGENT_MEMORY_MIB")"

printf '\n'
printf 'FAIMS load test cost estimate (%s)\n' "$AWS_REGION"
printf '══════════════════════════════════════════════════════════════\n'
printf ' Tasks:        1 coordinator + %s agents = %s Fargate tasks\n' "$AGENT_COUNT" "$task_count"
printf ' Agent run:    %s min\n' "$ESTIMATE_DURATION_MIN"
printf ' Coordinator:  +%s min lead (health / agent startup)\n' "$ESTIMATE_COORDINATOR_LEAD_MIN"
printf ' Sizing:       coordinator %.3f vCPU / %.1f GiB\n' "$coord_vcpu" "$coord_gib"
printf '               agent       %.3f vCPU / %.1f GiB each\n' "$agent_vcpu" "$agent_gib"
printf '──────────────────────────────────────────────────────────────\n'
printf ' Fargate compute\n'
printf '   Coordinator (%s min)     %s\n' "$(bc_calc "$coord_total_hours * 60" | xargs printf '%.0f')" "$(bc_usd "$coord_cost")"
printf '   Agents (%s × %s min)       %s\n' "$AGENT_COUNT" "$ESTIMATE_DURATION_MIN" "$(bc_usd "$agents_cost")"
printf '   Subtotal                   %s\n' "$(bc_usd "$fargate_total")"
printf ' Public IPv4 (%s addresses)   %s\n' "$public_ip_count" "$(bc_usd "$public_ip_total")"
printf ' Data transfer out (~%.2f GiB) %s  (%.1f GiB/agent, to FAIMS/Couch)\n' \
  "$(bc_calc "$egress_gib")" "$(bc_usd "$egress_cost")" "$ESTIMATE_EGRESS_GB_PER_AGENT"
printf ' CloudWatch Logs (~%.2f GiB)  %s\n' "$ESTIMATE_LOG_GB" "$(bc_usd "$logs_cost")"
printf '──────────────────────────────────────────────────────────────\n'
printf ' Marginal run total           %s\n' "$(bc_usd "$marginal_total")"
if [[ "${ESTIMATE_INCLUDE_METRICS_EC2,,}" == "true" ]]; then
  printf ' Metrics EC2 (%s, %s min)  %s\n' \
    "$METRICS_INSTANCE_TYPE" "$(bc_calc "$metrics_hours * 60" | xargs printf '%.0f')" "$(bc_usd "$metrics_cost")"
  printf '──────────────────────────────────────────────────────────────\n'
  printf ' Total (incl. metrics host)   %s\n' "$(bc_usd "$grand_total")"
else
  printf ' (Metrics EC2 not included — usually already running from CDK stack.)\n'
  printf ' Total                          %s\n' "$(bc_usd "$grand_total")"
fi
printf '══════════════════════════════════════════════════════════════\n'
printf '\n'
printf 'Notes:\n'
printf ' • Fargate bills from image pull until task stop (1-minute minimum per task).\n'
printf ' • Does not include target FAIMS/Couch infrastructure or Route53/ECR storage.\n'
printf ' • Rates are approximate; use https://calculator.aws/ for quotes.\n'
printf ' • Tune egress: ESTIMATE_EGRESS_GB_PER_AGENT=0.5 ./estimate-run-cost.sh 15\n'
printf '\n'
