#!/bin/sh -euo pipefail
if [ ${#} -eq 0 ]; then
echo "No git hash supplied"
exit 0
else
BUNDLE_VERSION="${1}"
fi

POSSIBLY_DECIMAL_GIT_HASH=$( echo "${BUNDLE_VERSION}" | sed 's/[0-9][0-9]*\.\([0-9][0-9]*\)/\1/' )

ALLOWED_CHARACTERS="0123456789"
DECIMALIZED_GREP_REGEX='^['"${ALLOWED_CHARACTERS}"']['"${ALLOWED_CHARACTERS}"']*$'
DECIMAL_GIT_HASH=$( echo "${POSSIBLY_DECIMAL_GIT_HASH}" | grep "${DECIMALIZED_GREP_REGEX}" ) || {
echo "\"${BUNDLE_VERSION}\" does not look like a CFBundleVersion we expect. It should contain two dot-separated numbers." >&2
exit 1
}

POSSIBLY_PREFIXED_GIT_HASH=$( printf "%x" ${DECIMAL_GIT_HASH} )

PREFIXED_GIT_HASH=$( echo "${POSSIBLY_PREFIXED_GIT_HASH}" | grep '^1..*$' ) || {
echo "\"${BUNDLE_VERSION}\"'s second number, \"${POSSIBLY_DECIMAL_GIT_HASH}\", is \"${POSSIBLY_PREFIXED_GIT_HASH}\" in hex, which did not start with a \"1\"." >&2
exit 2
}

GIT_BASH="${PREFIXED_GIT_HASH:1}"

echo "${GIT_BASH}"
