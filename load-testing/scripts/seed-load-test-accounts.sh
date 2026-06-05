#!/usr/bin/env bash
# Seed pre-provisioned load-test users in CouchDB and print LOAD_TEST_ACCOUNTS for .env.
# Users only — does NOT initialise or migrate databases (see api seedLoadTestAccounts.ts).
#
# Requires API CouchDB env (COUCHDB_*). Copy api/.env.dist → api/.env or set vars in
# load-testing/scripts/.env (see .env.example).
#
# Usage:
#   ./seed-load-test-accounts.sh
#   LOAD_TEST_SEED_COUNT=8 LOAD_TEST_PROJECT_ID=abc123 ./seed-load-test-accounts.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
API_DIR="${REPO_ROOT}/api"
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -z "${LOAD_TEST_PROJECT_ID:-}" && -n "${NOTEBOOK_PROJECT_ID:-}" ]]; then
  export LOAD_TEST_PROJECT_ID="$NOTEBOOK_PROJECT_ID"
fi

if [[ -z "${LOAD_TEST_PROJECT_ID:-}" ]]; then
  echo "Set LOAD_TEST_PROJECT_ID or NOTEBOOK_PROJECT_ID (notebook project id)." >&2
  exit 1
fi

API_ENV="${API_DIR}/.env"
if [[ ! -f "$API_ENV" ]]; then
  echo "Missing ${API_ENV} — copy api/.env.dist and configure CouchDB." >&2
  exit 1
fi

cd "$API_DIR"
pnpm exec env-cmd -f "$API_ENV" env-cmd -f "$ENV_FILE" pnpm run seed-load-test-accounts
