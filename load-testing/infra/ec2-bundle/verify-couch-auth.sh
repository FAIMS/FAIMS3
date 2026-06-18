#!/bin/bash
# Debug CouchDB credentials for couchdb-exporter on the metrics host.
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/loadtest}"
cd "$INSTALL_DIR"

if [[ ! -f .env ]]; then
  echo "Missing ${INSTALL_DIR}/.env — run bootstrap.sh first" >&2
  exit 1
fi

# Values are jq @json quoted — never `source .env` (bash expands $ inside "...").
read_env() {
  local key=$1
  grep "^${key}=" .env 2>/dev/null | sed "s/^${key}=//" | jq -r . 2>/dev/null || true
}

read_env_file() {
  local file=$1 key=$2
  grep "^${key}=" "$file" 2>/dev/null | sed "s/^${key}=//" | jq -r . 2>/dev/null || true
}

COUCHDB_EXPORTER_URL="$(read_env COUCHDB_EXPORTER_URL)"
COUCH_USER="$(read_env COUCH_USER)"
COUCHDB_USERNAME="$(read_env_file couchdb-exporter.env COUCHDB_USERNAME)"
COUCHDB_URI="$(read_env_file couchdb-exporter.env COUCHDB_URI)"
exporter_env_pass="$(read_env_file couchdb-exporter.env COUCHDB_PASSWORD)"
# couchdb-exporter.env stores $$ for compose; container receives a single $.
COUCHDB_PASSWORD="${exporter_env_pass//\$\$/$}"
COUCH_PASSWORD="$COUCHDB_PASSWORD"

if [[ -f .env ]] && grep -q '^COUCH_PASSWORD=' .env; then
  echo "WARNING: COUCH_PASSWORD is still in project .env — compose will interpolate \$ inside it." >&2
  echo "  Run: sudo /opt/loadtest/refresh-couchdb-exporter-env.sh" >&2
fi

redact() {
  sed -E 's/(COUCHDB_PASSWORD|COUCH_PASSWORD)=.*/\1=***/'
}

echo "=== .env (redacted) ==="
grep -E '^(COUCHDB_EXPORTER_URL|COUCH_USER)=' .env | redact
grep '^COUCH_PASSWORD=' .env 2>/dev/null | redact || true

if [[ -f couchdb-exporter.env ]]; then
  echo "=== couchdb-exporter.env (redacted) ==="
  grep -E '^COUCHDB_' couchdb-exporter.env | redact
else
  echo "=== couchdb-exporter.env: MISSING (re-run bootstrap.sh) ==="
fi

echo
echo "=== Password lengths (characters) ==="
echo "  expected password (from couchdb-exporter.env): $(printf '%s' "${COUCH_PASSWORD:-}" | wc -c)"

if [[ -n "${COUCH_PASSWORD_SECRET_ARN:-}" ]]; then
  secret_len="$(aws secretsmanager get-secret-value \
    --secret-id "$COUCH_PASSWORD_SECRET_ARN" \
    --query SecretString \
    --output text | jq -r '.password | length' 2>/dev/null || echo '?')"
  echo "  Secrets Manager:    ${secret_len}"
fi

echo
echo "=== Host curl (same creds as .env) ==="
user="${COUCHDB_USERNAME:-${COUCH_USER:-admin}}"
pass="${COUCH_PASSWORD:-}"
url="${COUCHDB_URI:-${COUCHDB_EXPORTER_URL:-}}"
code="$(curl -sS -o /dev/null -w '%{http_code}' -u "${user}:${pass}" "${url}/_up" || echo "000")"
echo "  GET ${url}/_up → HTTP ${code}"
if [[ "$code" == "200" ]]; then
  echo "  Credentials OK at CouchDB"
else
  echo "  Credentials rejected or unreachable — fix .env/secret before debugging Docker"
fi

echo
echo "=== docker compose resolved env (couchdb-exporter) ==="
docker compose config 2>/dev/null \
  | awk '/^  couchdb-exporter:/{flag=1} flag && /^  [a-z]/ && !/^  couchdb-exporter:/{flag=0} flag' \
  | grep -E 'COUCHDB_(URI|USERNAME|PASSWORD)' \
  | redact || echo "  (docker compose config failed — is compose installed?)"

cid="$(docker compose ps -q couchdb-exporter 2>/dev/null || true)"
if [[ -n "$cid" ]]; then
  echo
  echo "=== Running container env (docker inspect — gesellix image has no curl) ==="
  container_pass="$(
    docker inspect "$cid" --format '{{range .Config.Env}}{{println .}}{{end}}' \
      | sed -n 's/^COUCHDB_PASSWORD=//p'
  )"
  docker inspect "$cid" --format '{{range .Config.Env}}{{println .}}{{end}}' \
    | grep -E '^COUCHDB_(URI|USERNAME|PASSWORD)=' \
    | redact
  env_len="$(printf '%s' "${COUCH_PASSWORD}" | wc -c)"
  container_len="$(printf '%s' "${container_pass}" | wc -c)"
  echo "  expected len=${env_len}, container len=${container_len}"
  if [[ "${env_len}" != "${container_len}" || "${COUCHDB_PASSWORD}" != "${container_pass}" ]]; then
    echo "  MISMATCH — compose ate \$VAR in the password (use couchdb-exporter.env with \$\$ escapes)"
    echo "  Fix: re-run bootstrap.sh, then: docker compose up -d --force-recreate couchdb-exporter"
  fi

  net="$(docker inspect "$cid" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}')"
  if [[ -n "$net" ]]; then
    echo
    echo "=== Curl from compose network '${net}' (same path as exporter) ==="
    stats_url="${url%/}/_stats"
    net_code="$(docker run --rm --network "$net" curlimages/curl:8.5.0 \
      -sS -o /dev/null -w '%{http_code}' \
      -u "${user}:${pass}" \
      "$stats_url" 2>/dev/null || echo "000")"
    echo "  GET ${stats_url} → HTTP ${net_code}"
    if [[ "$net_code" == "200" ]]; then
      echo "  CouchDB reachable with container creds"
    elif [[ "$code" == "200" && "$net_code" != "200" ]]; then
      echo "  Host OK but compose network failed — check COUCHDB_URI / DNS / egress"
    fi
  fi

  echo
  echo "=== Exporter logs (last 20 lines) ==="
  docker compose logs couchdb-exporter --tail 20 2>/dev/null || true
fi

echo
echo "If host curl is 200 but exporter still 401, recreate the container:"
echo "  cd ${INSTALL_DIR} && docker compose up -d --force-recreate couchdb-exporter"
