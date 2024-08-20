#!/bin/sh

# Helper script used for docker builds.

# bundle.sh: A script to copy specific directories from a source to an output location
# based on the presence of package.json files in a JSON dump directory.

# Usage: ./bundle.sh <json_dump_path> <source_path> <output_path>
#
# Arguments:
#   json_dump_path: Path to the directory containing package.json files
#   source_path: Path to the source directory containing files to be copied
#   output_path: Path to the output directory where files will be copied

# Check if all arguments are provided
if [ "$#" -ne 3 ]; then
    echo "Error: Incorrect number of arguments"
    echo "Usage: $0 <json_dump_path> <source_path> <output_path>"
    exit 1
fi

json_dump_path="$1"
source_path="$2"
output_path="$3"

# Function: get_relative_path
# Purpose: Calculate the relative path from a base directory to a target directory
# Arguments:
#   $1: target directory path
#   $2: base directory path
# Returns: The relative path as a string
get_relative_path() {
    local target="$1"  # Store the target directory path
    local base="$2"    # Store the base directory path
    
    # Special case: if target and base are the same, return empty string
    if [ "$target" = "$base" ]; then
        echo ""
        return
    fi
    
    local back=""  # Initialize a variable to store the "../" parts of the path
    
    # Loop while the target doesn't start with the base path
    while [ "${target#$base}" = "${target}" ]; do
        base="${base%/*}"  # Remove the last directory from the base path
        back="../$back"    # Add "../" to the relative path
    done
    echo "$back${target#$base/}"
}

# Function: process_directory
# Purpose: Process a directory by copying specific folders if they exist
# Arguments:
#   $1: relative directory path
process_directory() {
    local relative_dir="$1"
    local full_path="$json_dump_path/$relative_dir"
    
    # Check if package.json exists in this directory
    if [ -f "$full_path/package.json" ]; then
        # Create the destination directory
        mkdir -p "$output_path/$relative_dir"
        
        # Copy node_modules, dist, build, and views if they exist
        for folder in node_modules dist build views; do
            if [ -d "$source_path/$relative_dir/$folder" ]; then
                cp -R "$source_path/$relative_dir/$folder" "$output_path/$relative_dir/"
            fi
        done
    fi
}

# Main script logic
# Find all package.json files in the json dump directory and process their directories
find "$json_dump_path" -name "package.json" | while read -r package_json; do
    dir=$(dirname "$package_json")
    relative_dir=$(get_relative_path "$dir" "$json_dump_path")
    process_directory "$relative_dir"
done

echo "Copy operation completed."