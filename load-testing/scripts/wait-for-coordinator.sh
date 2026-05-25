#!/usr/bin/env bash
set -euo pipefail

URL="${COORDINATOR_URL:-http://localhost:4000}/health"
TIMEOUT="${TIMEOUT:-60}"
elapsed=0

echo "Waiting for coordinator at $URL"

while [ "$elapsed" -lt "$TIMEOUT" ]; do
  if curl -sf "$URL" >/dev/null 2>&1; then
    echo "Coordinator is healthy."
    exit 0
  fi
  sleep 2
  elapsed=$((elapsed + 2))
done

echo "Coordinator health check timed out"
exit 1
