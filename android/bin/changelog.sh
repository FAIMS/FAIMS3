#!/bin/bash

GITROOT=$(git rev-parse --show-toplevel)
cd $GITROOT

mkdir -p $GITROOT/android/metadata/android/en-GB/changelogs/
git log --perl-regexp --pretty="* %s" | awk '//{f=1}; f && g<2; $0 && /Merge remote/{g++}' | grep -v "Merge remote" > $GITROOT/android/metadata/android/en-GB/changelogs/$1.txt
count=$(wc -c $GITROOT/android/metadata/android/en-GB/changelogs/$1.txt | cut -d' ' -f1)
echo $count
if [[ $count -gt 497 ]]
then
	sed -Ez -i -- 's/^(.{497}).*/\1.../' $GITROOT/android/metadata/android/en-GB/changelogs/$1.txt
fi
