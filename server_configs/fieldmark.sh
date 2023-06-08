#!/bin/sh

export platform="web"
export serverprefix="fieldmark"
export REACT_APP_CLUSTER_ADMIN_GROUP_NAME=cluster-admin
export REACT_APP_COMMIT_VERSION=$(bin/getDescribeString.sh gh-play)
export REACT_APP_DEBUG_APP=false
export REACT_APP_DEBUG_POUCHDB=false
export REACT_APP_USE_HTTPS=true
export REACT_APP_SHOW_WIPE=true
export REACT_APP_SHOW_NEW_NOTEBOOK=true
export REACT_APP_SHOW_MINIFAUXTON=true
export REACT_APP_DIRECTORY_HOST=db.fieldmark.app
export REACT_APP_DIRECTORY_PORT=443
export REACT_APP_PRODUCTION_BUILD=true
export REACT_APP_SERVICES=FAIMSTEXT
export REACT_APP_TAG=fieldmark
export REACT_APP_PROD_BUILD=true
export REACT_APP_BUGSNAG_KEY=fdd3d823af4893e37a3f21648c8c68c5