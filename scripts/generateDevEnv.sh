#!/bin/bash

# generate .env files for all apps from the shared config JSON

if [ ! -f `pwd`/config/dev/build-config.json ]; then
  echo "Config file not found: `pwd`/config/dev/build-config.json"
  exit 1
fi
pnpm generate-build-config --config `pwd`/config/dev/build-config.json --platform api --out `pwd`/api/.env
pnpm generate-build-config --config `pwd`/config/dev/build-config.json --platform apps --out `pwd`/app/.env
pnpm generate-build-config --config `pwd`/config/dev/build-config.json --platform apps --out `pwd`/web/.env
pnpm generate-build-config --config `pwd`/config/dev/build-config.json --platform apps --out `pwd`/docs/.env
