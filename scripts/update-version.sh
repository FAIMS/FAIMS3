#!/bin/bash

## This script updates the version string for
## all sub-packages in package.json.

# get the new version from the first argument
NEW_VERSION=$1

FILES=("api/package.json" "app/package.json" "web/package.json" "library/data-model/package.json")

for FILE in "${FILES[@]}"; do
  if [ -f "$FILE" ]; then
    # Update the version in package.json
    jq --arg newVersion "$NEW_VERSION" '.version = $newVersion' "$FILE" > tmp.$$.json && mv tmp.$$.json "$FILE"
    
    echo "Updated $FILE to version $NEW_VERSION"
  else
    echo "File $FILE does not exist."
  fi
done