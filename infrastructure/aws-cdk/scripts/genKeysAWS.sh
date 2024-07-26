#!/usr/bin/env bash

# Generates an RSA key pair suitable for signing JWTs. Conductor will know about
# the private key, and couch will be configured to respect the public key to
# validate signatures. Uploads the keys to two AWS secrets, one for just the
# public, and the other for private and public. The conductor can be configured
# to retrieve this secret and remotely configure the DB to use it.

set -euo pipefail

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is not installed. Please install jq to run this script."
    exit 1
fi

# Check if AWS CLI is configured properly
if ! aws sts get-caller-identity &> /dev/null; then
    echo "Error: AWS CLI is not configured properly. Please set up your AWS credentials."
    exit 1
fi

# Check if OpenSSL is installed
if ! command -v openssl &> /dev/null; then
    echo "Error: OpenSSL is not installed. Please install OpenSSL to run this script."
    exit 1
fi

# Check if OpenSSL is working properly
if ! openssl version &> /dev/null; then
    echo "Error: OpenSSL is installed but not working properly. Please check your OpenSSL configuration."
    exit 1
fi

# Function to display usage information
usage() {
    echo "Usage: $0 <host_target> [profile_name] [--replace]"
    echo "  <host_target>: The name of the host - e.g. dev, prod. Just a name."
    echo "  [profile_name]: The name of the profile to generate keys. Recommend leaving as default. (default: 'default')"
    echo "  [--replace]: Optional flag to replace existing secrets instead of aborting."
    exit 1
}

# Parse command line arguments
HOST_TARGET=""
PROFILE_NAME="default"
REPLACE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --replace)
            REPLACE=true
            shift
            ;;
        *)
            if [ -z "$HOST_TARGET" ]; then
                HOST_TARGET="$1"
            elif [ "$PROFILE_NAME" == "default" ]; then
                PROFILE_NAME="$1"
            else
                usage
            fi
            shift
            ;;
    esac
done

# Validate arguments are not empty
if [ -z "$HOST_TARGET" ] || [ -z "$PROFILE_NAME" ]; then
    echo "Error: Both host target and profile name must be non-empty."
    usage
fi

# Set variables
SECRET_PREFIX="dev-keys"
PUBLIC_SECRET_NAME="${SECRET_PREFIX}-${HOST_TARGET}-${PROFILE_NAME}-public"
PRIVATE_SECRET_NAME="${SECRET_PREFIX}-${HOST_TARGET}-${PROFILE_NAME}-private"

echo "Generating keys for ${PROFILE_NAME}: ${HOST_TARGET}"

# Function to create or update secret
create_or_update_secret() {
    local secret_name="$1"
    local secret_json="$2"
    local description="$3"
    
    if aws secretsmanager describe-secret --secret-id "$secret_name" &> /dev/null; then
        if [ "$REPLACE" = true ]; then
            echo "Replacing existing secret: $secret_name"
            aws secretsmanager put-secret-value --secret-id "$secret_name" --secret-string "$secret_json"
        else
            echo "Error: Secret '$secret_name' already exists. Use --replace to overwrite or choose a different name."
            exit 1
        fi
    else
        aws secretsmanager create-secret --name "$secret_name" --description "$description" --secret-string "$secret_json"
    fi
}

# Generate RSA key pair
PRIVATE_KEY=$(openssl genpkey -algorithm RSA -out - -pkeyopt rsa_keygen_bits:2048 2>/dev/null)
PUBLIC_KEY=$(echo "$PRIVATE_KEY" | openssl rsa -pubout 2>/dev/null)

# Create JSON for public key secret
PUBLIC_SECRET_JSON=$(jq -n \
                    --arg pub "$PUBLIC_KEY" \
                    --arg profile "$PROFILE_NAME" \
                    --arg host "$HOST_TARGET" \
                    '{rsa_public_key: $pub, profile_name: $profile, host_target: $host}')

# Create JSON for private key secret
PRIVATE_SECRET_JSON=$(jq -n \
                     --arg priv "$PRIVATE_KEY" \
                     --arg pub "$PUBLIC_KEY" \
                     --arg profile "$PROFILE_NAME" \
                     --arg host "$HOST_TARGET" \
                     '{rsa_private_key: $priv, rsa_public_key: $pub, profile_name: $profile, host_target: $host}')

# Store or update public key in AWS Secrets Manager
PUBLIC_SECRET_OUTPUT=$(create_or_update_secret "$PUBLIC_SECRET_NAME" "$PUBLIC_SECRET_JSON" "RSA public key for $PROFILE_NAME on $HOST_TARGET")

# Store or update private key in AWS Secrets Manager
PRIVATE_SECRET_OUTPUT=$(create_or_update_secret "$PRIVATE_SECRET_NAME" "$PRIVATE_SECRET_JSON" "RSA private key for $PROFILE_NAME on $HOST_TARGET")

echo "Keys generated and stored in AWS Secrets Manager successfully."
echo
echo "Public Key Secret:"
echo "  Name: $PUBLIC_SECRET_NAME"
echo "  ARN:  $(aws secretsmanager describe-secret --secret-id "$PUBLIC_SECRET_NAME" | jq -r .ARN)"
echo
echo "Private Key Secret:"
echo "  Name: $PRIVATE_SECRET_NAME"
echo "  ARN:  $(aws secretsmanager describe-secret --secret-id "$PRIVATE_SECRET_NAME" | jq -r .ARN)"