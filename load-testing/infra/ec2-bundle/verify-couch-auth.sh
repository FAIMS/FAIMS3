#!/bin/bash
# Debug CouchDB credentials for couchdb-exporter on the metrics host.
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/loadtest}"
cd "$INSTALL_DIR"

if [[ ! -f .env ]]; then
  echo "Missing ${INSTALL_DIR}/.env — run bootstrap.sh first" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

redact() {
  sed -E 's/(COUCHDB_PASSWORD|COUCH_PASSWORD)=.*/\1=***/'
}

echo "=== .env (redacted) ==="
grep -E '^(COUCHDB_EXPORTER_URL|COUCH_USER|COUCHDB_USERNAME|COUCH_PASSWORD|COUCHDB_PASSWORD)=' .env | redact

echo
echo "=== Password lengths (characters) ==="
echo "  COUCH_PASSWORD:     $(printf '%s' "${COUCH_PASSWORD:-}" | wc -c)"
echo "  COUCHDB_PASSWORD:   $(printf '%s' "${COUCHDB_PASSWORD:-}" | wc -c)"

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
pass="${COUCHDB_PASSWORD:-${COUCH_PASSWORD:-}}"
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
  echo "=== Running container env ==="
  docker exec "$cid" sh -c '
    echo "  COUCHDB_URI=${COUCHDB_URI:-<unset>}"
    echo "  COUCHDB_USERNAME=${COUCHDB_USERNAME:-<unset>}"
    printf "  COUCHDB_PASSWORD len=%s\n" "$(printf "%s" "${COUCHDB_PASSWORD:-}" | wc -c)"
  '
fi

echo
echo "If host curl is 200 but exporter still 401, recreate the container:"
echo "  cd ${INSTALL_DIR} && docker compose up -d --force-recreate couchdb-exporter"
