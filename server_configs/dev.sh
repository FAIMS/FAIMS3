#!/bin/sh

# invoke dev mode with environment vairables:
# source server_configs/dev.sh; npm start

export REACT_APP_DIRECTORY_HOST=dev.db.faims.edu.au
export REACT_APP_DIRECTORY_PORT=443
export REACT_APP_USE_HTTPS=true
export REACT_APP_PRODUCTION_BUILD=true
export REACT_APP_USE_REAL_DATA=true
export REACT_APP_TAG=Beta
export REACT_APP_SERVER=production
export REACT_APP_SERVICES=FAIMSTEXT