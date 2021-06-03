#!/bin/sh

export REACT_APP_PRODUCTION_BUILD=true
export REACT_APP_DIRECTORY_HOST=alpha.db.faims.edu.au

git clean -xfd && npm ci && npm run webapp-build && npm run app-update
