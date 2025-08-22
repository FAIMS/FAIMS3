#!/bin/sh
# upload sourcemaps to bugsnag if we have a key

# BASE URL for app deployment is localhost, override with environment setting if present
BASE_URL="${VITE_APP_URL:-https://localhost}"

if [ -n "$VITE_BUGSNAG_KEY" ]; then
  # build the sourcemap version of the app
  npm run build-sourcemap
  npx bugsnag-source-maps upload-browser \
    --api-key ${VITE_BUGSNAG_KEY} \
    --detect-app-version \
    --base-url ${BASE_URL}/assets \
    --directory ./build-sourcemap/assets
fi

