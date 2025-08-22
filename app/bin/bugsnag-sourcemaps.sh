#!/bin/sh
# upload sourcemaps to bugsnag

npx bugsnag-source-maps upload-browser \
  --api-key ${VITE_BUGSNAG_KEY} \
  --detect-app-version \
  --base-url ${VITE_CONDUCTOR_URL}/assets \
  --directory ./build-sourcemap/assets
