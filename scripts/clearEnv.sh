#!/usr/bin/env bash
# Reset local-dev env/secrets to a clean slate (inverse of localdev setup).
# Does not touch CouchDB data — use scripts/clearCouchDb.sh for that.
# Does not touch deploy/ops env files (e.g. infrastructure/aws-cdk/scripts/.env).

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$ROOT"

remove() {
  local path="$1"
  if [ -e "$path" ] || [ -L "$path" ]; then
    echo "Removing ${path}"
    rm -rf "$path"
  else
    echo "Skip (missing): ${path}"
  fi
}

echo "Clearing local-dev env and generated secrets from ${ROOT}"

# Env files created from .env.dist during local setup
for f in \
  .env \
  api/.env \
  web/.env \
  app/.env \
  e2e/.env \
  docs/.env \
  api/api_testing/.env
do
  remove "$f"
done

# Other generated api env exports (keep .env.dist)
shopt -s nullglob
for f in api/.env.*; do
  base="$(basename "$f")"
  if [[ "$base" == ".env.dist" ]]; then
    continue
  fi
  remove "$f"
done
shopt -u nullglob

# Artifacts from `pnpm run generate-local-keys`
remove api/keys
remove api/couchdb/local.ini
remove api/couchdb/local.ini.bak

echo
echo "Local env/keys cleared. Recreate with:"
echo "  cp ./.env.dist ./.env"
echo "  for d in api web app e2e; do cp ./\$d/.env.dist ./\$d/.env; done"
echo "  pnpm run generate-local-keys"
echo
echo "CouchDB data is separate — use scripts/clearCouchDb.sh to wipe the DB volume."
