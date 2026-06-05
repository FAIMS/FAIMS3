#!/bin/bash
# Installed to /opt/loadtest by EC2 user-data (or run manually after fixing dnf).
set -euxo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/loadtest}"
cd "$INSTALL_DIR"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=install-docker-compose.sh
source "${SCRIPT_DIR}/install-docker-compose.sh"
install_docker_compose

: "${COUCHDB_EXPORTER_URL:?COUCHDB_EXPORTER_URL is required}"
: "${COUCH_USER:?COUCH_USER is required}"

# Write env values with jq @json so passwords containing =, #, $, etc. stay intact.
append_env_var() {
  local file=$1 key=$2 value=$3
  jq -rn --arg k "$key" --arg v "$value" '"\($k)=\($v | @json)"' >>"$file"
}

# Docker Compose interpolates $ in env_file values; $$ → literal $ in the container.
escape_compose_dollar() {
  sed 's/\$/$$/g'
}

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
else
  echo "Set COUCH_PASSWORD or COUCH_PASSWORD_SECRET_ARN before running bootstrap" >&2
  exit 1
fi

if [[ -z "${COUCH_PASSWORD}" || "${COUCH_PASSWORD}" == "null" ]]; then
  echo "COUCH_PASSWORD is empty after resolving credentials" >&2
  exit 1
fi

: >.env
: >couchdb-exporter.env
append_env_var .env COUCHDB_EXPORTER_URL "$COUCHDB_EXPORTER_URL"
append_env_var .env COUCH_USER "$COUCH_USER"
append_env_var .env COUCHDB_EXPORTER_VERSION "${COUCHDB_EXPORTER_VERSION:-latest}"
append_env_var .env PROMETHEUS_PORT "${PROMETHEUS_PORT:-9090}"
append_env_var .env PUSHGATEWAY_PORT "${PUSHGATEWAY_PORT:-9091}"
append_env_var .env GRAFANA_PORT "${GRAFANA_PORT:-3030}"
append_env_var .env COUCHDB_EXPORTER_PORT "${COUCHDB_EXPORTER_PORT:-9984}"
# Never write COUCH_PASSWORD to project .env — compose auto-loads it and interpolates $VAR.

# gesellix creds live in couchdb-exporter.env ($ escaped as $$ for compose env_file).
append_env_var couchdb-exporter.env COUCHDB_URI "$COUCHDB_EXPORTER_URL"
append_env_var couchdb-exporter.env COUCHDB_USERNAME "$COUCH_USER"
compose_pass="$(printf '%s' "$COUCH_PASSWORD" | escape_compose_dollar)"
append_env_var couchdb-exporter.env COUCHDB_PASSWORD "$compose_pass"

chmod 600 couchdb-exporter.env
chmod 644 .env
chown -R ec2-user:ec2-user "$INSTALL_DIR"
chmod -R a+rX "$INSTALL_DIR"
chmod 600 couchdb-exporter.env

echo "Bootstrap complete."
echo "  Observability: cd ${INSTALL_DIR} && docker compose up -d"
if [[ -n "${METRICS_FQDN:-}" ]]; then
  echo "  Grafana: http://${METRICS_FQDN}:3030"
fi
