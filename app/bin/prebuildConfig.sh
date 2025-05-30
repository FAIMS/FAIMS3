#!/bin/sh

APP_NAME_PLACEHOLDER=APPNAME
APP_ID_PLACEHOLDER=org.fedarch.faims3

# replace occurences of the app name 'Fieldmark' and id 'org.fedarch.faims3'
# with configured values VITE_APP_NAME and VITE_APP_ID

echo "Configuring app name ${VITE_APP_NAME} and id ${VITE_APP_ID}"

# app name and appId
# capacitor.config.json
sed -e "s/${APP_NAME_PLACEHOLDER}/${VITE_APP_NAME}/g"  ./capacitor.config.dist.json |\
  sed -e "s/${APP_ID_PLACEHOLDER}/${VITE_APP_ID}/g" > ./capacitor.config.json

# public/manifest.json

sed -e "s/${APP_NAME_PLACEHOLDER}/${VITE_APP_NAME}/g" ./public/manifest.dist.json > ./public/manifest.json

# android/app/src/main/AndroidManifest.xml

sed -i -e "s/${APP_NAME_PLACEHOLDER}/${VITE_APP_NAME}/g" android/app/src/main/AndroidManifest.xml

# android/app/src/main/res/values/strings.xml

cat << EOT > ./android/app/src/main/res/values/strings.xml
<?xml version='1.0' encoding='utf-8'?>
<resources>
    <string name="app_name">${VITE_APP_NAME}</string>
    <string name="title_activity_main">${VITE_APP_NAME}</string>
    <string name="custom_url_scheme">${VITE_APP_ID}</string>
</resources>
EOT

## Now run the asset generation script

echo "Generating assets for ${VITE_THEME} theme"

npx capacitor-assets generate --assetPath "./public/base-assets/${VITE_THEME}" \
  --pwaManifestPath ./public/manifest.json \
  --iconBackgroundColorDark '#001d34' \
  --splashBackgroundColorDark '#001d34'

## capacitor-assets can put the pwa icons in the wrong place sometimes
if test -f icons/icon-48.webp; then
  echo "Moving icons into public"
  mkdir -p ./public/assets
  mv icons ./public/assets/icons
fi


## IOS specific configuration

# Setting the IOS build version
# https://pgu.dev/2020/12/16/ios-build-versioning.html

#version=$(grep '"version":' $PROJECT_DIR/package.json | cut -d: -f 2 | sed -e 's/[", ]//g')
# since we previously published 1.0.0 on app store we need a higher version
# number, set that here until we get the main version above this
version=1.0.5
buildNumber=$(date -u "+%Y%m%d%H%M")

if test -f /usr/libexec/PlistBuddy; then
  echo "\nIOS: Configuring Info.plist settings"
  /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $buildNumber" ./ios/App/App/Info.plist
  /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $version" ./ios/App/App/Info.plist
  /usr/libexec/PlistBuddy -c "Set :CFBundleURLTypes:0:CFBundleURLSchemes:0 $VITE_APP_ID" ./ios/App/App/Info.plist
  /usr/libexec/PlistBuddy -c "Set :CFBundleURLTypes:0:CFBundleURLName $VITE_APP_ID" ./ios/App/App/Info.plist
fi
