#!/usr/bin/env sh

if [ -z "$1" ]; then
	platform="web"
else
	platform="$1";
fi
# get some git commit info
descstring=$(echo $(git describe --long 2>/dev/null || git describe --all --long --always)| tr -d "\n")
# get the version number from package.json
version=$(grep '"version":' package.json | cut -d: -f 2 | sed -e 's/[", ]//g')
# put them together in a nice format
echo "$descstring" | sed -E "s#heads/[A-Za-z0-9-]+-0-g#v${version}-${platform}-#" | sed -E "s#-v.*-g#-#"
