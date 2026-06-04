#!/usr/bin/env bash
# Poll coordinator /status and print a human-readable progress dashboard.
#
# Usage:
#   COORDINATOR_URL=http://x.x.x.x:4000 ./poll-coordinator-status.sh
#   COORDINATOR_URL=... ./poll-coordinator-status.sh --once

set -euo pipefail

ONCE=false
if [[ "${1:-}" == "--once" ]]; then
  ONCE=true
fi

: "${COORDINATOR_URL:?Set COORDINATOR_URL}"
POLL_INTERVAL_SEC="${STATUS_POLL_INTERVAL_SEC:-5}"

format_ms() {
  local ms="$1"
  if [[ -z "$ms" || "$ms" == "null" ]]; then
    echo "—"
    return
  fi
  local sec=$((ms / 1000))
  local m=$((sec / 60))
  local s=$((sec % 60))
  if (( m > 0 )); then
    printf '%dm%02ds' "$m" "$s"
  else
    printf '%ds' "$s"
  fi
}

render_status() {
  local json="$1"
  local now
  now="$(date -u +%H:%M:%S)"

  local run_state plan_name elapsed est remain pct
  run_state="$(jq -r '.runState' <<< "$json")"
  plan_name="$(jq -r '.planName // "unnamed"' <<< "$json")"
  elapsed="$(format_ms "$(jq -r '.elapsedMs // 0' <<< "$json")")"
  est="$(format_ms "$(jq -r '.estimatedDurationMs // 0' <<< "$json")")"
  remain="$(format_ms "$(jq -r '.estimatedRemainingMs // 0' <<< "$json")")"
  pct="$(jq -r '.progressPercent // "?"' <<< "$json")"

  local reg ready done expected metrics
  reg="$(jq -r '.registeredAgents' <<< "$json")"
  ready="$(jq -r '.readyAgents' <<< "$json")"
  done="$(jq -r '.doneAgents // 0' <<< "$json")"
  expected="$(jq -r '.expectedAgents // .registeredAgents' <<< "$json")"
  metrics="$(jq -r '.metricsReceived' <<< "$json")"

  printf '\033[1m══════════════════════════════════════════════════════════════\033[0m\n'
  printf ' \033[1mDASS Load Test\033[0m — %s  [%s UTC]\n' "$plan_name" "$now"
  printf ' runState: \033[36m%s\033[0m' "$run_state"
  if [[ "$run_state" == "running" || "$run_state" == "complete" ]]; then
    printf '  |  elapsed: %s / ~%s est' "$elapsed" "$est"
    if [[ "$pct" != "?" && "$pct" != "null" ]]; then
      printf '  (%s%%)' "$pct"
    fi
    if [[ "$run_state" == "running" ]]; then
      printf '  |  ~%s left' "$remain"
    fi
  fi
  printf '\n'
  printf ' agents: %s/%s registered  |  %s ready  |  %s/%s done  |  metrics: %s\n' \
    "$reg" "$expected" "$ready" "$done" "$expected" "$metrics"

  if [[ "$run_state" == "waiting_for_agents" ]]; then
    printf '  waiting for %s agent(s) to register and ready up…\n' "$expected"
  fi

  local completed
  completed="$(jq -r '[.completedSteps[]?.stepId] | join(", ")' <<< "$json")"
  if [[ -n "$completed" ]]; then
    printf ' completed steps: %s\n' "$completed"
  fi

  local group_count
  group_count="$(jq -r '.activeStepGroups | length' <<< "$json")"
  if [[ "$group_count" != "0" && "$group_count" != "null" ]]; then
    printf '──────────────────────────────────────────────────────────────\n'
    printf ' \033[1mActive steps\033[0m\n'
    jq -r '.activeStepGroups[] |
      "  \(.stepId) (\(.kind))\(if .branchId then " branch=\(.branchId)" else "" end)  \(.agentCount) agent(s)  ETA \(
        if .remainingMs then ((.remainingMs / 1000 | floor) | tostring) + "s" else "—" end
      )\(
        if .barrier then "  barrier=\(.barrier.waitingOn) \(.barrier.completedAgents)/\(.barrier.totalAgents)" else "" end
      )"' <<< "$json"
  fi

  local split_count
  split_count="$(jq -r '.splitSummary | length' <<< "$json")"
  if [[ "$split_count" != "0" && "$split_count" != "null" ]]; then
    printf ' \033[1mSplit\033[0m '
    jq -r '[.splitSummary[] | "\(.branchId)=\(.agentCount) (\(.kind))"] | join("  ")' <<< "$json"
    printf '\n'
  fi

  local blocked
  blocked="$(jq -r '[.agents[]? | select(.blockedOnStepId != null) | .agentId] | join(", ")' <<< "$json")"
  if [[ -n "$blocked" ]]; then
    printf ' waiting on barrier: %s\n' "$blocked"
  fi

  local agent_rows
  agent_rows="$(jq -r '.agents[]? |
    "  \(.agentId)  step=\(.stepId // "—")\(if .branchId then " branch=\(.branchId)" else "" end)\(if .done then " DONE" elif .ready then "" else " (not ready)" end)\(if .blockedOnStepId then " blocked=\(.blockedOnStepId)" else "" end)"' <<< "$json")"
  if [[ -n "$agent_rows" ]]; then
    printf '──────────────────────────────────────────────────────────────\n'
    printf ' \033[1mAgents\033[0m\n'
    printf '%s\n' "$agent_rows"
  fi

  local timeline_len
  timeline_len="$(jq -r '.planTimeline | length // 0' <<< "$json")"
  if [[ "$timeline_len" != "0" && "$timeline_len" != "null" ]]; then
    printf '──────────────────────────────────────────────────────────────\n'
    printf ' \033[1mPlan timeline\033[0m (leaf phases; ≈ = structural)\n'
    jq -r '
      . as $root |
      ($root.completedSteps // []) | map(.stepId) as $done |
      [$root.activeStepGroups[]?.stepId] as $active |
      $root.planTimeline[] |
      (if .structural then "≈ " else "  " end) +
      (if (.id | IN($done[])) then "✓ " elif (.id | IN($active[])) then "▶ " else "  " end) +
      .id +
      (if .kind then " (\(.kind))" else "" end) +
      (if .label then " \(.label)" else "" end) +
      " ~" + ((.durationMs / 1000 | floor | tostring)) + "s"
    ' <<< "$json"
  fi

  printf '\033[1m══════════════════════════════════════════════════════════════\033[0m\n'
}

poll_once() {
  local json
  if ! json="$(curl -sf "${COORDINATOR_URL}/status")"; then
    echo "Coordinator unreachable: ${COORDINATOR_URL}/status" >&2
    return 1
  fi
  render_status "$json"
}

if $ONCE; then
  poll_once
  exit 0
fi

while true; do
  if ! poll_once; then
    exit 1
  fi
  sleep "$POLL_INTERVAL_SEC"
done
