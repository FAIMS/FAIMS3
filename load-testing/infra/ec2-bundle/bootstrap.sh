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

# Write .env values with jq @json so passwords containing =, #, $, etc. stay intact.
append_env_var() {
  local key=$1 value=$2
  jq -n --arg k "$key" --arg v "$value" '"\($k)=\($v | @json)"' >> .env
}

: > .env
append_env_var COUCHDB_EXPORTER_URL "$COUCHDB_EXPORTER_URL"
append_env_var COUCH_USER "$COUCH_USER"
append_env_var COUCHDB_EXPORTER_VERSION "${COUCHDB_EXPORTER_VERSION:-latest}"
append_env_var PROMETHEUS_PORT "${PROMETHEUS_PORT:-9090}"
append_env_var PUSHGATEWAY_PORT "${PUSHGATEWAY_PORT:-9091}"
append_env_var GRAFANA_PORT "${GRAFANA_PORT:-3030}"
append_env_var COUCHDB_EXPORTER_PORT "${COUCHDB_EXPORTER_PORT:-9984}"

if [[ -n "${COUCH_PASSWORD_SECRET_ARN:-}" ]]; then
  COUCH_PASSWORD="$(aws secretsmanager get-secret-value \
    --secret-id "$COUCH_PASSWORD_SECRET_ARN" \
    --query SecretString \
    --output text | jq -r .password)"
elif [[ -n "${COUCH_PASSWORD:-}" ]]; then
  :
else
  echo "Set COUCH_PASSWORD or COUCH_PASSWORD_SECRET_ARN before running bootstrap" >&2
  exit 1
fi

if [[ -z "${COUCH_PASSWORD}" ]]; then
  echo "COUCH_PASSWORD is empty after resolving credentials" >&2
  exit 1
fi

append_env_var COUCH_PASSWORD "$COUCH_PASSWORD"

chmod -R a+rX "$INSTALL_DIR"

echo "Bootstrap complete."
echo "  cd ${INSTALL_DIR} && docker compose up -d"
if [[ -n "${METRICS_FQDN:-}" ]]; then
  echo "  Grafana: http://${METRICS_FQDN}:3030"
fi
