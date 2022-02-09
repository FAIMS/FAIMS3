#!/usr/bin/env sh



if [ -z "$1" ]; then
	platform="web"
else
	platform="$1";
fi

descstring=$(echo 0.3.$(git log --perl-regexp --pretty='%s' | grep 'Merge #' | head -n1 | cut -d'#' -f2)-$(git describe --long 2>/dev/null || git describe --all --long --always)| tr -d "\n")
#echo "$descstring"
echo "$descstring" | sed -E "s#heads/[A-Za-z0-9-]+-0-g#${platform}.#"
