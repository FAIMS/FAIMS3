#!/usr/bin/env bash
# Write couchdb-exporter.env for docker compose (gesellix COUCHDB_* vars).
# Compose interpolates $ in env_file values — passwords must use $$ for a literal $.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing ${ROOT}/.env — copy .env.example first" >&2
  exit 1
fi

read_dotenv() {
  local key=$1
  local default=${2:-}
  local line raw
  line="$(grep -m1 "^${key}=" .env 2>/dev/null || true)"
  if [[ -z "$line" ]]; then
    printf '%s' "$default"
    return
  fi
  raw="${line#*=}"
  if [[ "$raw" == \"*\" ]]; then
    printf '%s' "$raw" | jq -r . 2>/dev/null || printf '%s' "${raw:1:-1}"
  else
    printf '%s' "$raw"
  fi
}

escape_compose_dollar() {
  sed 's/\$/$$/g'
}

append_env_var() {
  local file=$1 key=$2 value=$3
  jq -rn --arg k "$key" --arg v "$value" '"\($k)=\($v | @json)"' >>"$file"
}

url="$(read_dotenv COUCHDB_EXPORTER_URL "http://host.docker.internal:5984")"
user="$(read_dotenv COUCHDB_USERNAME "$(read_dotenv COUCH_USER admin)")"
pass="$(read_dotenv COUCHDB_PASSWORD "$(read_dotenv COUCH_PASSWORD)")"

if [[ -z "$pass" ]]; then
  echo "Set COUCH_PASSWORD (or COUCHDB_PASSWORD) in .env" >&2
  exit 1
fi

: >couchdb-exporter.env
append_env_var couchdb-exporter.env COUCHDB_URI "$url"
append_env_var couchdb-exporter.env COUCHDB_USERNAME "$user"
compose_pass="$(printf '%s' "$pass" | escape_compose_dollar)"
append_env_var couchdb-exporter.env COUCHDB_PASSWORD "$compose_pass"

chmod 600 couchdb-exporter.env
