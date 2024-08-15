#!/bin/bash

# Check if all arguments are provided
if [ "$#" -ne 3 ]; then
    echo "Usage: $0 <json_dump_path> <source_path> <output_path>"
    exit 1
fi

json_dump_path="$1"
source_path="$2"
output_path="$3"

# Function to process each directory
process_directory() {
    local relative_dir="$1"
    
    # Check if package.json exists in this directory
    if [ -f "$json_dump_path/$relative_dir/package.json" ]; then
        echo "Processing $relative_dir"
        
        # Create the destination directory
        mkdir -p "$output_path/$relative_dir"
        
        # Copy node_modules, dist, and build if they exist
        for folder in node_modules dist build views; do
            if [ -d "$source_path/$relative_dir/$folder" ]; then
                echo "Copying $source_path/$relative_dir/$folder to $output_path/$relative_dir/$folder"
                cp -R "$source_path/$relative_dir/$folder" "$output_path/$relative_dir/"
            fi
        done
    fi
}

# Find all package.json files in the json dump directory and process their directories
find "$json_dump_path" -name "package.json" | while read -r package_json; do
    relative_dir=$(realpath --relative-to="$json_dump_path" "$(dirname "$package_json")")
    process_directory "$relative_dir"
done

echo "Copy operation completed."