#!/usr/bin/env bash
set -euo pipefail

SERVICES="${1:-prometheus pushgateway grafana couchdb-exporter}"
TIMEOUT="${TIMEOUT:-120}"
INTERVAL=2
elapsed=0

echo "Waiting for services: $SERVICES"

while [ "$elapsed" -lt "$TIMEOUT" ]; do
  all_ok=true
  for svc in $SERVICES; do
    status=$(docker compose ps --status running --format json "$svc" 2>/dev/null | head -1)
    if [ -z "$status" ]; then
      all_ok=false
      break
    fi
  done
  if $all_ok; then
  echo "All services running."
    exit 0
  fi
  sleep "$INTERVAL"
  elapsed=$((elapsed + INTERVAL))
done

echo "Timeout waiting for services"
exit 1
