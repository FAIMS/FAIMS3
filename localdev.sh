#!/usr/bin/env bash
set -e
# Takes down any running docker compose in this project, optionally prunes volumes,
# then brings CouchDB (and RustFS) up, migrates Couch, and starts the rest of
# the stack (worker pool, or every service with --all).
# Usage: ./localdev.sh [--all] [--build] [--clear-db]

# `wait -n` on the library watchers below needs bash 4.3+; macOS ships 3.2.
if ((BASH_VERSINFO[0] < 4 || (BASH_VERSINFO[0] == 4 && BASH_VERSINFO[1] < 3))); then
  echo "localdev.sh needs bash 4.3+ (found $BASH_VERSION)." >&2
  echo "On macOS: brew install bash" >&2
  exit 1
fi

ALL_SERVICES=false
BUILD_FLAG=""
CLEAR_DB=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
  --all)
    ALL_SERVICES=true
    shift
    ;;
  --build)
    BUILD_FLAG="--build"
    shift
    ;;
  --clear-db)
    CLEAR_DB=true
    shift
    ;;
  *)
    echo "Unknown option: $1"
    echo "Usage: $0 [--all] [--build] [--clear-db]"
    exit 1
    ;;
  esac
done

# Function to check and set Node.js version
setup_node_version() {
  local required_major_version=24

  # Try to load nvm if it exists
  if [ -f "$HOME/.nvm/nvm.sh" ]; then
    echo "Loading nvm..."
    source "$HOME/.nvm/nvm.sh"

    # Try to use Node
    echo "Attempting to switch to Node.js ${required_major_version}..."
    if nvm use $required_major_version 2>/dev/null; then
      echo "Successfully switched to Node.js ${required_major_version} using nvm"
    else
      echo "Node.js ${required_major_version} not found in nvm. Attempting to install..."
      if nvm install $required_major_version; then
        nvm use $required_major_version
        echo "Successfully installed and switched to Node.js ${required_major_version}"
      else
        echo "Failed to install Node.js ${required_major_version} via nvm"
      fi
    fi
  elif command -v nvm &>/dev/null; then
    # nvm command exists but not sourced from standard location
    echo "nvm command found, attempting to use Node.js ${required_major_version}..."
    if nvm use $required_major_version 2>/dev/null; then
      echo "Successfully switched to Node.js $required_major_version using nvm"
    else
      echo "Node.js ${required_major_version} not found. Attempting to install..."
      if nvm install $required_major_version; then
        nvm use $required_major_version
        echo "Successfully installed and switched to Node.js ${required_major_version}"
      else
        echo "Failed to install Node.js ${required_major_version} via nvm"
      fi
    fi
  else
    echo "nvm not found. Checking system Node.js version..."
  fi

  # Check current Node.js version
  if ! command -v node &>/dev/null; then
    echo "ERROR: Node.js is not installed!"
    echo "Please install Node.js ${required_major_version} or install nvm to manage Node.js versions."
    echo "Visit https://nodejs.org/ or https://github.com/nvm-sh/nvm"
    exit 1
  fi

  local current_version=$(node --version)
  local major_version=$(echo "$current_version" | cut -d'.' -f1 | sed 's/v//')

  echo "Current Node.js version: $current_version"

  if [ "$major_version" -ne "$required_major_version" ]; then
    echo ""
    echo "=========================================="
    echo "ERROR: Node.js version mismatch!"
    echo "Required: Node.js ${required_major_version}.x"
    echo "Current:  Node.js $current_version"
    echo "=========================================="
    echo ""
    if [ -f "$HOME/.nvm/nvm.sh" ] || command -v nvm &>/dev/null; then
      echo "NVM is available but couldn't switch to Node.js ${required_major_version}."
      echo "Try manually running: nvm install ${required_major_version} && nvm use ${required_major_version}"
    else
      echo "Please install Node.js ${required_major_version} or use nvm to manage Node.js versions."
      echo "To install nvm: https://github.com/nvm-sh/nvm"
    fi
    exit 1
  fi

  echo "✓ Node.js version check passed (v${major_version}.x)"
}

docker_prefix="docker compose"

stop_docker_services() {
  echo "Stopping existing Docker containers..."

  if [ "$CLEAR_DB" = true ]; then
    # Let compose remove its own volumes: couchdb_data is this project's only
    # named volume, and removing by volume label instead matched every
    # project's couchdb_data on the host (other checkouts and worktrees).
    echo "Pruning volumes containing the couchdb database and rustfs objects..."
    ${docker_prefix} down --volumes
  else
    ${docker_prefix} down
    echo "Skipping volume pruning (use --clear-db to clear volumes)"
  fi
}

# Host migrate talks to published Couch on localhost even when api/.env was
# previously rewritten for Docker DNS (`http://couchdb:5984`).
migrate_couchdb() {
  echo "Migrating CouchDB..."
  echo "> COUCHDB_INTERNAL_URL=http://localhost:5984 pnpm run migrate-with-keys"
  COUCHDB_INTERNAL_URL=http://localhost:5984 pnpm run migrate-with-keys
}

apply_docker_env_overrides() {
  echo "Applying Docker environment overrides to api/.env"
  echo "" >>./api/.env
  echo "# Docker environment overrides" >>./api/.env
  echo "CONDUCTOR_INTERNAL_PORT=8000" >>./api/.env
  echo "COUCHDB_INTERNAL_URL=http://couchdb:5984" >>./api/.env
  echo "ATTACHMENT_S3_ENDPOINT=http://rustfs:9000" >>./api/.env
  echo "ATTACHMENT_S3_PUBLIC_ENDPOINT=http://localhost:9000" >>./api/.env
}

wait_for_service() {
  local start_time
  local end_time
  local current_time
  local response
  start_time=$(date +%s)
  end_time=$((start_time + 30))
  while true; do
    current_time=$(date +%s)
    if [ $current_time -ge $end_time ]; then
      echo "Global timeout reached. Service did not become available within 30 seconds."
      return 1
    fi
    if response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://localhost:8080/login); then
      if [ "$response" -eq 200 ]; then
        echo "Service is now available!"
        return 0
      fi
    fi
    echo "Service not yet available. Retrying in 2 seconds..."
    sleep 2
  done
}

wait_for_rustfs() {
  local start_time
  local end_time
  local current_time
  local response
  start_time=$(date +%s)
  end_time=$((start_time + 30))

  RUSTFS_PORT=9000

  echo "Waiting for RustFS on port ${RUSTFS_PORT}..."

  while true; do
    current_time=$(date +%s)
    if [ $current_time -ge $end_time ]; then
      echo "Global timeout reached. RustFS did not become available within 30 seconds."
      return 1
    fi
    if response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://localhost:${RUSTFS_PORT}/health); then
      if [ "$response" -eq 200 ]; then
        echo "RustFS is now available!"
        return 0
      fi
    fi
    echo "RustFS not yet available. Retrying in 2 seconds..."
    sleep 2
  done
}

wait_for_couchdb() {
  local start_time
  local end_time
  local current_time
  local response
  start_time=$(date +%s)
  end_time=$((start_time + 30))

  COUCHDB_PORT=5984

  echo "Waiting for CouchDB on port ${COUCHDB_PORT}..."

  while true; do
    current_time=$(date +%s)
    if [ $current_time -ge $end_time ]; then
      echo "Global timeout reached. CouchDB did not become available within 30 seconds."
      return 1
    fi
    if response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://localhost:${COUCHDB_PORT}/_up); then
      if [ "$response" -eq 200 ]; then
        echo "CouchDB is now available!"
        return 0
      fi
    fi
    echo "CouchDB not yet available. Retrying in 2 seconds..."
    sleep 2
  done
}

# Check and setup Node.js version first
echo "=========================================="
echo "Checking Node.js version..."
echo "=========================================="
setup_node_version
echo ""

echo "Using docker build kit"
echo "export DOCKER_BUILDKIT=1"
export DOCKER_BUILDKIT=1

echo "checking pnpm install"
echo "> pnpm --version"
pnpm --version

echo "checking docker install"
echo "> docker --version"
docker --version

# install dependencies
echo "Installing monorepo dependencies"
echo "> pnpm install"
pnpm install

# turbo build
echo "Turbo build"
echo "> npx turbo build"
npx turbo build

# create .env files if they don't already exist, using the .env.dist templates
echo "Creating .env files from .env.dist templates (if they don't already exist)"
if [ ! -f ./.env ]; then
  echo "> cp ./.env.dist ./.env"
  cp ./.env.dist ./.env
fi
if [ ! -f ./api/.env ]; then
  echo "> cp ./api/.env.dist ./api/.env"
  cp ./api/.env.dist ./api/.env
fi
if [ ! -f ./web/.env ]; then
  echo "> cp ./web/.env.dist ./web/.env"
  cp ./web/.env.dist ./web/.env
fi
if [ ! -f ./app/.env ]; then
  echo "> cp ./app/.env.dist ./app/.env"
  cp ./app/.env.dist ./app/.env
fi

# create local keys
echo "Generating local keys"
echo "> pnpm run generate-local-keys"
pnpm run generate-local-keys

echo "Starting docker service..."
stop_docker_services

echo "Starting CouchDB and RustFS..."
${docker_prefix} up ${BUILD_FLAG} -d couchdb rustfs

echo "Waiting for CouchDB to become available..."
if wait_for_couchdb; then
  echo "CouchDB is ready!"
else
  echo "Failed to connect to CouchDB. Exiting."
  exit 1
fi

migrate_couchdb

echo "Waiting for RustFS to become available..."
if wait_for_rustfs; then
  echo "RustFS is ready!"
else
  echo "Failed to connect to RustFS. Exiting."
  exit 1
fi

if [ "$ALL_SERVICES" = false ]; then
  echo "Starting spatial worker pool..."
  ${docker_prefix} up ${BUILD_FLAG} -d capacity-manager spatial-worker
  COUCHDB_PORT=5984
  RUSTFS_PORT=9000
  echo ""
  echo "=========================================="
  echo "CouchDB is running:"
  echo "CouchDB Admin UI: http://localhost:${COUCHDB_PORT}/_utils"
  echo "RustFS S3 API: http://localhost:${RUSTFS_PORT}"
  echo "RustFS Console: http://localhost:9001"
  echo "=========================================="
  echo ""
  echo "Note: CouchDB, RustFS, and the spatial worker pool are running."
  echo "To start all services in Docker, run with --all flag."
else
  # Docker needs 8000 internal + couchdb DNS (rather than localhost). Apply
  # after host migrate so the migrate process still reaches published Couch.
  apply_docker_env_overrides

  echo "Starting remaining Docker services..."
  ${docker_prefix} up ${BUILD_FLAG} -d

  echo "Waiting for service to become available at http://localhost:8080..."
  if wait_for_service; then
    echo "Continuing with the rest of the script..."
  else
    echo "Failed to connect to the service. Exiting."
    exit 1
  fi

  echo "Service is setup, to load notebooks and templates follow the below steps"
  cat <<EOF
This script requires authentication, so you need to get a user token for the admin
user. First, connect to the conductor instance on http://localhost:8080/ or whichever
port you have configured. Login using the local 'admin' user and password.

Now, from the Conductor home page (http://localhost:8080/) scroll down to "Copy
Bearer Token to Clipboard". Paste this value into your .env file as the
value of USER_TOKEN.

Then run:

$> pnpm run load-notebooks

And:
$> pnpm run load-templates
EOF

  echo "Services running:"
  echo "API (live reloading /api): http://localhost:8080"
  echo "App (live reloading /app): http://localhost:3000"
  echo "Web (live reloading /web): http://localhost:3001"
  echo "CouchDB: http://localhost:5984/_utils"
  echo "RustFS S3 API: http://localhost:9000"
  echo "RustFS Console: http://localhost:9001"

  echo ""
  echo "Starting shared-library watchers (data-model + forms)..."
  echo "Press Ctrl-C to stop watching; containers keep running."
  trap 'kill 0' EXIT
  pnpm --filter=@faims3/data-model run watch &
  pnpm --filter=@faims3/forms run watch &
  # A bare `wait` returns only once both watches are gone, so a watch that dies
  # leaves its library silently stale. Return on the first exit and say so.
  wait -n || true
  echo "A library watch exited; run ./localdev.sh --all to restart the watchers."
fi
