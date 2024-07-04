#!/usr/bin/env bash

set -euo pipefail

# Read either an env file as the first arg or .env if no arg present

# Local .env
ENV_FILE=${1:-.env}
if [ -f $ENV_FILE ]; then
    # Load Environment Variables
    export $(cat $ENV_FILE | grep -v '#' | sed 's/\r$//' | awk '/=/ {print $1}' )
fi

export HOST_TARGET="${PROFILE_NAME:-conductor}"


echo "Keys for ${PROFILE_NAME}: ${HOST_TARGET} from ${ENV_FILE}"
mkdir -p keys
openssl genpkey -algorithm RSA -out "keys/${HOST_TARGET}_private_key.pem" -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in "keys/${HOST_TARGET}_private_key.pem" -out "keys/${HOST_TARGET}_public_key.pem"

## Dropping a flattened key out to support generated pubkeys for iOS testing

export FLATTENED_KEY=$(cat "keys/${HOST_TARGET}_public_key.pem" | awk '{printf "%s\\n", $0}')

echo $FLATTENED_KEY > "keys/${HOST_TARGET}_rsa_2048_public_key.pem.flattened"

## Generate the jwt.ini file needed for couch deployment, contains the public key
## used to validate signed JWTs for authentication to couchdb

cp ./couchdb/local.ini.dist ./couchdb/local.ini 
sed -i.bak "s/secret = db7a1a86dbc734593febf8ca6fdf0cf8/secret = ${FAIMS_COOKIE_SECRET}/" ./couchdb/local.ini
sed -i.bak "s/uuid = adf990d5dd21b735f65d4140ad1f10c2/uuid = "`uuid`"/" ./couchdb/local.ini
echo "[jwt_keys]" >> ./couchdb/local.ini
echo "rsa:${PROFILE_NAME}=${FLATTENED_KEY}" >> ./couchdb/local.ini
echo '[admin]' >> ./couchdb/local.ini
echo "admin=${COUCHDB_PASSWORD}" >> ./couchdb/local.ini

cat ./couchdb/local.ini


