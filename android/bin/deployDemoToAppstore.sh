#!/usr/bin/env bash

set -euo pipefail

GITROOT=$(git rev-parse --show-toplevel)
cd $GITROOT

bash android/bin/mergeTagFromMain.sh


export REACT_APP_COMMIT_VERSION=$(bin/getDescribeString.sh android)
export REACT_APP_DIRECTORY_HOST=demo.db.faims.edu.au
export REACT_APP_PRODUCTION_BUILD=true
export REACT_APP_SERVER=production
export REACT_APP_SERVICES=FAIMSTEXT
export REACT_APP_TAG=demoAndroid
export REACT_APP_USE_REAL_DATA=true
export REACT_APP_PROD_BUILD=true
export platform="play"
export serverprefix="demo"
export prnum=$(bin/getDescribeString.sh android)
npm ci --prefer-offline
npm run build
npx cap sync --deployment android

cd android
bundle exec fastlane deploy_demo