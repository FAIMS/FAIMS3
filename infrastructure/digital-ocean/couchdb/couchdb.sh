#!/bin/bash

# get configuration
env_file=/opt/couchdb/.env
source $env_file

tag=3.3.3
configdir=/opt/couchdb/etc/local.d
volume=/mnt/couchdb_data

case "${1}" in

  init)
    echo 'setting up couchdb'
    docker pull "couchdb:${tag}"
  ;;

  start)
    echo 'starting couchdb'
    docker run -d -p 5984:5984 \
    -e COUCHDB_USER=admin \
    -e COUCHDB_PASSWORD=${COUCHDB_PASSWORD} \
    -v "${configdir}:/opt/couchdb/etc/local.d" \
    -v "${volume}:/opt/couchdb/data" \
    --restart unless-stopped\
    --name couchdb\
    "couchdb:${tag}"
  ;;


  status)
    echo 'couchdb status'
    docker ps -a
  ;;

  restart)
    echo 'restarting couchdb'
    docker restart couchdb
  ;;

  stop)
    echo 'stopping couchdb'
    docker stop couchdb
    docker rm couchdb
  ;;

  *)
    echo "unknown option '${1}'"
  ;;

esac