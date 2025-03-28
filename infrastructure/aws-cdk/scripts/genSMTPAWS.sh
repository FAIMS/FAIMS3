#!/bin/bash

# genSMTPAWS.sh - Script to generate and store SMTP credentials in AWS Secrets Manager
# Usage: ./genSMTPAWS.sh

set -e

# Colors for better output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed.${NC}"
    echo "Please install AWS CLI first: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

# Function to get AWS account ID
get_aws_account_id() {
    aws sts get-caller-identity --query "Account" --output text
}

# Check AWS credentials
echo -e "${BLUE}Checking AWS credentials...${NC}"
AWS_ACCOUNT_ID=$(get_aws_account_id) || {
    echo -e "${RED}Error: Failed to get AWS account ID. Check your AWS credentials.${NC}"
    exit 1
}
echo -e "${GREEN}AWS credentials valid. Account ID: $AWS_ACCOUNT_ID${NC}"

# Interactive prompts for SMTP configuration
echo -e "\n${YELLOW}===== SMTP Configuration Wizard =====${NC}"
echo -e "${BLUE}Please provide your SMTP server details:${NC}"

# Secret name
read -p "Secret name (default: faims-smtp-credentials): " SECRET_NAME
SECRET_NAME=${SECRET_NAME:-faims-smtp-credentials}

# SMTP Host
read -p "SMTP server hostname (e.g., smtp.gmail.com): " SMTP_HOST
while [ -z "$SMTP_HOST" ]; do
    echo -e "${RED}SMTP hostname cannot be empty${NC}"
    read -p "SMTP server hostname (e.g., smtp.gmail.com): " SMTP_HOST
done

# SMTP Port
read -p "SMTP server port (default: 587): " SMTP_PORT
SMTP_PORT=${SMTP_PORT:-587}

# SMTP Security
read -p "Use secure connection? (true/false, default: true): " SMTP_SECURE
SMTP_SECURE=${SMTP_SECURE:-true}

# SMTP Username
read -p "SMTP username: " SMTP_USER
while [ -z "$SMTP_USER" ]; do
    echo -e "${RED}SMTP username cannot be empty${NC}"
    read -p "SMTP username: " SMTP_USER
done

# SMTP Password (hidden input)
read -s -p "SMTP password: " SMTP_PASS
echo
while [ -z "$SMTP_PASS" ]; do
    echo -e "${RED}SMTP password cannot be empty${NC}"
    read -s -p "SMTP password: " SMTP_PASS
    echo
done

# Confirm details
echo -e "\n${YELLOW}=== Review Configuration ===${NC}"
echo -e "Secret Name: ${GREEN}$SECRET_NAME${NC}"
echo -e "SMTP Host: ${GREEN}$SMTP_HOST${NC}"
echo -e "SMTP Port: ${GREEN}$SMTP_PORT${NC}"
echo -e "SMTP Secure: ${GREEN}$SMTP_SECURE${NC}"
echo -e "SMTP Username: ${GREEN}$SMTP_USER${NC}"
echo -e "SMTP Password: ${GREEN}*******${NC}"

read -p "Proceed with creating the secret? (y/n): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo -e "${RED}Operation cancelled.${NC}"
    exit 0
fi

# Create JSON for secret
SECRET_STRING=$(cat <<EOF
{
  "host": "$SMTP_HOST",
  "port": "$SMTP_PORT",
  "secure": "$SMTP_SECURE",
  "user": "$SMTP_USER",
  "pass": "$SMTP_PASS"
}
EOF
)

echo -e "\n${BLUE}Creating secret in AWS Secrets Manager...${NC}"

# Create the secret in AWS Secrets Manager
SECRET_ARN=$(aws secretsmanager create-secret \
    --name "$SECRET_NAME" \
    --description "SMTP credentials for FAIMS" \
    --secret-string "$SECRET_STRING" \
    --query ARN --output text)

# Check if secret was created successfully
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Secret created successfully!${NC}"
    
    # Display the secret ARN
    echo -e "\n${YELLOW}=== SMTP Secret Created ===${NC}"
    echo -e "Secret ARN: ${GREEN}$SECRET_ARN${NC}"
    
    # Instructions for configuration
    echo -e "\n${YELLOW}=== Next Steps ===${NC}"
    echo -e "Add the following to your FAIMS configuration file (${BLUE}configs/your-config.json${NC}):"
    echo -e "${GREEN}"
    cat <<EOF
"smtp": {
  "emailServiceType": "SMTP",
  "fromEmail": "your-sender@example.com",
  "fromName": "FAIMS Notification System",
  "replyTo": "support@example.com",
  "testEmailAddress": "admin@example.com",
  "cacheExpirySeconds": 300,
  "credentialsSecretArn": "$SECRET_ARN"
}
EOF
    echo -e "${NC}"
    echo -e "Make sure to replace the example email addresses with your actual values."
else
    echo -e "${RED}Failed to create secret. Please check your AWS permissions.${NC}"
fi

echo -e "\n${BLUE}Done!${NC}"