#!/bin/bash

INSTANCE=${1:-dev} 
echo "Showing logs for $INSTANCE"

docker logs --details --timestamps $( docker ps | grep "faims3-docker_conductor-$1" | cut -d" " -f1)