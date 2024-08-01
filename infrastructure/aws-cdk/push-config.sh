#!/bin/bash

# Pushes and commits an environment specific set of configuration files
# (currently configs/<stage>json and cdk.context.json) into an existing
# compliant config repo. 
# ./push_config.sh <clone_string> <environment> [--force] [--branch <branch_name>] [--message <commit_message>]

set -e

# Function to confirm action
confirm_action() {
    read -p "$1 (y/N): " choice
    case "$choice" in 
        y|Y ) return 0;;
        * ) return 1;;
    esac
}

# Function to check if file exists and confirm overwrite
check_and_confirm_overwrite() {
    local file="$1"
    if [ -f "$file" ]; then
        if [ "$FORCE" = true ]; then
            return 0
        else
            confirm_action "File $file already exists. Overwrite?"
            return $?
        fi
    fi
    return 0
}

# Parse arguments
FORCE=false
CLONE_STRING=""
ENVIRONMENT=""
BRANCH="main"
COMMIT_MSG="configuration update faims3"

while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE=true
            shift
            ;;
        --branch)
            BRANCH="$2"
            shift 2
            ;;
        --message)
            COMMIT_MSG="$2"
            shift 2
            ;;
        *)
            if [ -z "$CLONE_STRING" ]; then
                CLONE_STRING="$1"
            elif [ -z "$ENVIRONMENT" ]; then
                ENVIRONMENT="$1"
            else
                echo "Usage: $0 <clone_string> <environment> [--force] [--branch <branch_name>] [--message <commit_message>]"
                exit 1
            fi
            shift
            ;;
    esac
done

# Check if required arguments are provided
if [ -z "$CLONE_STRING" ] || [ -z "$ENVIRONMENT" ]; then
    echo "Usage: $0 <clone_string> <environment> [--force] [--branch <branch_name>] [--message <commit_message>]"
    exit 1
fi

# Clone the repository
TEMP_DIR=$(mktemp -d)
CURRENT_DIR=$(pwd)
git clone "$CLONE_STRING" "$TEMP_DIR"
cd "$TEMP_DIR"
git checkout "$BRANCH"

# Define target directories
TARGET_DIR="infrastructure/$ENVIRONMENT"
CONFIG_DIR="$TARGET_DIR/configs"

# Create directories if they don't exist
mkdir -p "$CONFIG_DIR"

# Copy cdk.context.json
CDK_CONTEXT="cdk.context.json"
if [ -f "$CURRENT_DIR/$CDK_CONTEXT" ]; then
    if check_and_confirm_overwrite "$CDK_CONTEXT"; then
        cp "$CURRENT_DIR/$CDK_CONTEXT" "$TARGET_DIR/"
        echo "Copied $CDK_CONTEXT to $TARGET_DIR/"
    else
        echo "Skipped copying $CDK_CONTEXT"
    fi
else
    echo "Warning: $CDK_CONTEXT does not exist in the source directory."
    confirm_action "Continue without $CDK_CONTEXT?" || exit 1
fi

# Copy environment-specific config file
CONFIG_FILE="configs/$ENVIRONMENT.json"
if [ -f "$CURRENT_DIR/$CONFIG_FILE" ]; then
    if check_and_confirm_overwrite "$CONFIG_DIR/$ENVIRONMENT.json"; then
        cp "$CURRENT_DIR/$CONFIG_FILE" "$CONFIG_DIR/"
        echo "Copied $CONFIG_FILE to $CONFIG_DIR/"
    else
        echo "Skipped copying $CONFIG_FILE"
    fi
else
    echo "Warning: $CONFIG_FILE does not exist in the source directory."
    confirm_action "Continue without $CONFIG_FILE?" || exit 1
fi

# Check for differences in cdk.context.json
if [ -f "$TARGET_DIR/$CDK_CONTEXT" ] && [ -f "$CURRENT_DIR/$CDK_CONTEXT" ]; then
    if ! diff -q "$TARGET_DIR/$CDK_CONTEXT" "$CURRENT_DIR/$CDK_CONTEXT" > /dev/null; then
        echo "Warning: The $CDK_CONTEXT file is different from the one in the config repo."
        confirm_action "Continue with the update?" || exit 1
    fi
fi

# Commit and push changes
git add .
git commit -m "$COMMIT_MSG"
git push origin "$BRANCH"

echo "Changes have been pushed to the config repository."

# Clean up
cd ..
rm -rf "$TEMP_DIR"
echo "Cleaned up temporary files"