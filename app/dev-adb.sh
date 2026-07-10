#!/bin/bash

set -e

adb reverse tcp:3000 tcp:3000   # Dev server
adb reverse tcp:8080 tcp:8080   # API server
adb reverse tcp:5984 tcp:5984   # CouchDB

# Use env-driven ADB mode in capacitor.config.ts
CAP_ANDROID_ADB_FORWARD=true pnpm cap sync android
CAP_ANDROID_ADB_FORWARD=true pnpm cap run android
