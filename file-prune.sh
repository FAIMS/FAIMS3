#!/bin/bash

# Run knip and capture the unused files
files=$(pnpm run knip --include files 2>/dev/null | grep -E '^\S+\.(ts|tsx|js|jsx|json|cjs|mjs)' | awk '{print $1}')

if [ -z "$files" ]; then
    echo "No unused files found."
    exit 0
fi

deleted=0
skipped=0

for file in $files; do
    if [ -f "$file" ]; then
        echo ""
        echo "File: $file"
        echo "----------------------------------------"
        head -20 "$file" 2>/dev/null
        echo "----------------------------------------"
        
        read -p "Delete this file? (y/n/q): " choice
        
        case "$choice" in
            y|Y)
                rm "$file"
                echo "Deleted: $file"
                ((deleted++))
                ;;
            q|Q)
                echo "Quitting."
                echo "Deleted: $deleted, Skipped: $skipped"
                exit 0
                ;;
            *)
                echo "Skipped: $file"
                ((skipped++))
                ;;
        esac
    else
        echo "File not found: $file"
    fi
done

echo ""
echo "Done. Deleted: $deleted, Skipped: $skipped"
