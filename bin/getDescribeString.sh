#!/usr/bin/env sh

if [ -z "$1" ]; then
	platform="web"
else
	platform="$1";
fi
# get the version number from package.json
version=$(grep '"version":' package.json | cut -d: -f 2 | sed -e 's/[", ]//g')
echo v$version-$platform
