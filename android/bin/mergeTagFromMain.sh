#!/usr/bin/env bash

set -euo pipefail

git pull
git commit -sam "prebuild commit" || echo "Nothing to commit, continuing."

#git checkout main
git fetch --all
#git pull


export TAG_EXPRESSION="${1:-v*}"

git switch --detach
faims_tag=$(git describe --tags `git rev-list --tags="$TAG_EXPRESSION" --max-count=1`)    
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
#git switch android-fastlane --discard-changes