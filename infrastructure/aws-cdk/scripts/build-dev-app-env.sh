#!/usr/bin/env bash
# Build an app/.env from a FAIMS CDK config JSON (the same file used to deploy).
#
# Maps uiConfiguration / supportLinks / domains / bugMonitoring the same way
# infrastructure/aws-cdk/lib/components/front-end.ts does when bundling the
# CloudFront app. Intended for a sideloaded Android debug APK against that
# environment's deployed Conductor.
#
# Usage (from infrastructure/aws-cdk):
#   ./scripts/build-dev-app-env.sh <cdk-config.json> [-o OUTPUT] [--build-apk] [--deploy]
#
# Examples:
#   ./scripts/build-dev-app-env.sh configs/dev.json
#   ./scripts/build-dev-app-env.sh configs/dev.json -o ../../app/.env
#   ./scripts/build-dev-app-env.sh configs/dev.json --build-apk
#   ./scripts/build-dev-app-env.sh configs/dev.json --deploy
#
# Requires: jq. The config file is usually pulled from the private config repo
# (./config.sh pull dev) and is not committed here.
#
# --build-apk runs ./scripts/build-dev-debug-apk.sh against the written env
# (Capacitor sync + Gradle assembleDebug). That script needs pnpm, Java 21,
# and ANDROID_HOME. --deploy implies --build-apk and then app/adb-install.sh.
# Do not set CAP_ANDROID_ADB_FORWARD or CAP_SERVER_URL.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CDK_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
APP_DIR="${REPO_ROOT}/app"

usage() {
  sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'
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
  echo "Error: CDK config JSON path is required." >&2
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
  echo "Error: config file not found: ${CONFIG_FILE}" >&2
  echo "Tried cwd and ${CDK_DIR}/" >&2
  exit 1
fi

if ! jq -e . "$CONFIG_ABS" >/dev/null 2>&1; then
  echo "Error: ${CONFIG_ABS} is not valid JSON." >&2
  exit 1
fi

# Required fields that front-end.ts / ConfigSchema need to form a working app env.
if ! jq -e '
  (.domains.baseDomain | type == "string" and length > 0)
  and (.uiConfiguration.appId | type == "string" and length > 0)
  and (.uiConfiguration.appName | type == "string" and length > 0)
  and (.uiConfiguration.uiTheme | type == "string" and length > 0)
  and (.uiConfiguration.notebookName | type == "string" and length > 0)
  and (.uiConfiguration.notebookListType | type == "string" and length > 0)
' "$CONFIG_ABS" >/dev/null; then
  echo "Error: ${CONFIG_ABS} is missing required domains / uiConfiguration fields." >&2
  echo "Need: domains.baseDomain, uiConfiguration.{appId,appName,uiTheme,notebookName,notebookListType}" >&2
  exit 1
fi

echo "Config: ${CONFIG_ABS}" >&2
echo "Output: ${OUTPUT_FILE}" >&2

# Same URL shape as FaimsConductor.conductorEndpoint (https://host:443).
DERIVED_JSON="$(jq -c '
  def bool_str($default):
    (if . == null then $default else . end) | if . then "true" else "false" end;
  def nonempty:
    . != null and (tostring | length) > 0;

  . as $c
  | ($c.domains.conductor // "conductor") as $cond_sub
  | $c.domains.baseDomain as $base
  | $c.uiConfiguration as $ui
  | ($ui.offlineMaps // {}) as $maps
  | ($ui.addressAutosuggest // {source: "NONE"}) as $auto
  | ($auto.source // "NONE") as $auto_source
  | {
      VITE_CONDUCTOR_URL: "https://\($cond_sub).\($base):443",
      VITE_APP_ID: $ui.appId,
      APP_ID: $ui.appId,
      VITE_APP_NAME: $ui.appName,
      VITE_HEADING_APP_NAME: ($ui.headingAppName // $ui.appName),
      VITE_THEME: $ui.uiTheme,
      VITE_NOTEBOOK_NAME: $ui.notebookName,
      VITE_NOTEBOOK_LIST_TYPE: $ui.notebookListType,
      VITE_SHOW_STATUS_TAB: ($ui.showStatusTab | bool_str(true)),
      VITE_FORCE_REMOTE_DELETION: ($ui.forceRemoteDeletion // "never"),
      VITE_DELETE_ON_DEACTIVATION: ($ui.deleteOnDeactivation | bool_str(false)),
      VITE_MAP_SOURCE: ($maps.mapSource // "maptiler"),
      VITE_MAP_STYLE: ($maps.mapStyle // "basic"),
      VITE_OFFLINE_MAPS: ($maps.offlineMaps | bool_str(false)),
      VITE_SUPPORT_EMAIL: ($c.supportLinks.supportEmail // "support@fieldmark.au"),
      VITE_APP_PRIVACY_POLICY_URL: ($c.supportLinks.privacyPolicyUrl // "https://fieldnote.au/privacy"),
      VITE_APP_CONTACT_URL: ($c.supportLinks.contactUrl // ""),
      VITE_AUTOSUGGEST_SOURCE: $auto_source
    }
  + (if ($maps.mapSourceKey | nonempty) then {VITE_MAP_SOURCE_KEY: $maps.mapSourceKey} else {} end)
  + (if ($maps.satelliteSource | nonempty) then {VITE_SATELLITE_SOURCE: $maps.satelliteSource} else {} end)
  + (if ($c.bugMonitoring.bugsnagKey | nonempty) then {VITE_BUGSNAG_KEY: $c.bugMonitoring.bugsnagKey} else {} end)
  + (if $auto_source != "NONE" then
      {}
      + (if ($auto.mapboxKey | nonempty) then {VITE_AUTOSUGGEST_MAPBOX_KEY: $auto.mapboxKey} else {} end)
      + (if ($auto.mapboxAddressCountry | nonempty) then {VITE_MAPBOX_ADDRESS_COUNTRY: $auto.mapboxAddressCountry} else {} end)
      + (if ($auto.maptilerAddressCountry | nonempty) then {VITE_MAPTILER_ADDRESS_COUNTRY: $auto.maptilerAddressCountry} else {} end)
      + (
          if $auto_source == "MAPTILER" then
            (
              if ($auto.maptilerKey | nonempty) then $auto.maptilerKey
              elif $maps.mapSource == "maptiler" and ($maps.mapSourceKey | nonempty) then $maps.mapSourceKey
              else ""
              end
            ) as $mt
            | if $mt != "" then {VITE_AUTOSUGGEST_MAPTILER_KEY: $mt} else {} end
          else {} end
        )
    else {} end)
' "$CONFIG_ABS")"

escape_env_value() {
  local v="$1"
  v="${v//\\/\\\\}"
  v="${v//$'\n'/\\n}"
  v="${v//$'\r'/}"
  v="${v//\"/\\\"}"
  printf '%s' "$v"
}

emit_env_line() {
  local key="$1"
  local value="$2"
  local force_quote="${3:-0}"
  local quote=$force_quote

  if [[ "$value" == *$'\n'* || "$value" == *$'\r'* ]]; then
    quote=1
  fi
  [[ "$value" =~ [[:space:]#] ]] && quote=1
  [[ "$value" == *\"* ]] && quote=1
  [[ "$value" == *\'* ]] && quote=1
  [[ "$value" == *'$'* ]] && quote=1

  if ((quote)); then
    printf '%s="%s"\n' "$key" "$(escape_env_value "$value")"
  else
    printf '%s=%s\n' "$key" "$value"
  fi
}

# Emit KEY if present in the derived object (including empty-string values).
emit_if_present() {
  local key="$1"
  if jq -e --arg k "$key" 'has($k)' <<<"$DERIVED_JSON" >/dev/null; then
    emit_env_line "$key" "$(jq -r --arg k "$key" '.[$k] // ""' <<<"$DERIVED_JSON")"
  fi
}

# Local git short hash for About / support mail. CDK does not store this;
# front-end.ts leaves VITE_COMMIT_VERSION unset. App schema accepts 7+ hex.
COMMIT_VERSION=""
if git -C "$REPO_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  COMMIT_VERSION="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || true)"
  if [[ ! "$COMMIT_VERSION" =~ ^[0-9a-f]{7,64}$ ]]; then
    COMMIT_VERSION=""
  fi
fi

OUTPUT_PARENT="$(dirname "$OUTPUT_FILE")"
mkdir -p "$OUTPUT_PARENT"

{
  echo "# Generated by infrastructure/aws-cdk/scripts/build-dev-app-env.sh"
  echo "# Config: ${CONFIG_ABS}"
  echo "# Generated at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "#"
  echo "# Sideloaded Android debug APK against this environment's deployed Conductor."
  echo "# Review before use. Do not set CAP_ANDROID_ADB_FORWARD or CAP_SERVER_URL."
  echo "#"

  echo "# ---------------------------------------------------------------------------"
  echo "# From CDK config (same mapping as lib/components/front-end.ts)"
  echo "# ---------------------------------------------------------------------------"
  # APP_ID is not a Vite key; android/app/build.gradle reads it for applicationId.
  # Keep it identical to VITE_APP_ID so the Capacitor scheme and Conductor
  # REDIRECT_WHITELIST (${appId}://) line up.
  emit_if_present APP_ID
  emit_if_present VITE_APP_ID
  emit_if_present VITE_APP_NAME
  emit_if_present VITE_HEADING_APP_NAME
  emit_if_present VITE_CONDUCTOR_URL
  emit_if_present VITE_THEME
  emit_if_present VITE_NOTEBOOK_NAME
  emit_if_present VITE_NOTEBOOK_LIST_TYPE
  emit_if_present VITE_SHOW_STATUS_TAB
  emit_if_present VITE_FORCE_REMOTE_DELETION
  emit_if_present VITE_DELETE_ON_DEACTIVATION
  emit_if_present VITE_SUPPORT_EMAIL
  emit_if_present VITE_APP_PRIVACY_POLICY_URL
  emit_if_present VITE_APP_CONTACT_URL
  emit_if_present VITE_MAP_SOURCE
  emit_if_present VITE_MAP_SOURCE_KEY
  emit_if_present VITE_MAP_STYLE
  emit_if_present VITE_OFFLINE_MAPS
  emit_if_present VITE_SATELLITE_SOURCE
  emit_if_present VITE_AUTOSUGGEST_SOURCE
  emit_if_present VITE_AUTOSUGGEST_MAPBOX_KEY
  emit_if_present VITE_MAPBOX_ADDRESS_COUNTRY
  emit_if_present VITE_AUTOSUGGEST_MAPTILER_KEY
  emit_if_present VITE_MAPTILER_ADDRESS_COUNTRY
  emit_if_present VITE_BUGSNAG_KEY
  echo ""

  echo "# ---------------------------------------------------------------------------"
  echo "# Hardcoded in CDK app bundling (not config keys; copied from front-end.ts)"
  echo "# ---------------------------------------------------------------------------"
  emit_env_line VITE_CLUSTER_ADMIN_GROUP_NAME cluster-admin
  emit_env_line VITE_SHOW_WIPE true
  emit_env_line VITE_SHOW_NEW_NOTEBOOK true
  emit_env_line VITE_SHOW_POUCHDB_BROWSER true
  echo ""

  # --- Missing from CDK: debug + About stamp --------------------------------
  # debugMode exists on FaimsFrontEnd but is never wired from the JSON, so the
  # deployed CloudFront app is always debug-off. This script is for a sideloaded
  # debug APK, so default DEBUG_APP on. DEBUG_POUCHDB is noisy; leave off.
  echo "# ---------------------------------------------------------------------------"
  echo "# SUGGESTION (not in CDK): debug flags for a sideloaded APK"
  echo "# Deployed site uses VITE_DEBUG_APP=false / VITE_DEBUG_POUCHDB=false."
  echo "# ---------------------------------------------------------------------------"
  emit_env_line VITE_DEBUG_APP true
  emit_env_line VITE_DEBUG_POUCHDB false
  echo ""

  echo "# ---------------------------------------------------------------------------"
  echo "# SUGGESTION (not in CDK): git commit shown on About / in support mail"
  echo "# front-end.ts leaves this unset. Local HEAD short hash if available."
  echo "# ---------------------------------------------------------------------------"
  if [[ -n "$COMMIT_VERSION" ]]; then
    emit_env_line VITE_COMMIT_VERSION "$COMMIT_VERSION"
  else
    echo "# VITE_COMMIT_VERSION="
  fi
  echo ""

  # --- Missing from CDK: app schema defaults --------------------------------
  # CDK does not set these. Values match app/src/buildconfig.ts (and therefore
  # the deployed web bundle). app/.env.dist uses breadcrumbs for local web;
  # CDK leaves VITE_NAVIGATION unset → schema default "none".
  echo "# ---------------------------------------------------------------------------"
  echo "# SUGGESTION (not in CDK): app schema defaults (matches deployed web)"
  echo "# Pouch / token timings / navigation / attachments. Edit if you need to."
  echo "# ---------------------------------------------------------------------------"
  emit_env_line VITE_POUCH_BATCH_SIZE 10
  emit_env_line VITE_POUCH_BATCHES_LIMIT 10
  emit_env_line VITE_SYNC_PUSH_ONLY_RECORD_THRESHOLD 500
  emit_env_line VITE_TOKEN_REFRESH_INTERVAL_MS 15000
  emit_env_line VITE_TOKEN_REFRESH_WINDOW_MS 60000
  emit_env_line VITE_LOGIN_BANNER_GRACE_MS 10000
  emit_env_line VITE_IGNORE_TOKEN_EXP false
  emit_env_line VITE_NAVIGATION none
  emit_env_line VITE_SHOW_RECORD_LINKS false
  emit_env_line VITE_MIGRATE_OLD_DATABASES false
  emit_env_line VITE_ATTACHMENT_SERVICE_TYPE COUCH
  echo ""

  # --- Missing from CDK: iOS / directory auth / live-reload -----------------
  # iOS signing is unused for assembleDebug. Directory auth is optional and
  # must not be filled from Conductor COUCHDB_USER/PASSWORD (server admin).
  echo "# ---------------------------------------------------------------------------"
  echo "# SUGGESTION (not in CDK): iOS-only — leave unset for an Android debug APK"
  echo "# ---------------------------------------------------------------------------"
  echo "# VITE_APPLE_BUNDLE_IDENTIFIER="
  echo "# VITE_APP_STORE_CONNECT_TEAM_ID="
  echo ""
  echo "# ---------------------------------------------------------------------------"
  echo "# SUGGESTION (not in CDK): optional client directory listing auth"
  echo "# Do not copy COUCHDB_USER / COUCHDB_PASSWORD from the Conductor task."
  echo "# ---------------------------------------------------------------------------"
  echo "# VITE_DIRECTORY_USERNAME="
  echo "# VITE_DIRECTORY_PASSWORD="
  echo ""
  echo "# ---------------------------------------------------------------------------"
  echo "# Do NOT set these for a sideloaded APK against the deployed server:"
  echo "#   CAP_ANDROID_ADB_FORWARD=true"
  echo "#   CAP_SERVER_URL=http://localhost:3000"
  echo "# Those make Capacitor load the Vite dev server instead of the bundle."
  echo "# ---------------------------------------------------------------------------"
} >"$OUTPUT_FILE"

if [[ "$OUTPUT_FILE" != /* ]]; then
  OUTPUT_FILE="$(cd "$(dirname "$OUTPUT_FILE")" && pwd)/$(basename "$OUTPUT_FILE")"
fi

echo "" >&2
echo "Wrote $(wc -l <"$OUTPUT_FILE") lines to ${OUTPUT_FILE}" >&2
echo "Conductor: $(jq -r '.VITE_CONDUCTOR_URL' <<<"$DERIVED_JSON")" >&2
echo "App id:    $(jq -r '.VITE_APP_ID' <<<"$DERIVED_JSON")  (also APP_ID for Gradle)" >&2

if ((BUILD_APK)); then
  echo "" >&2
  echo "Building debug APK via ${SCRIPT_DIR}/build-dev-debug-apk.sh" >&2
  apk_args=(-e "$OUTPUT_FILE")
  if ((DEPLOY)); then
    apk_args+=(--deploy)
  fi
  exec "${SCRIPT_DIR}/build-dev-debug-apk.sh" "${apk_args[@]}"
fi
