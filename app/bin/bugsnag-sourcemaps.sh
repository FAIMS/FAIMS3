#!/bin/sh
# upload sourcemaps to bugsnag if we have a key

# On Android, BASE_URL is https://localhost but on IOS
# it is ${VITE_APPLE_BUNDLE_IDENTIFIER}://localhost

BASE_URL="https://localhost"
if [ "$1" = "IOS" ]; then
  BASE_URL="${VITE_APPLE_BUNDLE_IDENTIFIER}://localhost"
fi

if [ -n "$VITE_BUGSNAG_KEY" ]; then
  echo "Uploading to BugSnag using BASE_URL: $BASE_URL"
  # build the sourcemap version of the app
  npm run build-sourcemap
  npx bugsnag-source-maps upload-browser \
    --api-key ${VITE_BUGSNAG_KEY} \
    --detect-app-version \
    --base-url ${BASE_URL}/assets \
    --directory ./build-sourcemap/assets
fi

