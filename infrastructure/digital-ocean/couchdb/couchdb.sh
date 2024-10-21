#!/bin/bash

tag=3.3.3
configdir=/opt/couchdb/etc/local.d

case "${1}" in

  init)
    echo 'setting up couchdb'
    docker pull "couchdb:${tag}"
  ;;

  start)
    echo 'starting couchdb'
    docker run -d -p 5984:5984 \
    -v "${configdir}:/opt/couchdb/etc/local.d" \
    -v "/mnt/couchdb_data:/opt/couchdb/data" \
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
  ;;

  *)
    echo "unknown option '${1}'"
  ;;

esac