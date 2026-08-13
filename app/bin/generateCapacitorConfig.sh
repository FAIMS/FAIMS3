#!/bin/bash
# Generate capacitor.config.json from capacitor.config.dist.json.
# Substitutes VITE_APP_NAME / VITE_APP_ID, and optionally enables live-reload
# ADB settings when CAP_ANDROID_ADB_FORWARD=true or CAP_SERVER_URL is set.

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
PROJECT_DIR="${SCRIPT_DIR}/../"
cd "${PROJECT_DIR}"

APP_NAME="${VITE_APP_NAME:-APPNAME}"
APP_ID="${VITE_APP_ID:-org.fedarch.faims3}"

if [ ! -f ./capacitor.config.dist.json ]; then
  echo "Error: capacitor.config.dist.json not found in ${PROJECT_DIR}"
  exit 1
fi

echo "Generating capacitor.config.json (appName=${APP_NAME}, appId=${APP_ID})"

jq \
  --arg appName "${APP_NAME}" \
  --arg appId "${APP_ID}" \
  '
    .appId = $appId
    | .appName = $appName
    | .server.iosScheme = $appId
  ' \
  ./capacitor.config.dist.json >./capacitor.config.json

# Optional live-reload / ADB-forward server settings (used by ./dev-adb.sh)
if [ "${CAP_ANDROID_ADB_FORWARD:-}" = "true" ] || [ -n "${CAP_SERVER_URL:-}" ]; then
  DEV_SERVER_URL="${CAP_SERVER_URL:-http://localhost:3000}"
  echo "Enabling Capacitor live-reload server at ${DEV_SERVER_URL}"
  jq --arg url "${DEV_SERVER_URL}" '
    .plugins.CapacitorHttp.enabled = true
    | .server.url = $url
    | .server.cleartext = true
  ' ./capacitor.config.json >./capacitor.config.json.tmp
  mv ./capacitor.config.json.tmp ./capacitor.config.json
fi
