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
  /usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName $VITE_APP_NAME" ./ios/App/App/Info.plist
fi


echo "Updating project.pbxproj with", ${VITE_APPLE_BUNDLE_IDENTIFIER}, ${VITE_APP_STORE_CONNECT_TEAM_ID}
# update project file for local build
# Bundle-id substitution also rewrites the default Match profile name to
# "match AppStore <bundle-id>". Optionally override with PROVISIONING_PROFILE_SPECIFIER.
sed -e "s/${APP_ID_PLACEHOLDER}/${VITE_APPLE_BUNDLE_IDENTIFIER}/g" ./ios/App/App.xcodeproj/project.pbxproj.dist |\
  sed -e "s/VITE_APP_STORE_CONNECT_TEAM_ID/${VITE_APP_STORE_CONNECT_TEAM_ID}/g" |\
  if [ -n "${PROVISIONING_PROFILE_SPECIFIER:-}" ]; then
    echo "Overriding PROVISIONING_PROFILE_SPECIFIER -> ${PROVISIONING_PROFILE_SPECIFIER}" >&2
    sed -e "s#\"PROVISIONING_PROFILE_SPECIFIER\[sdk=iphoneos\*\]\" = \"[^\"]*\"#\"PROVISIONING_PROFILE_SPECIFIER[sdk=iphoneos*]\" = \"${PROVISIONING_PROFILE_SPECIFIER}\"#"
  else
    cat
  fi > ./ios/App/App.xcodeproj/project.pbxproj
