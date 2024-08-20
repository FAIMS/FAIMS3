#!/usr/bin/env sh

if [ -z "$1" ]; then
	platform="web"
else
	platform="$1";
fi

# Get the directory where the script is located
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# get some git commit info
descstring=$(git rev-parse HEAD | cut -c 1-8)
# get the version number from package.json in the app project
version=$(grep '"version":' $SCRIPT_DIR/../package.json | cut -d: -f 2 | sed -e 's/[", ]//g')
# put them together in a nice format
echo "v${version}-${platform}-#${descstring}"
