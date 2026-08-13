#!/bin/bash

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
PROJECT_DIR="${SCRIPT_DIR}/../"

APP_NAME_PLACEHOLDER=APPNAME
APP_ID_PLACEHOLDER=org.fedarch.faims3

# Check the npm package version is set
if [ "$npm_package_version" == "" ]; then
  echo "Error: npm_package_version is not set in package.json"
  exit 1
else
  echo "Package version during build: '${npm_package_version}'"
fi

# replace occurrences of the app name 'Fieldmark' and id 'org.fedarch.faims3'
# with configured values VITE_APP_NAME and VITE_APP_ID

echo "Configuring app name ${VITE_APP_NAME} and id ${VITE_APP_ID}"

# app name and appId → capacitor.config.json (also honors CAP_ANDROID_ADB_FORWARD / CAP_SERVER_URL)
./bin/generateCapacitorConfig.sh

# public/manifest.json

sed -e "s/${APP_NAME_PLACEHOLDER}/${VITE_APP_NAME}/g" ./public/manifest.dist.json >./public/manifest.json

# Generate android/app/src/main/AndroidManifest.xml
sed -e "s/${APP_NAME_PLACEHOLDER}/${VITE_APP_NAME}/g" android/app/src/main/AndroidManifest-dist.xml >./android/app/src/main/AndroidManifest.xml

# android/app/src/main/res/values/strings.xml

cat <<EOT >./android/app/src/main/res/values/strings.xml
<?xml version='1.0' encoding='utf-8'?>
<resources>
    <string name="app_name">${VITE_APP_NAME}</string>
    <string name="title_activity_main">${VITE_APP_NAME}</string>
    <string name="custom_url_scheme">${VITE_APP_ID}</string>
</resources>
EOT

## Now run the asset generation script

THEME=${VITE_THEME:-default}

echo "Generating assets for ${THEME} theme"

pnpm dlx sssf-capacitor-assets generate --assetPath "./public/base-assets/${THEME}" \
  --pwaManifestPath ./public/manifest.json \
  --iconBackgroundColorDark '#001d34' \
  --splashBackgroundColorDark '#001d34'

## capacitor-assets can put the pwa icons in the wrong place sometimes
if test -f icons/icon-192.png; then
  echo "Moving icons into public"
  mkdir -p ./public/assets
  mv icons ./public/assets/icons
fi

## copy the icons over to web/ as well (check they exist first)
if test -f ./public/assets/icons/icon-192.png; then
  rm -rf ../web/public/assets/icons
  mkdir -p ../web/public/assets/
  cp -r ./public/assets/icons ../web/public/assets/icons
fi
