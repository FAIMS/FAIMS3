#!/bin/bash

# Thin wrapper around generate-build-config for local .env files.
# Covered by scripts/test/deployment-scripts.test.sh (missing-file path).
# generate .env files for all apps from the shared config JSON

if [ ! -f `pwd`/config/dev/core.json ]; then
  echo "Config file not found: `pwd`/config/dev/core.json"
  exit 1
fi
pnpm generate-build-config --config `pwd`/config/dev/core.json --platform api --out `pwd`/api/.env
pnpm generate-build-config --config `pwd`/config/dev/core.json --platform apps --out `pwd`/app/.env
pnpm generate-build-config --config `pwd`/config/dev/core.json --platform apps --out `pwd`/web/.env
pnpm generate-build-config --config `pwd`/config/dev/core.json --platform apps --out `pwd`/docs/.env
