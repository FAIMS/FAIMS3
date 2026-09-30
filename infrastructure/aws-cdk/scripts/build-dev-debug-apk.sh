#!/usr/bin/env bash
# Build a sideloadable Android debug APK from an app/.env (Capacitor + Gradle).
#
# Intended to consume the file written by build-dev-app-env.sh. Builds the Vite
# app with that env, runs `cap sync android`, then `assembleDebug`. Does not
# enable Capacitor live-reload (CAP_ANDROID_ADB_FORWARD / CAP_SERVER_URL are
# cleared so the APK embeds the bundle and talks to the deployed Conductor).
#
# Usage (from infrastructure/aws-cdk):
#   ./scripts/build-dev-debug-apk.sh [-e ENV_FILE] [--deploy]
#
# Examples:
#   ./scripts/build-dev-debug-apk.sh
#   ./scripts/build-dev-debug-apk.sh -e ../../app/.env
#   ./scripts/build-dev-debug-apk.sh --deploy
#
# Requires: pnpm, Java 21, Android SDK (ANDROID_HOME or ANDROID_SDK_ROOT, or
# app/android/local.properties). Uses the Android debug keystore — no Play
# signing key. Repo dependencies must already be installed (`pnpm install`).
#
# --deploy runs app/adb-install.sh (adb install -r) after a successful build.
#
# Output:
#   app/android/app/build/outputs/apk/debug/app-debug.apk

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
APP_DIR="${REPO_ROOT}/app"
ANDROID_DIR="${APP_DIR}/android"
APK_PATH="${ANDROID_DIR}/app/build/outputs/apk/debug/app-debug.apk"

usage() {
  sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

ENV_FILE="${APP_DIR}/.env"
DEPLOY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage 0
      ;;
    -e|--env)
      ENV_FILE="$2"
      shift 2
      ;;
    --deploy)
      DEPLOY=1
      shift
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage 1
      ;;
    *)
      echo "Unexpected argument: $1" >&2
      usage 1
      ;;
  esac
done

resolve_path() {
  local p="$1"
  if [[ -f "$p" ]]; then
    (cd "$(dirname "$p")" && printf '%s/%s\n' "$(pwd)" "$(basename "$p")")
    return 0
  fi
  if [[ -f "${APP_DIR}/${p}" ]]; then
    (cd "$(dirname "${APP_DIR}/${p}")" && printf '%s/%s\n' "$(pwd)" "$(basename "$p")")
    return 0
  fi
  return 1
}

if ! ENV_ABS="$(resolve_path "$ENV_FILE")"; then
  echo "Error: env file not found: ${ENV_FILE}" >&2
  echo "Generate one first: ./scripts/build-dev-app-env.sh configs/dev.json" >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "Error: pnpm is not installed." >&2
  exit 1
fi

if [[ ! -d "${REPO_ROOT}/node_modules" && ! -d "${APP_DIR}/node_modules" ]]; then
  echo "Error: dependencies are not installed. From the repo root run: pnpm install" >&2
  exit 1
fi

if ! command -v java >/dev/null 2>&1; then
  echo "Error: java is not installed. Need Java 21 (see app/adb-guide.md)." >&2
  exit 1
fi

if [[ ! -x "${ANDROID_DIR}/gradlew" ]]; then
  echo "Error: ${ANDROID_DIR}/gradlew is missing or not executable." >&2
  exit 1
fi

if [[ -z "${ANDROID_HOME:-}" && -z "${ANDROID_SDK_ROOT:-}" && ! -f "${ANDROID_DIR}/local.properties" ]]; then
  echo "Error: Android SDK not found. Set ANDROID_HOME (or ANDROID_SDK_ROOT), or create" >&2
  echo "  ${ANDROID_DIR}/local.properties with sdk.dir=..." >&2
  echo "See app/adb-guide.md." >&2
  exit 1
fi

if [[ -n "${ANDROID_HOME:-}" && -z "${ANDROID_SDK_ROOT:-}" ]]; then
  export ANDROID_SDK_ROOT="${ANDROID_HOME}"
fi

echo "Env:     ${ENV_ABS}" >&2
echo "App dir: ${APP_DIR}" >&2

# Load KEY=value from the generated .env so Vite, env-cmd --no-override, and
# Gradle all see the same values even if ENV_FILE is not app/.env.
set -a
# shellcheck disable=SC1090
source "${ENV_ABS}"
set +a

# Live-reload would point the WebView at localhost instead of the bundled build.
unset CAP_ANDROID_ADB_FORWARD CAP_SERVER_URL

if [[ -z "${VITE_CONDUCTOR_URL:-}" ]]; then
  echo "Error: ${ENV_ABS} has no VITE_CONDUCTOR_URL." >&2
  exit 1
fi

if [[ -z "${APP_ID:-}" && -n "${VITE_APP_ID:-}" ]]; then
  APP_ID="${VITE_APP_ID}"
fi
if [[ -z "${APP_ID:-}" ]]; then
  echo "Error: ${ENV_ABS} has no APP_ID or VITE_APP_ID (Gradle applicationId)." >&2
  exit 1
fi
export APP_ID

echo "Conductor: ${VITE_CONDUCTOR_URL}" >&2
echo "App id:    ${APP_ID}" >&2
echo "" >&2

echo "==> Building @faims3/app (Vite + Capacitor prebuild from env)" >&2
pnpm --dir "${REPO_ROOT}" --filter=@faims3/app run build

echo "" >&2
echo "==> Capacitor sync android" >&2
pnpm --dir "${REPO_ROOT}" --filter=@faims3/app run webapp-sync -- android

echo "" >&2
echo "==> Gradle assembleDebug (APP_ID=${APP_ID})" >&2
(
  cd "${ANDROID_DIR}"
  ./gradlew assembleDebug
)

if [[ ! -f "${APK_PATH}" ]]; then
  echo "Error: Gradle finished but APK is missing: ${APK_PATH}" >&2
  exit 1
fi

echo "" >&2
echo "Debug APK: ${APK_PATH}" >&2

if ((DEPLOY)); then
  echo "" >&2
  echo "Installing via ${APP_DIR}/adb-install.sh" >&2
  exec "${APP_DIR}/adb-install.sh" "${APK_PATH}"
fi

echo "Install:   ${APP_DIR}/adb-install.sh" >&2
echo "       or: adb install -r ${APK_PATH}" >&2
