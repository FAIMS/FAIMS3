#!/usr/bin/env bash
set -euo pipefail

# Script to generate production RSA keys, CouchDB local.ini configuration, and production secrets.

ENV_FILE="${1:-.env.prod}"

if [ ! -f "$ENV_FILE" ]; then
    echo "Creating $ENV_FILE from .env.prod.dist..."
    cp .env.prod.dist "$ENV_FILE"
    
    # Generate random secrets for COUCHDB_PASSWORD and FAIMS_COOKIE_SECRET
    RAND_COOKIE_SECRET=$(openssl rand -hex 32 2>/dev/null || python3 -c 'import secrets; print(secrets.token_hex(32))')
    RAND_COUCH_PASS=$(openssl rand -hex 24 2>/dev/null || python3 -c 'import secrets; print(secrets.token_hex(24))')
    
    sed -i "s/CHANGE_ME_SECURE_COOKIE_SECRET/${RAND_COOKIE_SECRET}/" "$ENV_FILE"
    sed -i "s/CHANGE_ME_SECURE_COUCHDB_PASSWORD/${RAND_COUCH_PASS}/" "$ENV_FILE"
fi

# Load variables from env file
export $(grep -v '^#' "$ENV_FILE" | grep -v '^\s*$' | xargs)

KEYS_DIR="./api/keys"
mkdir -p "$KEYS_DIR"

PROFILE="${PROFILE_NAME:-production}"
PRIV_KEY="${KEYS_DIR}/${PROFILE}_private_key.pem"
PUB_KEY="${KEYS_DIR}/${PROFILE}_public_key.pem"

echo "Generating RSA 2048 signing keys for profile '$PROFILE'..."
openssl genpkey -algorithm RSA -out "$PRIV_KEY" -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in "$PRIV_KEY" -out "$PUB_KEY"

# Generate flattened public key for CouchDB JWT configuration
FLATTENED_PUB_KEY=$(awk '{printf "%s\\n", $0}' "$PUB_KEY")

COUCH_INI="./api/couchdb/local.ini"
mkdir -p "$(dirname "$COUCH_INI")"

if [ -f "./api/couchdb/local.ini.dist" ]; then
    cp ./api/couchdb/local.ini.dist "$COUCH_INI"
else
    cat << 'EOF' > "$COUCH_INI"
[couchdb]
single_node=true

[chttpd]
bind_address = 0.0.0.0

[chttpd_auth]
require_valid_user = true
authentication_redirect = /_utils/session.html

[httpd]
WWW-Authenticate = Basic realm="administrator"

[jwt_auth]
required_claims =
EOF
fi

# Update CouchDB local.ini with secrets and JWT public keys
COUCH_UUID=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || openssl rand -hex 16)

sed -i "s/secret = .*/secret = ${FAIMS_COOKIE_SECRET}/" "$COUCH_INI" 2>/dev/null || true
sed -i "s/uuid = .*/uuid = ${COUCH_UUID}/" "$COUCH_INI" 2>/dev/null || true

# Append JWT public key & admin user credentials if not present
if ! grep -q "\[jwt_keys\]" "$COUCH_INI"; then
    echo "" >> "$COUCH_INI"
    echo "[jwt_keys]" >> "$COUCH_INI"
fi
echo "rsa:${PROFILE}=${FLATTENED_PUB_KEY}" >> "$COUCH_INI"

if ! grep -q "\[admins\]" "$COUCH_INI"; then
    echo "" >> "$COUCH_INI"
    echo "[admins]" >> "$COUCH_INI"
fi
echo "${COUCHDB_USER:-admin} = ${COUCHDB_PASSWORD}" >> "$COUCH_INI"

chmod 600 "$PRIV_KEY"
chmod 644 "$PUB_KEY"
chmod 644 "$COUCH_INI"

echo "Successfully generated production keys, CouchDB configuration, and secrets!"
echo "  Private Key: $PRIV_KEY"
echo "  Public Key:  $PUB_KEY"
echo "  CouchDB Config: $COUCH_INI"
