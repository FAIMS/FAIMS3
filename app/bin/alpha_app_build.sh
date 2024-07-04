#!/bin/sh

set -e

export REACT_APP_PRODUCTION_BUILD=true
export REACT_APP_DIRECTORY_HOST=alpha.db.faims.edu.au
export REACT_APP_COMMIT_VERSION=$(git describe --long || git describe --all --long)

git clean -xfd && npm ci && npm run webapp-build && npm run app-update
npx cap copy
npx cap update
