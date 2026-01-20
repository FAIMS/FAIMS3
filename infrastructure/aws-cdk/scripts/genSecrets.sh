#!/usr/bin/env bash

# Generates secrets in AWS Secrets Manager from a local JSON configuration file.
# with the format:
# {
#   "faims-auth-credentials-prod": {
#     "google": {
#       "clientID": "your-google-client-id",
#       "clientSecret": "your-google-client-secret"
#     },
#     "oidc": {
#       "clientID": "your-oidc-client-id",
#       "clientSecret": "your-oidc-client-secret"
#     }
#   },
#   "faims-smtp-credentials-prod": {
#     "user": "email@email.com",
#     "pass": "password"
#   }
# }
# For each key in the top-level object, a secret will be created in AWS Secrets Manager
# with the name of the key, and the value will be the JSON string of the corresponding
# object.
# Outputs the ARNs of the created secrets as a JSON object.

set -euo pipefail

# Disable AWS CLI pager
export AWS_PAGER=""

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

# Function to display usage information
usage() {
    echo "Usage: $0 <secrets_file> <region> [--replace]"
    echo "  <secrets_file>: Path to JSON file containing secrets"
    echo "  <region>: AWS region (e.g., us-east-1, ap-southeast-2)"
    echo "  [--replace]: Optional flag to replace existing secrets instead of aborting."
    echo ""
    echo "Expected JSON format:"
    echo '  {'
    echo '    "secret-name-1": { "key": "value", ... },'
    echo '    "secret-name-2": { "key": "value", ... }'
    echo '  }'
    exit 1
}

# Parse command line arguments
SECRETS_FILE=""
REGION=""
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
            elif [ -z "$REGION" ]; then
                REGION="$1"
            else
                usage
            fi
            shift
            ;;
    esac
done

# Validate arguments
if [ -z "$SECRETS_FILE" ]; then
    echo "Error: Configuration file path is required."
    usage
fi

if [ -z "$REGION" ]; then
    echo "Error: AWS region is required."
    usage
fi

# Check if config file exists
if [ ! -f "$SECRETS_FILE" ]; then
    echo "Error: Configuration file '$SECRETS_FILE' not found."
    exit 1
fi

# Validate JSON format
if ! jq empty "$SECRETS_FILE" 2>/dev/null; then
    echo "Error: Configuration file is not valid JSON."
    exit 1
fi

# Function to create or update secret
create_or_update_secret() {
    local secret_name="$1"
    local secret_json="$2"
    
    if aws secretsmanager describe-secret --secret-id "$secret_name" --region "$REGION" &> /dev/null; then
        if [ "$REPLACE" = true ]; then
            echo "Replacing existing secret: $secret_name"
            aws secretsmanager put-secret-value --secret-id "$secret_name" --secret-string "$secret_json" --region "$REGION"
        else
            echo "Error: Secret '$secret_name' already exists. Use --replace to overwrite or choose a different name."
            exit 1
        fi
    else
        echo "Creating new secret: $secret_name"
        aws secretsmanager create-secret --name "$secret_name" --secret-string "$secret_json" --region "$REGION"
    fi
}

# Create temporary file to store ARNs
TEMP_ARNS=$(mktemp)
trap "rm -f $TEMP_ARNS" EXIT

# Read top-level keys and process each secret
echo "Processing secrets from $SECRETS_FILE..."
echo "Region: $REGION"
echo

for secret_name in $(jq -r 'keys[]' "$SECRETS_FILE"); do
    # Extract the value for this secret
    secret_value=$(jq -c ".[\"$secret_name\"]" "$SECRETS_FILE")
    
    # Create or update the secret
    create_or_update_secret "$secret_name" "$secret_value"
    
    # Get and store the ARN
    arn=$(aws secretsmanager describe-secret --secret-id "$secret_name" --region "$REGION" | jq -r .ARN)
    echo "$secret_name|$arn" >> "$TEMP_ARNS"
    
    echo "  Name: $secret_name"
    echo "  ARN:  $arn"
    echo
done

# Output ARNs as JSON object
echo "All secrets processed successfully."
echo
echo "Secret ARNs (JSON):"
echo "{"
first=true
while IFS='|' read -r name arn; do
    if [ "$first" = true ]; then
        first=false
    else
        echo ","
    fi
    echo -n "  \"$name\": \"$arn\""
done < "$TEMP_ARNS"
echo
echo "}"