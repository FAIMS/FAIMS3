#!/bin/sh
# Generate runtime env-config.js for SPA static assets from container environment variables

TARGET_DIR="${1:-.}"

if [ -d "$TARGET_DIR" ]; then
  ENV_FILE="$TARGET_DIR/env-config.js"
  echo "window.__ENV__ = {" > "$ENV_FILE"
  env | grep -E '^(VITE_|CONDUCTOR_|COUCHDB_|WEB_APP_|DESIGNER_)' | while IFS='=' read -r key val; do
    # Escape backslashes and double quotes for valid JS string literal
    escaped_val=$(echo "$val" | sed 's/\\/\\\\/g; s/"/\\"/g')
    echo "  \"$key\": \"$escaped_val\"," >> "$ENV_FILE"
  done
  echo "};" >> "$ENV_FILE"
  echo "Generated $ENV_FILE from container environment variables."
fi
