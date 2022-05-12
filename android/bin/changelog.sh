#!/bin/bash

git log --perl-regexp --pretty="* %s" | awk '//{f=1}; f && g<2; $0 && /Merge remote/{g++}' | grep -v "Merge remote" > ./metadata/android/en-GB/changelogs/$1.txt
count=$(wc -c ./metadata/android/en-GB/changelogs/$1.txt | cut -d' ' -f1)
echo $count
if [[ $count -gt 497 ]]
then
	sed -Ez -i -- 's/^(.{497}).*/\1.../' ./metadata/android/en-GB/changelogs/$1.txt
fi
