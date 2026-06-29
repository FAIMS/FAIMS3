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

# app name and appId
# capacitor.config.json
sed -e "s/${APP_NAME_PLACEHOLDER}/${VITE_APP_NAME}/g" ./capacitor.config.dist.json |
  sed -e "s/${APP_ID_PLACEHOLDER}/${VITE_APP_ID}/g" >./capacitor.config.json

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

echo "Generating assets for ${VITE_THEME} theme"

if [ "${VITE_THEME}" = "bubble" ]; then
  echo "Error: VITE_THEME=bubble is no longer supported. Use default, fieldmark, or bssTheme."
  exit 1
fi

case "${VITE_THEME}" in
  "" | "default")
    THEME_PACKAGE="@faims3/theme-default"
    ;;
  "fieldmark")
    THEME_PACKAGE="@faims3/theme-fieldmark"
    ;;
  "bssTheme")
    THEME_PACKAGE="@faims3/theme-bss"
    ;;
  *)
    echo "Error: Unsupported VITE_THEME=${VITE_THEME}. Use default, fieldmark, or bssTheme."
    exit 1
    ;;
esac

THEME_ASSET_PATH=$(node -e "const path=require('node:path'); const pkg=process.argv[1]; const entry=require.resolve(pkg); const packageRoot=path.resolve(path.dirname(entry), '..'); process.stdout.write(path.join(packageRoot, 'assets'));" "${THEME_PACKAGE}")
THEME_ASSET_PATH_REL=$(node -e "const path=require('node:path'); const abs=process.argv[1]; const rel=path.relative(process.cwd(), abs); process.stdout.write(rel || '.');" "${THEME_ASSET_PATH}")

if [ ! -f "${THEME_ASSET_PATH}/logo.png" ]; then
  echo "Error: Theme assets not found at ${THEME_ASSET_PATH}"
  exit 1
fi

echo npx capacitor-assets generate --assetPath "${THEME_ASSET_PATH_REL}" \
  --pwaManifestPath ./public/manifest.json \
  --iconBackgroundColorDark '#001d34' \
  --splashBackgroundColorDark '#001d34'

npx capacitor-assets generate --assetPath "${THEME_ASSET_PATH_REL}" \
  --pwaManifestPath ./public/manifest.json \
  --iconBackgroundColorDark '#001d34' \
  --splashBackgroundColorDark '#001d34'

## capacitor-assets can put the pwa icons in the wrong place sometimes
if test -f icons/icon-48.webp; then
  echo "Moving icons into public"
  mkdir -p ./public/assets
  mv icons ./public/assets/icons
fi

## copy the icons over to web/ as well (check they exist first)
if test -f ./public/assets/icons/icon-48.webp; then
  rm -rf ../web/public/assets/icons
  mkdir -p ../web/public/assets/
  cp -r ./public/assets/icons ../web/public/assets/icons
fi
