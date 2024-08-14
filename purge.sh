#!/bin/bash

# Function to remove npm cache files and directories
remove_npm_cache() {
    local dir="$1"
    local items_removed=0

    # Use find to locate and remove node_modules directories
    while IFS= read -r -d '' node_modules_dir; do
        echo "Removing: $node_modules_dir"
        rm -rf "$node_modules_dir"
        ((items_removed++))
    done < <(find "$dir" -type d -name "node_modules" -print0)

    echo "Cleaning complete. Removed $items_removed items."
}

# Main script
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <directory>"
    exit 1
fi

directory="$1"

if [ ! -d "$directory" ]; then
    echo "Error: $directory is not a valid directory"
    exit 1
fi

echo "Starting to clean npm cache files from: $directory"
remove_npm_cache "$directory"