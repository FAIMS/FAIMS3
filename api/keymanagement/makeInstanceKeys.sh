#!/usr/bin/env bash

set -euo pipefail

# NOTE: This script determines it's current location then produces keys/config
# files relative to the API root path which is assumed to be ../ relative to
# this script

# Get the directory where the script is located
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# Determine API root relative to script NOTE this will break if key management script is moved!
API_ROOT="${SCRIPT_DIR}/.."

# Path to create keys at - root/api/keys
KEYS_PATH="${API_ROOT}/keys"

# Read either an env file as the first arg or .env if no arg present

# Local .env
ENV_FILE=${1:-${API_ROOT}/.env}
if [ -f $ENV_FILE ]; then
    # Load Environment Variables
    export $(cat $ENV_FILE | grep -v '#' | sed 's/\r$//' | awk '/=/ {print $1}' )
fi

export HOST_TARGET="${PROFILE_NAME:-conductor}"


echo "Keys for ${PROFILE_NAME}: ${HOST_TARGET} from ${ENV_FILE}"
mkdir -p "$KEYS_PATH"
openssl genpkey -algorithm RSA -out "${KEYS_PATH}/${HOST_TARGET}_private_key.pem" -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in "${KEYS_PATH}/${HOST_TARGET}_private_key.pem" -out "${KEYS_PATH}/${HOST_TARGET}_public_key.pem"

## Dropping a flattened key out to support generated pubkeys for iOS testing

export FLATTENED_KEY=$(cat "${KEYS_PATH}/${HOST_TARGET}_public_key.pem" | awk '{printf "%s\\n", $0}')

echo $FLATTENED_KEY > "${KEYS_PATH}/${HOST_TARGET}_rsa_2048_public_key.pem.flattened"

## Generate the jwt.ini file needed for couch deployment, contains the public key
## used to validate signed JWTs for authentication to couchdb

cp ${API_ROOT}/couchdb/local.ini.dist ${API_ROOT}/couchdb/local.ini 
sed -i.bak "s/secret = db7a1a86dbc734593febf8ca6fdf0cf8/secret = ${FAIMS_COOKIE_SECRET}/" ${API_ROOT}/couchdb/local.ini
sed -i.bak "s/uuid = adf990d5dd21b735f65d4140ad1f10c2/uuid = "`uuid`"/" ${API_ROOT}/couchdb/local.ini
echo "[jwt_keys]" >> ${API_ROOT}/couchdb/local.ini
echo "rsa:${PROFILE_NAME}=${FLATTENED_KEY}" >> ${API_ROOT}/couchdb/local.ini
echo '[admin]' >> ${API_ROOT}/couchdb/local.ini
echo "admin=${COUCHDB_PASSWORD}" >> ${API_ROOT}/couchdb/local.ini

cat ${API_ROOT}/couchdb/local.ini


