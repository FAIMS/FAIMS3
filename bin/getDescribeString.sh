#!/usr/bin/env sh

if [ -z "$1" ]; then
	platform="web"
else
	platform="$1";
fi

# use the most recent tag as the main version descriptor, add the platform
echo $(git describe --tags --abbrev=0)-"$platform"
