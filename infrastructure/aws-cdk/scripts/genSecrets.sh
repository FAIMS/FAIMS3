#!/usr/bin/env bash

# Generates secrets in AWS Secrets Manager from a local JSON configuration file.
# with the format:
# {
#   "auth": {
#     "google-clientID": "your-google-client-id",
#     "google-clientSecret": "your-google-client-secret",
#     "oidc-clientID": "your-oidc-client-id",
#     "oidc-clientSecret": "your-oidc-client-secret",
#     "samlProvider-privateKey": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----",
#     "samlProvider-publicKey": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
#   },
#   "smtp": {
#     "host": "smtp.example.com",
#     "port": "587",
#     "secure": "true",
#     "user": "email@email.com",
#     "pass": "password"
#   }
# }
#
# We expect two keys 'auth' and 'smtp' at the top level.
#
# Auth secrets format by provider type:
#   - Google/OIDC: <provider>-clientID and <provider>-clientSecret
#   - SAML: <provider>-privateKey (SP signing key) and <provider>-publicKey (IdP certificate)
#
# The provider name must match the key used in authProviders.config in your deployment config.
# For example, if your config has authProviders.config.fasThirdParty, use:
#   "fasThirdParty-privateKey" and "fasThirdParty-publicKey"
#
# We also have a JSON configuration file passed as an argument
# that contains details of our deployment, the generated secret
# ARNs that we generate here will be inserted into this second JSON file.
#
# The arn generated for 'auth' will be inserted at path 'authProviders.secretArn'
# The arn generated for 'smtp' will be inserted at path 'smtp.credentialsSecretArn'
#
# The value of 'region' can be found in the second JSON file at path `aws.region`.
#

set -euo pipefail

# Disable AWS CLI pager
export AWS_PAGER=""

# Check if jq is installed
if ! command -v jq &>/dev/null; then
  echo "Error: jq is not installed. Please install jq to run this script."
  exit 1
fi

# Check if AWS CLI is configured properly
if ! aws sts get-caller-identity &>/dev/null; then
  echo "Error: AWS CLI is not configured properly. Please set up your AWS credentials."
  exit 1
fi

# Function to display usage information
usage() {
  echo "Usage: $0 <secrets_file> <config_file> [--replace]"
  echo "  <secrets_file>: Path to JSON file containing secrets (with 'auth' and 'smtp' keys)"
  echo "  <config_file>: Path to deployment configuration JSON file"
  echo "  [--replace]: Optional flag to replace existing secrets instead of aborting."
  echo ""
  echo "Expected secrets JSON format:"
  echo '  {'
  echo '    "auth": {'
  echo '      "google-clientID": "...", "google-clientSecret": "...",'
  echo '      "oidc-clientID": "...", "oidc-clientSecret": "...",'
  echo '      "samlProvider-privateKey": "-----BEGIN RSA PRIVATE KEY-----\\n...\\n-----END RSA PRIVATE KEY-----",'
  echo '      "samlProvider-publicKey": "-----BEGIN CERTIFICATE-----\\n...\\n-----END CERTIFICATE-----"'
  echo '    },'
  echo '    "smtp": { "host": "...", "port": "...", "secure": "...", "user": "...", "pass": "..." }'
  echo '  }'
  echo ""
  echo "Auth provider types:"
  echo "  - Google/OIDC: Use <provider>-clientID and <provider>-clientSecret"
  echo "  - SAML: Use <provider>-privateKey (your SP key) and <provider>-publicKey (IdP cert)"
  exit 1
}

# Parse command line arguments
SECRETS_FILE=""
CONFIG_FILE=""
REPLACE=false

while [[ $# -gt 0 ]]; do
  case $1 in
  --replace)
    REPLACE=true
    shift
    ;;
  *)
    if [ -z "$SECRETS_FILE" ]; then
      SECRETS_FILE="$1"
    elif [ -z "$CONFIG_FILE" ]; then
      CONFIG_FILE="$1"
    else
      usage
    fi
    shift
    ;;
  esac
done

# Validate arguments
if [ -z "$SECRETS_FILE" ]; then
  echo "Error: Secrets file path is required."
  usage
fi

if [ -z "$CONFIG_FILE" ]; then
  echo "Error: Configuration file path is required."
  usage
fi

# Check if files exist
if [ ! -f "$SECRETS_FILE" ]; then
  echo "Error: Secrets file '$SECRETS_FILE' not found."
  exit 1
fi

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: Configuration file '$CONFIG_FILE' not found."
  exit 1
fi

# Validate JSON format
if ! jq empty "$SECRETS_FILE" 2>/dev/null; then
  echo "Error: Secrets file is not valid JSON."
  exit 1
fi

if ! jq empty "$CONFIG_FILE" 2>/dev/null; then
  echo "Error: Configuration file is not valid JSON."
  exit 1
fi

# Extract region from config file
REGION=$(jq -r '.aws.region' "$CONFIG_FILE")
if [ -z "$REGION" ] || [ "$REGION" = "null" ]; then
  echo "Error: Could not find 'aws.region' in configuration file."
  exit 1
fi

# Extract stack name from config file
STACK_NAME=$(jq -r '.stackName' "$CONFIG_FILE")
if [ -z "$STACK_NAME" ] || [ "$STACK_NAME" = "null" ]; then
  echo "Error: Could not find 'stackName' in configuration file."
  exit 1
fi

# Validate that secrets file has required keys
if ! jq -e '.auth' "$SECRETS_FILE" &>/dev/null; then
  echo "Error: Secrets file must contain 'auth' key."
  exit 1
fi

if ! jq -e '.smtp' "$SECRETS_FILE" &>/dev/null; then
  echo "Error: Secrets file must contain 'smtp' key."
  exit 1
fi

# Function to create or update secret
create_or_update_secret() {
  local secret_name="$1"
  local secret_json="$2"

  if aws secretsmanager describe-secret --secret-id "$secret_name" --region "$REGION" &>/dev/null; then
    if [ "$REPLACE" = true ]; then
      echo "Replacing existing secret: $secret_name"
      aws secretsmanager put-secret-value --secret-id "$secret_name" --secret-string "$secret_json" --region "$REGION" >/dev/null
    else
      echo "Error: Secret '$secret_name' already exists. Use --replace to overwrite or choose a different name."
      exit 1
    fi
  else
    echo "Creating new secret: $secret_name"
    aws secretsmanager create-secret --name "$secret_name" --secret-string "$secret_json" --region "$REGION" >/dev/null
  fi
}

echo "Processing secrets from $SECRETS_FILE..."
echo "Region: $REGION"
echo "Stack Name: $STACK_NAME"
echo

# Process 'auth' secret
AUTH_SECRET_VALUE=$(jq -c '.auth' "$SECRETS_FILE")
AUTH_SECRET_NAME="${STACK_NAME}-auth"

create_or_update_secret "$AUTH_SECRET_NAME" "$AUTH_SECRET_VALUE"
AUTH_ARN=$(aws secretsmanager describe-secret --secret-id "$AUTH_SECRET_NAME" --region "$REGION" | jq -r .ARN)

echo "  Name: $AUTH_SECRET_NAME"
echo "  ARN:  $AUTH_ARN"

# Show detected provider types
echo "  Detected providers:"
for key in $(jq -r '.auth | keys[]' "$SECRETS_FILE" | sed 's/-clientID$//' | sed 's/-clientSecret$//' | sed 's/-privateKey$//' | sed 's/-publicKey$//' | sort -u); do
  if jq -e ".auth[\"${key}-privateKey\"]" "$SECRETS_FILE" &>/dev/null; then
    echo "    - $key (SAML)"
  elif jq -e ".auth[\"${key}-clientID\"]" "$SECRETS_FILE" &>/dev/null; then
    echo "    - $key (OAuth/OIDC)"
  fi
done
echo

# Process 'smtp' secret
SMTP_SECRET_VALUE=$(jq -c '.smtp' "$SECRETS_FILE")
SMTP_SECRET_NAME="${STACK_NAME}-smtp"

create_or_update_secret "$SMTP_SECRET_NAME" "$SMTP_SECRET_VALUE"
SMTP_ARN=$(aws secretsmanager describe-secret --secret-id "$SMTP_SECRET_NAME" --region "$REGION" | jq -r .ARN)

echo "  Name: $SMTP_SECRET_NAME"
echo "  ARN:  $SMTP_ARN"
echo

# Update config file with ARNs
echo "Updating configuration file with secret ARNs..."

UPDATED_CONFIG=$(jq \
  --arg auth_arn "$AUTH_ARN" \
  --arg smtp_arn "$SMTP_ARN" \
  '.authProviders.secretArn = $auth_arn | .smtp.credentialsSecretArn = $smtp_arn' \
  "$CONFIG_FILE")

echo "$UPDATED_CONFIG" >"$CONFIG_FILE"

echo "Configuration file updated successfully."
echo
echo "Summary:"
echo "  Auth secret ARN inserted at: authProviders.secretArn"
echo "  SMTP secret ARN inserted at: smtp.credentialsSecretArn"
