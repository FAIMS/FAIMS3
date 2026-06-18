#!/bin/bash
# Rewrite couchdb-exporter.env and remove COUCH_PASSWORD from project .env.
# Project .env is auto-loaded by docker compose — any $ in values is interpolated.
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/loadtest}"
cd "$INSTALL_DIR"

append_env_var() {
  local file=$1 key=$2 value=$3
  jq -rn --arg k "$key" --arg v "$value" '"\($k)=\($v | @json)"' >>"$file"
}

escape_compose_dollar() {
  sed 's/\$/$$/g'
}

read_env_json() {
  local file=$1 key=$2
  grep "^${key}=" "$file" 2>/dev/null | sed "s/^${key}=//" | jq -r . 2>/dev/null || true
}

COUCHDB_EXPORTER_URL="$(read_env_json .env COUCHDB_EXPORTER_URL)"
COUCH_USER="$(read_env_json .env COUCH_USER)"

if [[ -n "${COUCH_PASSWORD_SECRET_ARN:-}" ]]; then
  secret_json="$(aws secretsmanager get-secret-value \
    --secret-id "$COUCH_PASSWORD_SECRET_ARN" \
    --query SecretString \
    --output text)"
  COUCH_PASSWORD="$(printf '%s' "$secret_json" | jq -r .password | tr -d '\r')"
  secret_user="$(printf '%s' "$secret_json" | jq -r '.username // empty')"
  if [[ -n "$secret_user" && "$secret_user" != "null" ]]; then
    COUCH_USER="$secret_user"
  fi
elif [[ -n "${COUCH_PASSWORD:-}" ]]; then
  COUCH_PASSWORD="$(printf '%s' "$COUCH_PASSWORD" | tr -d '\r')"
elif [[ -f .env ]] && grep -q '^COUCH_PASSWORD=' .env; then
  COUCH_PASSWORD="$(read_env_json .env COUCH_PASSWORD)"
elif [[ -f couchdb-exporter.env ]]; then
  raw="$(read_env_json couchdb-exporter.env COUCHDB_PASSWORD)"
  COUCH_PASSWORD="${raw//\$\$/$}"
else
  echo "Set COUCH_PASSWORD_SECRET_ARN, COUCH_PASSWORD, or keep COUCH_PASSWORD in .env" >&2
  exit 1
fi

if [[ -z "${COUCH_PASSWORD}" || "${COUCH_PASSWORD}" == "null" ]]; then
  echo "COUCH_PASSWORD is empty" >&2
  exit 1
fi

if [[ -z "${COUCHDB_EXPORTER_URL}" ]]; then
  echo "COUCHDB_EXPORTER_URL missing from .env" >&2
  exit 1
fi

if [[ -z "${COUCH_USER}" ]]; then
  COUCH_USER=admin
fi

: >couchdb-exporter.env
append_env_var couchdb-exporter.env COUCHDB_URI "$COUCHDB_EXPORTER_URL"
append_env_var couchdb-exporter.env COUCHDB_USERNAME "$COUCH_USER"
compose_pass="$(printf '%s' "$COUCH_PASSWORD" | escape_compose_dollar)"
append_env_var couchdb-exporter.env COUCHDB_PASSWORD "$compose_pass"

if [[ -f .env ]]; then
  grep -v '^COUCH_PASSWORD=' .env >.env.tmp
  mv .env.tmp .env
fi

chmod 600 couchdb-exporter.env
chown ec2-user:ec2-user couchdb-exporter.env .env 2>/dev/null || true

echo "Wrote couchdb-exporter.env and removed COUCH_PASSWORD from project .env"
echo "  Recreate exporter: cd ${INSTALL_DIR} && docker compose up -d --force-recreate couchdb-exporter"
