#!/usr/bin/env sh



if [ -z "$1" ]; then
	platform="web"
else
	platform="$1";
fi

git describe --long 2>/dev/null || git describe --all --long --always | sed "s#heads/g#${platform}.#"
