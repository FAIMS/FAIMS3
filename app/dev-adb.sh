#!/bin/bash

set -e

adb reverse tcp:3000 tcp:3000   # Dev server
adb reverse tcp:8080 tcp:8080   # API server
adb reverse tcp:5984 tcp:5984   # CouchDB

# Regenerate capacitor.config.json with ADB live-reload settings, then sync/run
CAP_ANDROID_ADB_FORWARD=true pnpm run generate-capacitor-config
pnpm cap sync android
pnpm cap run android
