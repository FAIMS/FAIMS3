#!/bin/bash

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
PROJECT_DIR="${SCRIPT_DIR}/../"

APP_NAME_PLACEHOLDER=APPNAME
APP_ID_PLACEHOLDER=org.fedarch.faims3

## IOS specific configuration

# Setting the IOS build version
# https://pgu.dev/2020/12/16/ios-build-versioning.html

version=$(grep '"version":' $PROJECT_DIR/package.json | cut -d: -f 2 | sed -e 's/[", ]//g')
buildNumber=$(date -u "+%Y%m%d%H%M")

# create Info.plist
cp ./ios/App/App/Info.plist.dist ./ios/App/App/Info.plist
if test -f /usr/libexec/PlistBuddy; then
  echo "\nIOS: Configuring Info.plist settings"
  /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $buildNumber" ./ios/App/App/Info.plist
  /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $version" ./ios/App/App/Info.plist
  /usr/libexec/PlistBuddy -c "Set :CFBundleURLTypes:0:CFBundleURLSchemes:0 $VITE_APP_ID" ./ios/App/App/Info.plist
  /usr/libexec/PlistBuddy -c "Set :CFBundleURLTypes:0:CFBundleURLName $VITE_APP_ID" ./ios/App/App/Info.plist
fi


echo "Updating project.pbxproj with", ${VITE_APPLE_BUNDLE_IDENTIFIER}, ${VITE_APP_STORE_CONNECT_TEAM_ID}
# update project file for local build
sed -e "s/${APP_ID_PLACEHOLDER}/${VITE_APPLE_BUNDLE_IDENTIFIER}/g" ./ios/App/App.xcodeproj/project.pbxproj.dist |\
  sed -e "s/VITE_APP_STORE_CONNECT_TEAM_ID/${VITE_APP_STORE_CONNECT_TEAM_ID}/g" > ./ios/App/App.xcodeproj/project.pbxproj
