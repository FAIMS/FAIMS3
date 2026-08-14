#!/usr/bin/env bash
set -euo pipefail

# Script to build local production Docker images using optimized multi-stage build

echo "=================================================="
echo " Building local production images for FAIMS3... "
echo "=================================================="

# Build Conductor API
echo "==> Building faims3-api:latest..."
docker build -t faims3-api:latest --build-arg PACKAGE_NAME=@faims3/api -f Dockerfile.build .

# Build Web (Control Centre)
echo "==> Building faims3-web:latest..."
docker build -t faims3-web:latest --build-arg PACKAGE_NAME=@faims3/web -f Dockerfile.build .

# Build App (Data Collection App)
echo "==> Building faims3-app:latest..."
docker build -t faims3-app:latest --build-arg PACKAGE_NAME=@faims3/app -f Dockerfile.build .

# Build CouchDB
echo "==> Building faims3-couchdb:latest..."
docker build -t faims3-couchdb:latest api/couchdb

echo ""
echo "=================================================="
echo " Successfully built all local production images!  "
echo "=================================================="
docker images | grep faims3-
