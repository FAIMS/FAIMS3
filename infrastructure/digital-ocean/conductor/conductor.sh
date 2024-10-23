#!/bin/bash

# get configuration
env_file=/opt/conductor/.env
source $env_file

image=ghcr.io/faims/faims3-conductor:main
keydir=/opt/conductor/keys

case "${1}" in

  init)
    echo 'setting up conductor'
    docker pull "${image}"
  ;;

  start)
    echo 'starting conductor'
    docker run -d -p ${CONDUCTOR_INTERNAL_PORT}:8000 \
    --env-file ${env_file} \
    -e COUCHDB_INTERNAL_URL=https://db.$SUBDOMAIN \
    -e COUCHDB_PUBLIC_URL=https://db.$SUBDOMAIN \
    -e CONDUCTOR_PUBLIC_URL=https://conductor.$SUBDOMAIN \
    -v "${keydir}:/app/keys" \
    --restart unless-stopped\
    --name conductor\
    ${image}
  ;;


  status)
    echo 'conductor status'
    docker ps -a
  ;;

  restart)
    echo 'restarting conductor'
    docker restart conductor
  ;;

  stop)
    echo 'stopping conductor'
    docker stop conductor
    docker rm conductor
  ;;

  *)
    echo "unknown option '${1}'"
  ;;

esac