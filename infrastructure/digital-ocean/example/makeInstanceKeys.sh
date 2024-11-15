#!/usr/bin/env bash

set -euo pipefail

# NOTE: This script determines it's current location then produces keys/config
# files relative to the API root path which is assumed to be ../ relative to
# this script

# Get the directory where the script is located
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# Path to create keys at
ASSET_PATH="./assets"

rm -rf $ASSET_PATH

# Read the first argument as the env file
ENV_FILE=conductor.env
if [ -f $ENV_FILE ]; then
    # Load Environment Variables
    export $(cat $ENV_FILE | grep -v '#' | sed 's/\r$//' | awk '/=/ {print $1}' )
fi

export HOST_TARGET="${PROFILE_NAME:-conductor}"

mkdir -p "$ASSET_PATH"
openssl genpkey -algorithm RSA -out "${ASSET_PATH}/private_key.pem" -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in "${ASSET_PATH}/private_key.pem" -out "${ASSET_PATH}/public_key.pem"
ssh-keygen -f ${ASSET_PATH}/public_key.pem -i -m PKCS8 > ${ASSET_PATH}/public_key.pub

## Dropping a flattened key out to support generated pubkeys for iOS testing

export FLATTENED_KEY=$(cat "${ASSET_PATH}/public_key.pem" | awk '{printf "%s\\n", $0}')

## Generate the jwt.ini file needed for couch deployment, contains the public key
## used to validate signed JWTs for authentication to couchdb

COUCHDB_INI=${ASSET_PATH}/local.ini

cp ${SCRIPT_DIR}/couchdb/local.ini.dist ${COUCHDB_INI} 
sed -i.bak "s/secret = <SECRET_PLACEHOLDER>/secret = ${FAIMS_COOKIE_SECRET}/" ${COUCHDB_INI} 
sed -i.bak "s/uuid = <UUID_PLACEHOLDER>/uuid = "${FAIMS_COOKIE_SECRET}"/" ${COUCHDB_INI} 
echo "[jwt_keys]" >> ${COUCHDB_INI} 
echo "rsa:${PROFILE_NAME}=${FLATTENED_KEY}" >> ${COUCHDB_INI} 
echo '[admin]' >> ${COUCHDB_INI} 
echo "admin=${COUCHDB_PASSWORD}" >> ${COUCHDB_INI}
## remove backup created above
rm ${COUCHDB_INI}.bak

echo "Created assets in ${ASSET_PATH}"

