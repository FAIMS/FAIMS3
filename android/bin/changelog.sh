#!/bin/bash

GITROOT=$(git rev-parse --show-toplevel)
cd $GITROOT

export CHANGELOG_PATH="${GITROOT}/android/fastlane/metadata/android/en-GB/changelogs/"

mkdir -p $CHANGELOG_PATH
git log --perl-regexp --pretty="* %s" | awk '//{f=1}; f && g<2; $0 && /Merge remote/{g++}' | grep -v "Merge remote" > "${CHANGELOG_PATH}/${1}.txt"
count=$(wc -c "${CHANGELOG_PATH}/${1}.txt" | cut -d' ' -f1)
echo $count
if [[ $count -gt 497 ]]
then
	sed -Ez -i -- 's/^(.{497}).*/\1.../' ${CHANGELOG_PATH}/${1}.txt
fi
