#!/bin/bash

# get configuration
env_file=/opt/conductor/.env
# strip comments and export variables - fixed version
while IFS='=' read -r key value || [[ -n "$key" ]]; do
  # Skip empty lines and comments
  [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
  # Remove leading/trailing whitespace
  key=$(echo "$key" | xargs)
  value=$(echo "$value" | xargs)
  # Export the variable
  export "$key"="$value"
done < "$env_file"

image=${CONDUCTOR_DOCKER_IMAGE}
keydir=/opt/conductor/keys

# Generate redirect whitelist for Conductor based on subdomain and VITE_APP_ID
REDIRECT_WHITELIST=http://localhost:3000,http://localhost:3001,https://app.${SUBDOMAIN},https://dashboard.${SUBDOMAIN},${VITE_APP_ID}://auth0-return

case "${1}" in

  init)
    echo 'setting up conductor'
    docker pull "${image}"
  ;;

  start)
    echo 'starting conductor'
    docker run -d -p ${CONDUCTOR_INTERNAL_PORT}:8000 \
    --env-file ${env_file} \
    -e PROFILE_NAME=default \
    -e COUCHDB_INTERNAL_URL=https://db.${SUBDOMAIN} \
    -e COUCHDB_PUBLIC_URL=https://db.${SUBDOMAIN} \
    -e CONDUCTOR_PUBLIC_URL=https://api.${SUBDOMAIN} \
    -e REDIRECT_WHITELIST=${REDIRECT_WHITELIST} \
    -e KEY_FILE_PATH=/app\
    -v "${keydir}:/app/keys" \
    --restart unless-stopped\
    --memory=6g \
    --name conductor\
    ${image}
  ;;


  status)
    echo 'conductor status'
    docker ps -a
  ;;

  restart)
    echo 'restarting conductor'
    docker stop conductor
    docker start conductor
  ;;

  stop)
    echo 'stopping conductor'
    docker stop conductor
    docker rm conductor
  ;;

  migrate)
    echo 'running migrations'
    docker exec -it conductor node scripts/migrate.js
  ;;

  *)
    echo "unknown option '${1}'"
  ;;

esac