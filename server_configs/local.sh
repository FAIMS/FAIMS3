#!/bin/sh

export platform="web"
export serverprefix="fieldmark"
export REACT_APP_CLUSTER_ADMIN_GROUP_NAME=cluster-admin
export REACT_APP_COMMIT_VERSION=$(bin/getDescribeString.sh gh-play)
export REACT_APP_DEBUG_APP=true
export REACT_APP_DEBUG_POUCHDB=true
export REACT_APP_USE_HTTPS=false
export REACT_APP_SHOW_WIPE=true
export REACT_APP_SHOW_NEW_NOTEBOOK=true
export REACT_APP_SHOW_MINIFAUXTON=true
export REACT_APP_DIRECTORY_HOST=localhost
export REACT_APP_DIRECTORY_PORT=5984
export REACT_APP_PRODUCTION_BUILD=false
export REACT_APP_SERVICES=FAIMSTEXT
export REACT_APP_TAG=fieldmark
export REACT_APP_PROD_BUILD=true
export REACT_APP_BUGSNAG_KEY=
