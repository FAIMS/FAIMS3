#!/bin/bash
# This script handles both pushing and pulling configuration files for the FAIMS3 aws-cdk infrastructure.
# It can interact with a private config repository or use a local path to an already cloned repository.
# Example usage: ./config.sh <push/pull> <environment> [options]

set -e

# Function to display help message
display_help() {
    echo "Usage: $0 <push/pull> <environment> [options]"
    echo
    echo "This script manages configuration files for FAIMS3 aws-cdk infrastructure."
    echo
    echo "Commands:"
    echo "  push                       Push configuration files to the config repository"
    echo "  pull                       Pull configuration files from the config repository"
    echo
    echo "Arguments:"
    echo "  <environment>              The target environment (e.g., dev, stage, prod)"
    echo
    echo "Options:"
    echo "  --force                    Overwrite existing files without confirmation"
    echo "  --branch <branch_name>     Specify the git branch (default: main, for both push and pull)"
    echo "  --message <commit_message> Specify a custom commit message (push only)"
    echo "  --config_repo <url>        Override the config repository URL"
    echo "  --repo-path <path>         Path to an already cloned repository (overrides --config_repo and environments.json)"
    echo "  --help                     Display this help message and exit"
    echo
    echo "How it works:"
    echo "1. The script checks for an 'environments.json' file to get the config repository URL (unless --repo-path is used)."
    echo "2. For pull: It uses the specified repo path or clones the repo, checks out the specified branch, and copies environment-specific files to the current workspace."
    echo "3. For push: It uses the specified repo path or clones the repo, checks out the specified branch, copies files from the workspace to the repo, commits, and pushes."
    echo "4. If --force is not used, it will prompt for confirmation before overwriting existing files."
    echo
    echo "Note: If --repo-path is provided, --config_repo will be ignored and environments.json will not be used."
    echo "      If the environment is not found in environments.json and no --config_repo or --repo-path is provided,"
    echo "      the script will exit with an error. If --config_repo is provided for a new environment,"
    echo "      it will update or create the environments.json file with the new entry."
}

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

# Function to get config repo URL from environments.json
get_config_repo() {
    local env="$1"
    if [ -f "environments.json" ]; then
        repo_url=$(jq -r ".$env.config_repo" environments.json 2>/dev/null)
        if [ "$repo_url" != "null" ] && [ -n "$repo_url" ]; then
            echo "$repo_url"
            return 0
        fi
    fi
    return 1
}

# Function to update or create environments.json
update_environments_json() {
    local env="$1"
    local repo_url="$2"
    if [ -f "environments.json" ]; then
        # Update existing file
        jq ".$env.config_repo = \"$repo_url\"" environments.json > environments.json.tmp && mv environments.json.tmp environments.json
    else
        # Create new file
        echo "{\"$env\": {\"config_repo\": \"$repo_url\"}}" > environments.json
    fi
    echo "Updated environments.json with new entry for $env"
}

# Function to prepare repository (either use existing path or clone)
prepare_repository() {
    local repo="$1"
    local branch="$2"
    
    if [ -d "$repo" ]; then
        # Use existing repo path
        cd "$repo"
        git fetch origin
        git checkout "$branch"
        git pull origin "$branch"
        TEMP_DIR=""
    else
        # Clone the repository
        TEMP_DIR=$(mktemp -d)
        git clone "$repo" "$TEMP_DIR"
        if [ $? -ne 0 ]; then
            echo "Failed to clone repository"
            return 1
        fi
        cd "$TEMP_DIR"
        
        # Check if the branch exists
        git ls-remote --exit-code --heads origin "$branch" > /dev/null 2>&1
        if [ $? -ne 0 ]; then
            echo "Branch '$branch' does not exist in the remote repository."
            echo "Creating new branch '$branch'..."
            git checkout -b "$branch"
        else
            git checkout "$branch"
        fi
        
        if [ $? -ne 0 ]; then
            echo "Failed to checkout branch: $branch"
            return 1
        fi
    fi
    
    return 0
}

# Function to copy file with overwrite check
copy_file_with_check() {
    local source="$1"
    local target="$2"
    local file_name="$3"

    if [ -f "$source" ]; then
        if check_and_confirm_overwrite "$target"; then
            cp "$source" "$target"
            echo "Copied $file_name to $target"
        else
            echo "Skipped copying $file_name"
        fi
    else
        echo "Warning: $file_name does not exist in the source directory."
        confirm_action "Continue without $file_name?" || exit 1
    fi
}

# Function to pull configuration
pull_config() {
    local env="$1"
    local repo="$2"
    local force="$3"
    local branch="$4"

    CURRENT_DIR=$(pwd)

    if ! prepare_repository "$repo" "$branch"; then
        cd "$CURRENT_DIR"
        [ -n "$TEMP_DIR" ] && rm -rf "$TEMP_DIR"
        exit 1
    fi

    # Check if the environment folder exists
    ENV_DIR="infrastructure/$env"
    if [ ! -d "$ENV_DIR" ]; then
        echo "Environment folder '$env' not found in the repository"
        cd "$CURRENT_DIR"
        [ -n "$TEMP_DIR" ] && rm -rf "$TEMP_DIR"
        exit 1
    fi

    # Copy files from the environment folder to the current aws-cdk workspace
    cd "$CURRENT_DIR"
    for file in $(find "${TEMP_DIR:-$repo}/$ENV_DIR" -type f); do
        relative_path=${file#${TEMP_DIR:-$repo}/$ENV_DIR/}
        target_file="$relative_path"
        target_dir=$(dirname "$target_file")
        
        # Create parent directories if they don't exist
        mkdir -p "$target_dir"
        
        # Copy file with overwrite check
        copy_file_with_check "$file" "$target_file" "$relative_path"
    done

    # Clean up the cloned repository if it was temporary
    [ -n "$TEMP_DIR" ] && rm -rf "$TEMP_DIR"
    echo "Config setup complete for environment: $env (branch: $branch)"

    # Inform about setting the CONFIG_FILE_NAME environment variable
    echo "Run the following to use this config:"
    echo "export CONFIG_FILE_NAME=${env}.json"
}

# Function to push configuration
push_config() {
    local env="$1"
    local repo="$2"
    local force="$3"
    local branch="$4"
    local commit_msg="$5"

    CURRENT_DIR=$(pwd)

    if ! prepare_repository "$repo" "$branch"; then
        cd "$CURRENT_DIR"
        [ -n "$TEMP_DIR" ] && rm -rf "$TEMP_DIR"
        exit 1
    fi

    # Define target directories
    TARGET_DIR="infrastructure/$env"
    CONFIG_DIR="$TARGET_DIR/configs"

    # Create directories if they don't exist
    mkdir -p "$CONFIG_DIR"

    # Copy cdk.context.json
    CDK_CONTEXT="cdk.context.json"
    copy_file_with_check "$CURRENT_DIR/$CDK_CONTEXT" "$TARGET_DIR/$CDK_CONTEXT" "$CDK_CONTEXT"

    # Copy environment-specific config file
    CONFIG_FILE="configs/$env.json"
    copy_file_with_check "$CURRENT_DIR/$CONFIG_FILE" "$CONFIG_DIR/$env.json" "$CONFIG_FILE"

    # Check for differences in cdk.context.json
    if [ -f "$TARGET_DIR/$CDK_CONTEXT" ] && [ -f "$CURRENT_DIR/$CDK_CONTEXT" ]; then
        if ! diff -q "$TARGET_DIR/$CDK_CONTEXT" "$CURRENT_DIR/$CDK_CONTEXT" > /dev/null; then
            echo "Warning: The $CDK_CONTEXT file is different from the one in the config repo."
            confirm_action "Continue with the update?" || exit 1
        fi
    fi

    # Commit and push changes
    git add .
    git commit -m "$commit_msg"
    git push origin "$branch"
    echo "Changes have been pushed to the config repository (branch: $branch)."

    # Clean up if we created a temporary directory
    cd "$CURRENT_DIR"
    [ -n "$TEMP_DIR" ] && rm -rf "$TEMP_DIR"
}

# Parse arguments
COMMAND=""
ENVIRONMENT=""
FORCE=false
BRANCH="main"
COMMIT_MSG="configuration update faims3"
CONFIG_REPO=""
REPO_PATH=""

while [[ $# -gt 0 ]]; do
    case $1 in
        push|pull)
            COMMAND="$1"
            shift
            ;;
        --help)
            display_help
            exit 0
            ;;
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
        --config_repo)
            if [ -n "$REPO_PATH" ]; then
                echo "Error: --config_repo cannot be used with --repo-path"
                exit 1
            fi
            CONFIG_REPO="$2"
            shift 2
            ;;
        --repo-path)
            REPO_PATH="$2"
            shift 2
            ;;
        *)
            if [ -z "$ENVIRONMENT" ]; then
                ENVIRONMENT="$1"
            else
                echo "Error: Unexpected argument '$1'"
                echo "Use --help for usage information"
                exit 1
            fi
            shift
            ;;
    esac
done

# Check if required arguments are provided
if [ -z "$COMMAND" ] || [ -z "$ENVIRONMENT" ]; then
    echo "Error: Command and environment must be specified"
    echo "Use --help for usage information"
    exit 1
fi

# Determine the config repo URL or use the provided repo path
if [ -n "$REPO_PATH" ]; then
    if [ ! -d "$REPO_PATH" ]; then
        echo "Error: Specified repo path does not exist or is not a directory"
        exit 1
    fi
    CONFIG_REPO="$REPO_PATH"
elif [ -z "$CONFIG_REPO" ]; then
    CONFIG_REPO=$(get_config_repo "$ENVIRONMENT")
    if [ $? -ne 0 ]; then
        echo "Error: Environment '$ENVIRONMENT' not found in environments.json and no --config_repo or --repo-path provided."
        exit 1
    fi
else
    # User provided a config repo, update environments.json
    update_environments_json "$ENVIRONMENT" "$CONFIG_REPO"
fi

# Execute the appropriate command
case "$COMMAND" in
    pull)
        pull_config "$ENVIRONMENT" "$CONFIG_REPO" "$FORCE" "$BRANCH"
        ;;
    push)
        push_config "$ENVIRONMENT" "$CONFIG_REPO" "$FORCE" "$BRANCH" "$COMMIT_MSG"
        ;;
    *)
        echo "Error: Invalid command '$COMMAND'"
        echo "Use --help for usage information"
        exit 1
        ;;
esac