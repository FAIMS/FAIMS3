#!/usr/bin/env bash
# Build an app/.env from a FAIMS core.json (the shared deployment config).
#
# The VITE_* values come from @faims3/build-config's generator - the same
# env contract the CDK front-end bundling and the app/web builds use - so
# there is no second hand-maintained mapping here. Intended for a sideloaded
# Android debug APK against an environment's deployed Conductor.
#
# Usage (from anywhere):
#   ./scripts/build-dev-app-env.sh <core.json> [-o OUTPUT] [--build-apk] [--deploy]
#
# Examples:
#   ./scripts/build-dev-app-env.sh ../../config/dev/core.json
#   ./scripts/build-dev-app-env.sh ../../config/dev/core.json -o ../../app/.env
#   ./scripts/build-dev-app-env.sh /path/to/config-repo/configs/dev/core.json --build-apk
#
# The core.json is the non-secret config (usually pulled from the private
# config repo with scripts/sync-deployment-config.sh pull dev into the
# repo-root config/ mirror, or a migration-script output) and
# is not committed here. If the environment's secrets.json is needed (map
# keys are already in core; auth/SMTP secrets are server-side), merge it
# first:  jq -s '.[0] * .[1]' core.json secrets.json > merged.json
#
# --build-apk runs ./scripts/build-dev-debug-apk.sh against the written env
# (Capacitor sync + Gradle assembleDebug). That script needs pnpm, Java 21,
# and ANDROID_HOME. --deploy implies --build-apk and then app/adb-install.sh.
# When the output path is app/.env, that file is restored after the APK build
# (and optional deploy) — original contents if it existed, otherwise removed —
# so the working tree is unchanged. Without --build-apk the generated file is
# left in place. Do not set CAP_ANDROID_ADB_FORWARD or CAP_SERVER_URL.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CDK_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
APP_DIR="${REPO_ROOT}/app"

usage() {
  sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

CONFIG_FILE=""
OUTPUT_FILE="${APP_DIR}/.env"
BUILD_APK=0
DEPLOY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage 0
      ;;
    -o|--output)
      OUTPUT_FILE="$2"
      shift 2
      ;;
    --build-apk)
      BUILD_APK=1
      shift
      ;;
    --deploy)
      DEPLOY=1
      BUILD_APK=1
      shift
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage 1
      ;;
    *)
      if [[ -z "$CONFIG_FILE" ]]; then
        CONFIG_FILE="$1"
      else
        echo "Unexpected argument: $1" >&2
        usage 1
      fi
      shift
      ;;
  esac
done

if [[ -z "$CONFIG_FILE" ]]; then
  echo "Error: core.json path is required." >&2
  echo "" >&2
  usage 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is not installed." >&2
  exit 1
fi

resolve_config() {
  local p="$1"
  if [[ -f "$p" ]]; then
    (cd "$(dirname "$p")" && printf '%s/%s\n' "$(pwd)" "$(basename "$p")")
    return 0
  fi
  if [[ -f "${CDK_DIR}/${p}" ]]; then
    (cd "$(dirname "${CDK_DIR}/${p}")" && printf '%s/%s\n' "$(pwd)" "$(basename "$p")")
    return 0
  fi
  return 1
}

if ! CONFIG_ABS="$(resolve_config "$CONFIG_FILE")"; then
  echo "Error: config file not found: $CONFIG_FILE" >&2
  echo "Tried cwd and ${CDK_DIR}/" >&2
  exit 1
fi

if ! jq -e . "$CONFIG_ABS" >/dev/null 2>&1; then
  echo "Error: ${CONFIG_ABS} is not valid JSON." >&2
  exit 1
fi

# A core.json is recognised by its shared groups (android.appId drives both
# VITE_APP_ID and the Gradle APP_ID; branding drives the app name/theme).
if ! jq -e '
  (.android.appId | type == "string" and length > 0)
  and (.branding.appName | type == "string" and length > 0)
' "$CONFIG_ABS" >/dev/null; then
  echo "Error: ${CONFIG_ABS} does not look like a core.json (need android.appId, branding.appName)." >&2
  echo "Note: this script now takes core.json, not a legacy combined CDK config." >&2
  exit 1
fi

echo "Config: ${CONFIG_ABS}" >&2
echo "Output: ${OUTPUT_FILE}" >&2

APP_ID="$(jq -r '.android.appId' "$CONFIG_ABS")"

# Generate the apps env from the canonical contract. Run from the repo root
# so pnpm resolves the workspace package. The generator validates the
# config (including domain endpoint derivation) before emitting anything.
GENERATED_ENV="$(cd "$REPO_ROOT" && pnpm --filter=@faims3/build-config run --silent generate -- --config "$CONFIG_ABS" --platform apps)"

OUTPUT_PARENT="$(dirname "$OUTPUT_FILE")"
mkdir -p "$OUTPUT_PARENT"
if [[ "$OUTPUT_FILE" != /* ]]; then
  OUTPUT_FILE="$(cd "$OUTPUT_PARENT" && pwd)/$(basename "$OUTPUT_FILE")"
fi
APP_ENV="${APP_DIR}/.env"

# --build-apk/--deploy needs the generated file at app/.env for Vite. Put the
# original back afterwards (or delete the generated file if there was none).
RESTORE_APP_ENV=0
HAD_ORIGINAL_APP_ENV=0
APP_ENV_BACKUP=""
restore_app_env() {
  trap - EXIT
  if ((RESTORE_APP_ENV)); then
    if ((HAD_ORIGINAL_APP_ENV)); then
      if ! cp -a "$APP_ENV_BACKUP" "$APP_ENV"; then
        echo "Error: failed to restore ${APP_ENV}; backup left at ${APP_ENV_BACKUP}" >&2
        return
      fi
      echo "Restored original ${APP_ENV}" >&2
    else
      rm -f "$APP_ENV"
      echo "Removed generated ${APP_ENV} (no original to restore)" >&2
    fi
  fi
  if [[ -n "${APP_ENV_BACKUP:-}" ]]; then
    rm -f "$APP_ENV_BACKUP"
  fi
}

if ((BUILD_APK)) && [[ "$OUTPUT_FILE" == "$APP_ENV" ]]; then
  if [[ -e "$APP_ENV" ]]; then
    APP_ENV_BACKUP="$(mktemp)"
    cp -a "$APP_ENV" "$APP_ENV_BACKUP"
    HAD_ORIGINAL_APP_ENV=1
    echo "Backed up ${APP_ENV} (will restore after APK build)" >&2
  else
    echo "${APP_ENV} does not exist; generated file will be removed after APK build" >&2
  fi
  RESTORE_APP_ENV=1
  trap restore_app_env EXIT
fi

{
  echo "# Generated by infrastructure/aws-cdk/scripts/build-dev-app-env.sh"
  echo "# Config: ${CONFIG_ABS}"
  echo "# Generated at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "#"
  echo "# Sideloaded Android debug APK against this environment's deployed Conductor."
  echo "# Review before use. Do not set CAP_ANDROID_ADB_FORWARD or CAP_SERVER_URL."
  echo "#"

  echo "# ---------------------------------------------------------------------------"
  echo "# From @faims3/build-config (canonical apps env for this core.json)"
  echo "# ---------------------------------------------------------------------------"
  # APP_ID is not a Vite key; android/app/build.gradle reads it for applicationId.
  # Keep it identical to VITE_APP_ID so the Capacitor scheme and Conductor
  # REDIRECT_WHITELIST (\${appId}://) line up. The generator also emits APP_ID;
  # emit it first and let the generated copy stand.
  printf '%s\n' "$GENERATED_ENV" | grep -E '^[A-Z0-9_]+=' || true
  echo ""

  # Debug flags: the deployed CloudFront app is debug-off; this script is
  # for a sideloaded debug APK, so default DEBUG_APP on. The generator emits
  # VITE_DEBUG_APP=false from core.dev - override it here (later wins in
  # the app's env parsing? No: .env duplicates are first-wins in Vite, so
  # note the manual step instead of emitting a shadowed duplicate).
  echo "# ---------------------------------------------------------------------------"
  echo "# SUGGESTION (not in CDK): debug flags for a sideloaded APK"
  echo "# Deployed site uses VITE_DEBUG_APP=false / VITE_DEBUG_POUCHDB=false."
  echo "# To debug, edit the generated VITE_DEBUG_APP line above to true."
  echo "# ---------------------------------------------------------------------------"
  echo ""
  echo "# ---------------------------------------------------------------------------"
  echo "# Do NOT set these for a sideloaded APK against the deployed server:"
  echo "#   CAP_ANDROID_ADB_FORWARD=true"
  echo "#   CAP_SERVER_URL=http://localhost:3000"
  echo "# Those make Capacitor load the Vite dev server instead of the bundle."
  echo "# ---------------------------------------------------------------------------"
} >"$OUTPUT_FILE"

echo "" >&2
echo "Wrote $(wc -l <"$OUTPUT_FILE") lines to ${OUTPUT_FILE}" >&2
echo "App id:    ${APP_ID}  (also APP_ID for Gradle)" >&2

if ((BUILD_APK)); then
  echo "" >&2
  echo "Building debug APK via ${SCRIPT_DIR}/build-dev-debug-apk.sh" >&2
  apk_args=(-e "$OUTPUT_FILE")
  if ((DEPLOY)); then
    apk_args+=(--deploy)
  fi
  # Do not exec: restore_app_env must run after the APK build / deploy.
  "${SCRIPT_DIR}/build-dev-debug-apk.sh" "${apk_args[@]}"
fi
