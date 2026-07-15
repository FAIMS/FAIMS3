#!/usr/bin/env bash
#
# Build a sideloadable Android APK from the FAIMS3 Capacitor app.
#
# Usage:
#   cp app/scripts/.env.example app/scripts/.env   # first time only
#   ./app/scripts/build-android-apk.sh
#
# Requires: Node 24, pnpm, Java 21, Android SDK (ANDROID_HOME), and Gradle
# wrapper at app/android/gradlew.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
APP_DIR="$(cd -- "${SCRIPT_DIR}/.." &>/dev/null && pwd)"
REPO_ROOT="$(cd -- "${APP_DIR}/.." &>/dev/null && pwd)"
ANDROID_DIR="${APP_DIR}/android"

ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/.env}"

log() {
  printf '==> %s\n' "$*"
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  if ! command -v "$1" &>/dev/null; then
    die "Required command not found on PATH: $1"
  fi
}

is_truthy() {
  case "${1,,}" in
    true | 1 | yes | on) return 0 ;;
    *) return 1 ;;
  esac
}

load_env_file() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    die "Env file not found: ${ENV_FILE}
Copy the example and edit it:
  cp ${SCRIPT_DIR}/.env.example ${SCRIPT_DIR}/.env"
  fi

  log "Loading environment from ${ENV_FILE}"

  # Source line-by-line so we can give a clear error for unquoted spaces.
  set -a
  local line_number=0
  while IFS= read -r line || [[ -n "${line}" ]]; do
    line_number=$((line_number + 1))
    [[ "${line}" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line//[[:space:]]/}" ]] && continue

    if [[ "${line}" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      # shellcheck disable=SC2163
      eval "export ${line}"
    else
      die "${ENV_FILE}:${line_number}: invalid env line (quote values containing spaces): ${line}"
    fi
  done < "${ENV_FILE}"
  set +a
}

validate_required_vars() {
  local missing=()

  [[ -n "${VITE_APP_ID:-}" ]] || missing+=("VITE_APP_ID")
  [[ -n "${VITE_APP_NAME:-}" ]] || missing+=("VITE_APP_NAME")
  [[ -n "${VITE_CONDUCTOR_URL:-}" ]] || missing+=("VITE_CONDUCTOR_URL")
  [[ -n "${VITE_THEME:-}" ]] || missing+=("VITE_THEME")

  if ((${#missing[@]} > 0)); then
    die "Missing required variables in ${ENV_FILE}: ${missing[*]}"
  fi

  export APP_ID="${APP_ID:-${VITE_APP_ID}}"

  if [[ -z "${VITE_COMMIT_VERSION:-}" ]]; then
    if command -v git &>/dev/null && git -C "${REPO_ROOT}" rev-parse --is-inside-work-tree &>/dev/null; then
      local sha_short
      sha_short="$(git -C "${REPO_ROOT}" rev-parse --short HEAD)"
      export VITE_COMMIT_VERSION="local-android-$(date +%Y%m%d)-${sha_short}"
      log "VITE_COMMIT_VERSION not set; using ${VITE_COMMIT_VERSION}"
    else
      export VITE_COMMIT_VERSION="local-android-build"
      log "VITE_COMMIT_VERSION not set; using ${VITE_COMMIT_VERSION}"
    fi
  fi

  export VITE_TAG="${VITE_TAG:-prodAndroid}"
  export BUILD_TYPE="${BUILD_TYPE:-debug}"
  export PNPM_FROZEN_LOCKFILE="${PNPM_FROZEN_LOCKFILE:-true}"
}

check_prerequisites() {
  require_command node
  require_command pnpm

  local node_major
  node_major="$(node -p "process.versions.node.split('.')[0]")"
  if [[ "${node_major}" -lt 24 ]]; then
    die "Node 24+ is required (found Node $(node -v)). See package.json engines."
  fi

  if [[ -z "${JAVA_HOME:-}" ]]; then
    if command -v java &>/dev/null; then
      log "JAVA_HOME is not set; relying on java on PATH: $(command -v java)"
    else
      die "Java is required. Install JDK 21 and set JAVA_HOME."
    fi
  fi

  if [[ -z "${ANDROID_HOME:-}" && -z "${ANDROID_SDK_ROOT:-}" ]]; then
    die "ANDROID_HOME or ANDROID_SDK_ROOT must be set to your Android SDK path."
  fi

  [[ -x "${ANDROID_DIR}/gradlew" ]] || die "Gradle wrapper not found: ${ANDROID_DIR}/gradlew"
}

run_pnpm_install() {
  if is_truthy "${SKIP_INSTALL:-false}"; then
    log "Skipping pnpm install (SKIP_INSTALL=true)"
    return
  fi

  log "Installing dependencies at repo root"
  cd "${REPO_ROOT}"
  if is_truthy "${PNPM_FROZEN_LOCKFILE}"; then
    pnpm install --frozen-lockfile
  else
    pnpm install
  fi
}

run_turbo_build() {
  if is_truthy "${SKIP_TURBO_BUILD:-false}"; then
    log "Skipping turbo build (SKIP_TURBO_BUILD=true)"
    return
  fi

  log "Building workspace packages for @faims3/app"
  cd "${REPO_ROOT}"
  pnpm exec turbo build --filter=@faims3/app --force
}

run_cap_update() {
  if is_truthy "${SKIP_CAP_UPDATE:-false}"; then
    log "Skipping cap update (SKIP_CAP_UPDATE=true)"
    return
  fi

  log "Updating Capacitor Android native dependencies"
  cd "${APP_DIR}"
  pnpm run app-update android
}

run_cap_sync() {
  if is_truthy "${SKIP_CAP_SYNC:-false}"; then
    log "Skipping cap sync (SKIP_CAP_SYNC=true)"
    return
  fi

  # Web assets were already built by turbo with the exported VITE_* env;
  # this only copies/syncs them into the Android project.
  log "Syncing web assets into Android project"
  cd "${APP_DIR}"
  pnpm run webapp-sync -- android
}

run_gradle_assemble() {
  if is_truthy "${SKIP_GRADLE:-false}"; then
    log "Skipping Gradle assemble (SKIP_GRADLE=true)"
    return
  fi

  local build_type gradle_task apk_path

  build_type="${BUILD_TYPE,,}"
  case "${build_type}" in
    debug)
      gradle_task="assembleDebug"
      apk_path="${ANDROID_DIR}/app/build/outputs/apk/debug/app-debug.apk"
      ;;
    release)
      gradle_task="assembleRelease"
      apk_path="${ANDROID_DIR}/app/build/outputs/apk/release/app-release.apk"
      ;;
    *)
      die "BUILD_TYPE must be 'debug' or 'release' (got: ${BUILD_TYPE})"
      ;;
  esac

  log "Running Gradle ${gradle_task} (APP_ID=${APP_ID})"
  cd "${ANDROID_DIR}"

  if [[ "${build_type}" == "release" ]]; then
    [[ -n "${JAVA_KEYSTORE:-}" ]] || die "BUILD_TYPE=release requires JAVA_KEYSTORE in ${ENV_FILE}"
    [[ -n "${JAVA_KEYSTORE_PASSWORD:-}" ]] || die "BUILD_TYPE=release requires JAVA_KEYSTORE_PASSWORD"
    [[ -n "${JAVA_KEY:-}" ]] || die "BUILD_TYPE=release requires JAVA_KEY"
    [[ -n "${JAVA_KEY_PASSWORD:-}" ]] || die "BUILD_TYPE=release requires JAVA_KEY_PASSWORD"

    ./gradlew "clean" "${gradle_task}" \
      -PversionCode="$(date +%s)" \
      -PversionName="${VITE_COMMIT_VERSION}" \
      -Pandroid.injected.signing.store.file="${JAVA_KEYSTORE}" \
      -Pandroid.injected.signing.store.password="${JAVA_KEYSTORE_PASSWORD}" \
      -Pandroid.injected.signing.key.alias="${JAVA_KEY}" \
      -Pandroid.injected.signing.key.password="${JAVA_KEY_PASSWORD}"
  else
    ./gradlew "clean" "${gradle_task}" \
      -PversionCode="$(date +%s)" \
      -PversionName="${VITE_COMMIT_VERSION}"
  fi

  if [[ -f "${apk_path}" ]]; then
    log "APK ready: ${apk_path}"
    log "Install with: adb install -r ${apk_path}"
  else
    die "Expected APK not found at ${apk_path}"
  fi
}

main() {
  load_env_file
  validate_required_vars
  check_prerequisites

  log "Building Android APK"
  log "  App:       ${VITE_APP_NAME} (${APP_ID})"
  log "  Conductor: ${VITE_CONDUCTOR_URL}"
  log "  Theme:     ${VITE_THEME}"
  log "  Type:      ${BUILD_TYPE}"

  run_pnpm_install
  run_turbo_build
  run_cap_update
  run_cap_sync
  run_gradle_assemble

  log "Done"
}

main "$@"
