#!/usr/bin/env bash

adb uninstall org.fedarch.faims3
rm -f /tmp/app-debug.apk*
cd /tmp/
wget https://github.com/FAIMS/FAIMS3/releases/download/latest-android/app-debug.apk
adb install /tmp/app-debug.apk