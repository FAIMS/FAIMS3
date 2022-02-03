#!/usr/bin/env sh



if [ -z "$1" ]; then
	platform="web"
else
	platform="$1";
fi


descstring=$(git describe --long 2>/dev/null || git describe --all --long --always) 
#echo "$descstring"
echo "$descstring" | sed -E "s#heads/[A-Za-z0-9]+-0-g#${platform}.#"
