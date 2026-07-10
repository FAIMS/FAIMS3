#!/bin/bash

# FAIMS3 - Local Device Testing Setup Script
# Capacitor config is sourced from capacitor.config.ts. This helper prints and
# can run the ADB-forward environment mode commands.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR"

echo "=== FAIMS3 ADB Device Testing Setup ==="
echo ""

if [ "$1" = "--run" ]; then
  cd "$APP_DIR"
  CAP_ANDROID_ADB_FORWARD=true pnpm cap sync android
  CAP_ANDROID_ADB_FORWARD=true pnpm cap run android
  exit 0
fi

echo "Capacitor ADB mode uses env vars (no config file copy)."

echo ""
echo "Run this from app/:"
echo "  CAP_ANDROID_ADB_FORWARD=true pnpm cap sync android"
echo "  CAP_ANDROID_ADB_FORWARD=true pnpm cap run android"
echo ""
echo "Optional override:"
echo "  CAP_SERVER_URL=http://localhost:3000 CAP_ANDROID_ADB_FORWARD=true pnpm cap sync android"
echo ""
echo "Or run this script with --run to execute sync + run now."
echo ""
