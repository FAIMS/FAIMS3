#!/usr/bin/env bash

set -euo pipefail

GITROOT=$(git rev-parse --show-toplevel)
cd $GITROOT

# git pull

# git checkout main
# git pull

# git checkout android-fastlane
# git fetch --all
# #git pull

# git switch --detach
# #faims_tag=$(git describe --tags `git rev-list --tags=v* --max-count=1`)    
# git merge main --no-edit
# git branch
# git --no-pager log --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit -n10


export REACT_APP_COMMIT_VERSION=$(bin/getDescribeString.sh android)
export REACT_APP_DIRECTORY_HOST=testing.db.faims.edu.au
export REACT_APP_PRODUCTION_BUILD=true
export REACT_APP_SERVER=production
export REACT_APP_SERVICES=FAIMSTEXT
export REACT_APP_TAG=testingAndroid
export REACT_APP_USE_REAL_DATA=true
export REACT_APP_PROD_BUILD=true
export platform="testing-main-latest"
export serverprefix="testing"
export prnum=$(bin/getDescribeString.sh android)
npm ci --prefer-offline
npm run build
npx cap sync --deployment android

cd android
bundle exec fastlane deploy_alpha
# Deploy_alpha deploys it to internal track.

# git switch android-fastlane --discard-changes