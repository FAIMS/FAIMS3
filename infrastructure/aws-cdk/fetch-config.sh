#!/bin/bash

# This script fetches the config from a suitable private config repository for
# the FAIMS3 aws-cdk infrastructure. It then merges the targeted environments
# files into the current CDK project.
# Example usage: ./setup_config.sh "https://github.com/your-repo.git" "dev" [--force]

# Function to confirm overwrite
confirm_overwrite() {
    local file="$1"
    read -p "File $file already exists. Overwrite? (y/N): " choice
    case "$choice" in 
        y|Y ) return 0;;
        * ) return 1;;
    esac
}

# Parse arguments
FORCE=false
CLONE_STRING=""
ENVIRONMENT=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE=true
            shift
            ;;
        *)
            if [ -z "$CLONE_STRING" ]; then
                CLONE_STRING="$1"
            elif [ -z "$ENVIRONMENT" ]; then
                ENVIRONMENT="$1"
            else
                echo "Usage: $0 <clone_string> <environment> [--force]"
                exit 1
            fi
            shift
            ;;
    esac
done

# Check if required arguments are provided
if [ -z "$CLONE_STRING" ] || [ -z "$ENVIRONMENT" ]; then
    echo "Usage: $0 <clone_string> <environment> [--force]"
    exit 1
fi

# Clone the repository
TEMP_DIR=$(mktemp -d)
git clone "$CLONE_STRING" "$TEMP_DIR"

if [ $? -ne 0 ]; then
    echo "Failed to clone repository"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Check if the environment folder exists
ENV_DIR="$TEMP_DIR/infrastructure/$ENVIRONMENT"
if [ ! -d "$ENV_DIR" ]; then
    echo "Environment folder '$ENVIRONMENT' not found in the cloned repository"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Copy files from the environment folder to the current aws-cdk workspace
for file in $(find "$ENV_DIR" -type f); do
    relative_path=${file#$ENV_DIR/}
    target_file="$relative_path"
    target_dir=$(dirname "$target_file")
    
    # Create parent directories if they don't exist
    mkdir -p "$target_dir"
    
    # Check if file exists and confirm overwrite if necessary
    if [ -f "$target_file" ] && [ "$FORCE" = false ]; then
        if confirm_overwrite "$target_file"; then
            cp "$file" "$target_file"
            echo "Copied and overwrote: $target_file"
        else
            echo "Skipped: $target_file"
        fi
    else
        cp "$file" "$target_file"
        echo "Copied: $target_file"
    fi
done

# Inform about setting the CONFIG_FILE_NAME environment variable
echo "Run the following to use this config:"
echo "export CONFIG_FILE_NAME=${ENVIRONMENT}.json"

# Clean up the cloned repository
rm -rf "$TEMP_DIR"
echo "Cleaned up temporary files"

echo "Config setup complete for environment: $ENVIRONMENT"