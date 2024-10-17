#!/bin/bash

GITROOT=$(git rev-parse --show-toplevel)
cd $GITROOT

mkdir -p $GITROOT/app/android/metadata/android/en-GB/changelogs/
# write the first 100 lines of changelog, remove Merge and Bump commits
echo "writing $GITROOT/app/android/metadata/android/en-GB/changelogs/$1.txt"
git log --perl-regexp --pretty="* %s" | grep -v "Merge" | grep -v "Bump"  | head -100  > $GITROOT/app/android/metadata/android/en-GB/changelogs/$1.txt

