#!/usr/bin/env bash

set -euo pipefail


#git checkout main
git fetch --all
#git pull

faims_tag=$(git describe --tags `git rev-list --tags=v* --max-count=1`)    
git merge $faims_tag --no-edit
#git checkout $faims_tag
#git branch -D tagged_to_android
#git checkout -b tagged_to_android
#git merge -s ours android-fastlane --no-edit
#git add -A
#git commit -sam "updated android-fastlane with main/$faims_tag"
#git checkout android-fastlane
#git merge tagged_to_android
#git branch -D tagged_to_android
#git branch