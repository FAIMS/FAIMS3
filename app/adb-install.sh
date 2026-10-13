#!/usr/bin/env bash
# Install the sideloadable Android debug APK onto a connected device via adb.
#
# Default APK is the Capacitor/Gradle debug output. Use after
# infrastructure/aws-cdk/scripts/build-dev-debug-apk.sh (or --build-apk).
#
# Usage (from app/):
#   ./adb-install.sh [-s SERIAL] [APK]
#
# Examples:
#   ./adb-install.sh
#   ./adb-install.sh android/app/build/outputs/apk/debug/app-debug.apk
#   ./adb-install.sh -s emulator-5554
#
# Requires: adb, a single authorized device (or -s when several are attached).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_APK="${SCRIPT_DIR}/android/app/build/outputs/apk/debug/app-debug.apk"

usage() {
  cat <<'EOF'
Install the sideloadable Android debug APK onto a connected device via adb.

Usage (from app/):
  ./adb-install.sh [-s SERIAL] [APK]

Examples:
  ./adb-install.sh
  ./adb-install.sh android/app/build/outputs/apk/debug/app-debug.apk
  ./adb-install.sh -s emulator-5554

Requires: adb, a single authorized device (or -s when several are attached).
EOF
  exit "${1:-0}"
}

SERIAL=""
APK=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage 0
      ;;
    -s|--serial)
      SERIAL="$2"
      shift 2
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage 1
      ;;
    *)
      if [[ -z "$APK" ]]; then
        APK="$1"
      else
        echo "Unexpected argument: $1" >&2
        usage 1
      fi
      shift
      ;;
  esac
done

APK="${APK:-$DEFAULT_APK}"

if [[ ! -f "$APK" ]]; then
  echo "Error: APK not found: ${APK}" >&2
  echo "Build one first: infrastructure/aws-cdk/scripts/build-dev-debug-apk.sh" >&2
  exit 1
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "Error: adb is not installed or not on PATH (see app/adb-guide.md)." >&2
  exit 1
fi

adb_args=()
if [[ -n "$SERIAL" ]]; then
  adb_args+=(-s "$SERIAL")
fi

mapfile -t DEVICES < <(adb "${adb_args[@]}" devices | awk 'NR>1 && $2=="device" {print $1}')

if ((${#DEVICES[@]} == 0)); then
  echo "Error: no authorized Android device (adb devices)." >&2
  adb devices >&2
  exit 1
fi

if [[ -z "$SERIAL" && ${#DEVICES[@]} -gt 1 ]]; then
  echo "Error: multiple devices attached; pass -s SERIAL." >&2
  adb devices >&2
  exit 1
fi

echo "APK:    ${APK}" >&2
echo "Device: ${SERIAL:-${DEVICES[0]}}" >&2
adb "${adb_args[@]}" install -r "$APK"
echo "Installed." >&2
