#!/usr/bin/env bash

set -euo pipefail

GITROOT=$(git rev-parse --show-toplevel)
cd $GITROOT

export TAG_EXPRESSION="${1:-v*}"
faims_tag=$(git describe --tags `git rev-list --tags="$TAG_EXPRESSION" --max-count=1`)    
git switch --detach
git checkout $faims_tag

#bash android/bin/mergeTagFromMain.sh "$TAG_EXPRESSION"
export FIP_LANE="${1:-alpha}"
export REACT_APP_COMMIT_VERSION=$(bin/getDescribeString.sh android)
export REACT_APP_DIRECTORY_HOST="${FIP_LANE}.db.faims.edu.au"
export REACT_APP_PRODUCTION_BUILD=true
export REACT_APP_SERVER=production
export REACT_APP_SERVICES=FAIMSTEXT
export REACT_APP_TAG=${FIP_LANE}Android
export REACT_APP_USE_REAL_DATA=true
export REACT_APP_PROD_BUILD=true
export platform="play"
export serverprefix="${FIP_LANE}"
export APP_NAME="FieldMark"
export PACKAGE_NAME="au.edu.faims.fieldmark"
export prnum=$(bin/getDescribeString.sh android)

sed -i "s/FAIMS3/$APP_NAME/g" $GITROOT/android/app/src/main/res/values/strings.xml 
sed -i "s/org.fedarch.faims3/$PACKAGE_NAME/g" $GITROOT/android/app/build.gradle
npm ci --prefer-offline
npm run build
npx cap sync --deployment android

cd android
bundle exec fastlane deploy_fieldmark_closed_track
git checkout main app
git switch -