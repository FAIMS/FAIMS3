#!/usr/bin/env bash

set -euo pipefail


cd ~/android-deploy-sandbox/FAIMS3

GITROOT=$(git rev-parse --show-toplevel)
cd $GITROOT

export TAG_EXPRESSION="${1:-v*}"

git switch --detach
faims_tag=$(git describe --tags `git rev-list --tags="$TAG_EXPRESSION" --max-count=1`)    
echo "swapping to $faims_tag"
git checkout "$faims_tag"

npm ci

#for server in $(cat android/fipnamelist); do
# grep -v '^#' android/fipnamelist | grep -v "Server" | while IFS=, read -r server SPID DB_PORT
# do
cd $GITROOT
export SPID="SCU"

export REACT_APP_CLUSTER_ADMIN_GROUP_NAME="cluster-admin"
export REACT_APP_COMMIT_VERSION="psmip.$(bin/getDescribeString.sh play)"
export REACT_APP_DIRECTORY_HOST=db.psmip.ansis.net
export REACT_APP_PRODUCTION_BUILD=true
export REACT_APP_SERVER=production
export REACT_APP_SERVICES=FAIMSTEXT
export REACT_APP_SHOW_MINIFAUXTON="false"
export REACT_APP_SHOW_NEW_NOTEBOOK="false"
export REACT_APP_SHOW_WIPE="false"
export REACT_APP_TAG=$server
export REACT_APP_USE_HTTPS="true"
export REACT_APP_USE_REAL_DATA=true
export platform="play"
export prnum="psmip.$(bin/getDescribeString.sh play)"
export serverprefix="prod"
export APP_NAME="PSMIP data"

# else
# fi
echo "$APP_NAME psmip.ansis.net Lane: $FIP_LANE"
sed -i "s/FAIMS3/$APP_NAME/g" $GITROOT/android/app/src/main/res/values/strings.xml 

npm run build
npx cap sync --deployment android
cd android

bundle exec fastlane deploy_fip

# /home/brian/people/FAIMS/3/FAIMS3/android/app/src/main/res/values
git checkout $GITROOT/android/app/src/main/res/values/strings.xml 
git switch -
	#break
# done
