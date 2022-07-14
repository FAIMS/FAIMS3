#!/usr/bin/env bash

set -euo pipefail

GITROOT=$(git rev-parse --show-toplevel)
cd $GITROOT

# bash android/bin/mergeTagFromMain.sh
export TAG_EXPRESSION="${1:-v*}"
faims_tag=$(git describe --tags `git rev-list --tags="$TAG_EXPRESSION" --max-count=1`)    
git switch --detach
git checkout $faims_tag

npm ci
for server in $(cat android/faimsservers); do
	cd $GITROOT
	echo $server
	export FIP_LANE=$server #"alpha$( echo "$server" | tr '[:upper:]' '[:lower:]' )"
	export REACT_APP_PRODUCTION_BUILD=true
	export REACT_APP_DIRECTORY_HOST=$server.db.faims.edu.au
	export REACT_APP_COMMIT_VERSION=$(bin/getDescribeString.sh play)
	export REACT_APP_USE_REAL_DATA=true
	export REACT_APP_TAG=$server
	export REACT_APP_SERVER=production
	export REACT_APP_SERVICES=FAIMSTEXT
	export REACT_APP_PROD_BUILD=true
	export platform="play"
	export prnum=$(bin/getDescribeString.sh play)
	export serverprefix=$server #$(echo -n "$server" | sed -E "s/([A-Z][a-z])[^A-Z]*/\1/g"))"
	export APP_NAME="FAIMS3 ($serverprefix)"
	# else
	# fi
	echo $APP_NAME $server $FIP_LANE
	sed -i "s/FAIMS3/$APP_NAME/g" $GITROOT/android/app/src/main/res/values/strings.xml 

	npm run build
	npx cap sync --deployment android
	cd android

	echo $APP_NAME $server $FIP_LANE

	bundle exec fastlane deploy_fip

	# /home/brian/people/FAIMS/3/FAIMS3/android/app/src/main/res/values
	git checkout $GITROOT/android/app/src/main/res/values/strings.xml 
	#break
done

git switch -
# 
# npm run build
# npx cap sync --deployment android
# cd android
# bundle exec fastlane deploy_alpha