#!/usr/bin/env bash
# Poll coordinator /status and print a human-readable progress dashboard.
#
# Usage:
#   COORDINATOR_URL=http://x.x.x.x:4000 ./poll-coordinator-status.sh
#   COORDINATOR_URL=... ./poll-coordinator-status.sh --once
#
# Compact display (default): clusters agents and compresses the plan timeline.
#   STATUS_VERBOSE=true       per-agent lines + full timeline
#   STATUS_CLEAR_SCREEN=true  clear terminal each poll (loop mode only)

set -euo pipefail

ONCE=false
if [[ "${1:-}" == "--once" ]]; then
  ONCE=true
fi

: "${COORDINATOR_URL:?Set COORDINATOR_URL}"
POLL_INTERVAL_SEC="${STATUS_POLL_INTERVAL_SEC:-5}"
STATUS_VERBOSE="${STATUS_VERBOSE:-false}"
STATUS_CLEAR_SCREEN="${STATUS_CLEAR_SCREEN:-true}"

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

render_status_compact() {
  local json="$1"
  local now
  now="$(date -u +%H:%M:%S)"

  local run_state plan_name summary_line
  run_state="$(jq -r '.runState' <<< "$json")"
  plan_name="$(jq -r '.planName // "unnamed"' <<< "$json")"

  summary_line="$(jq -r '
    def fmt_ms(ms):
      if ms == null then "—"
      else
        (ms / 1000 | floor) as $s
        | ($s / 60 | floor) as $m
        | ($s % 60) as $r
        | if $m > 0 then "\($m)m\(if $r < 10 then "0" else "" end)\($r)s" else "\($s)s" end
      end;
    "agents \(.registeredAgents)/\(.expectedAgents // .registeredAgents) reg"
    + "  \(.readyAgents) rdy"
    + "  \(.doneAgents // 0)/\(.expectedAgents // .registeredAgents) done"
    + "  |  metrics \(.metricsReceived)"
    + "  |  "
    + (if (.runState == "running" or .runState == "complete") then
        "\(fmt_ms(.elapsedMs)) / ~\(fmt_ms(.estimatedDurationMs))"
        + (if .progressPercent != null then " (\(.progressPercent)%)" else "" end)
        + (if .runState == "running" then "  ~\(fmt_ms(.estimatedRemainingMs)) left" else "" end)
      else "" end)
  ' <<< "$json")"

  printf '\033[1m══════════════════════════════════════════════════════════════\033[0m\n'
  printf ' \033[1mDASS Load Test\033[0m — %s  [%s UTC]\n' "$plan_name" "$now"
  printf ' \033[36m%s\033[0m  %s\n' "$run_state" "$summary_line"

  if [[ "$run_state" == "waiting_for_agents" ]]; then
    local expected
    expected="$(jq -r '.expectedAgents // .registeredAgents' <<< "$json")"
    printf ' waiting for %s agent(s)…\n' "$expected"
  fi

  jq -r '
    def eta_sec(ms):
      if ms == null then "—"
      else ((ms / 1000) | floor | tostring) + "s"
      end;

    (if (.completedSteps // []) | length > 0 then
      "done: "
        + ([.completedSteps[]?.stepId]
           | if length > 6 then (.[0:5] | join(", ")) + " …+" + ((length - 5) | tostring)
             else join(", ") end)
    else empty end),

    (if (.activeStepGroups // []) | length > 0 then
      "active: "
        + ([.activeStepGroups[] |
            (.stepId + (if .branchId then "/" + .branchId else "" end))
            + " x" + (.agentCount | tostring)
            + " ETA " + eta_sec(.remainingMs)
            + (if .barrier then
                " [" + .barrier.waitingOn + " " + (.barrier.completedAgents | tostring)
                + "/" + (.barrier.totalAgents | tostring) + "]"
              else "" end)
          ] | join("  ·  "))
    else empty end),

    (if (.splitSummary // []) | length > 0 then
      "split: " + ([.splitSummary[] | .branchId + "=" + (.agentCount | tostring)] | join("  "))
    else empty end),

    (if (.agents // []) | length > 0 then
      "agents: "
        + (
          [.agents[] |
            {
              bucket: (
                (if .done then "done"
                 elif (.ready | not) then "pending"
                 else "active" end)
                + "|" + (.stepId // "-")
                + "|" + (.branchId // "-")
                + (if .blockedOnStepId then "|wait" else "" end)
              ),
              label: (
                if .done then "done"
                elif (.ready | not) then "pending"
                else (.stepId // "-")
                  + (if .branchId then "/" + .branchId else "" end)
                  + (if .blockedOnStepId then " (wait)" else "" end)
                end
              )
            }
          ]
          | group_by(.bucket)
          | map({n: length, label: .[0].label})
          | sort_by(-.n, .label)
          | map((.n | tostring) + "x " + .label)
          | join("  ·  ")
        )
    else empty end),

    (if (.planTimeline // []) | length > 0 then
      . as $root
      | ($root.completedSteps // []) | map(.stepId) as $done
      | [$root.activeStepGroups[]?.stepId] as $active
      | "plan: "
        + ([$root.planTimeline[] |
            if .structural == "loop" then
              "[loop " + .id + " x" + ((.loopCount // 0) | tostring) + "]"
            elif .structural == "split" then
              "{split " + .id + "}"
            else
              (if (.id | IN($done[])) then "+"
               elif (.id | IN($active[])) then ">"
               else "." end)
              + .id
            end
          ] | join(" "))
    else empty end)
  ' <<< "$json"

  printf '\033[1m══════════════════════════════════════════════════════════════\033[0m\n'
}

render_status_verbose() {
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

  local completed
  completed="$(jq -r '[.completedSteps[]?.stepId] | join(", ")' <<< "$json")"
  if [[ -n "$completed" ]]; then
    printf ' completed: %s\n' "$completed"
  fi

  local group_count
  group_count="$(jq -r '.activeStepGroups | length' <<< "$json")"
  if [[ "$group_count" != "0" && "$group_count" != "null" ]]; then
    printf ' active: '
    jq -r '[.activeStepGroups[] |
      "\(.stepId) (\(.kind))\(if .branchId then "/\(.branchId)" else "" end) x\(.agentCount) ETA \(
        if .remainingMs then ((.remainingMs / 1000 | floor)|tostring) + "s" else "—" end
      )"] | join("  ·  ")' <<< "$json"
    printf '\n'
  fi

  jq -r '.agents[]? |
    "   \(.agentId)  \(.stepId // "—")\(if .branchId then "/\(.branchId)" else "" end)\(if .done then " DONE" elif .ready then "" else " !rdy" end)\(if .blockedOnStepId then " (wait)" else "" end)"' <<< "$json"

  jq -r '
    . as $root |
    ($root.completedSteps // []) | map(.stepId) as $done |
    [$root.activeStepGroups[]?.stepId] as $active |
    $root.planTimeline[] |
    (if .structural then "~ " else "  " end) +
    (if (.id | IN($done[])) then "+ " elif (.id | IN($active[])) then "> " else "  " end) +
    .id + (if .kind then " (\(.kind))" else "" end) +
    " ~" + ((.durationMs / 1000 | floor | tostring)) + "s"
  ' <<< "$json"

  printf '\033[1m══════════════════════════════════════════════════════════════\033[0m\n'
}

render_status() {
  local json="$1"
  if [[ "${STATUS_VERBOSE,,}" == "true" ]]; then
    render_status_verbose "$json"
  else
    render_status_compact "$json"
  fi
}

poll_once() {
  local json
  if ! json="$(curl -sf "${COORDINATOR_URL}/status")"; then
    echo "Coordinator unreachable: ${COORDINATOR_URL}/status" >&2
    return 1
  fi
  if [[ "$ONCE" != "true" && "${STATUS_CLEAR_SCREEN,,}" == "true" ]]; then
    printf '\033[2J\033[H'
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
