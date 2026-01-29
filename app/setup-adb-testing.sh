#!/bin/bash

# FAIMS3 - Local Device Testing Setup Script
# This script prepares the Capacitor config for ADB-forwarded device testing

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/capacitor.config.json"
ADB_CONFIG_FILE="$SCRIPT_DIR/capacitor.config.adb-forward.json"

echo "=== FAIMS3 ADB Device Testing Setup ==="
echo ""

# Check if ADB forward config exists
if [ ! -f "$ADB_CONFIG_FILE" ]; then
  echo "ERROR: $ADB_CONFIG_FILE not found"
  exit 1
fi

# Copy ADB forward config
echo "Copying ADB forward config..."
cp "$ADB_CONFIG_FILE" "$CONFIG_FILE"

echo ""
echo "Config updated. Now run:"
echo "  pnpm cap sync android"
echo "  pnpm cap run android"
echo ""
