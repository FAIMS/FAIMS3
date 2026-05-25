#!/usr/bin/env bash
set -euo pipefail

GRAFANA_URL="${GRAFANA_URL:-http://localhost:3030}"
OUT="${1:-./snapshots/snapshot-$(date +%Y%m%d-%H%M%S).json}"

mkdir -p "$(dirname "$OUT")"

DASH_UID=$(curl -sf "$GRAFANA_URL/api/search?query=dass" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['uid'] if d else '')" 2>/dev/null || true)

if [ -z "$DASH_UID" ]; then
  echo "Could not find DASS load test dashboard in Grafana"
  exit 1
fi

curl -sf "$GRAFANA_URL/api/dashboards/uid/$DASH_UID" -o "$OUT"
echo "Dashboard snapshot saved to $OUT"
