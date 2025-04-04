#!/bin/sh

# This starts up a local couchdb for minimal testing. Use the dev or testing
# servers for more robust testing.

# start couchdb container
sudo docker run -d --name couchdb -p 5984:5984 -e COUCHDB_USER=admin -e COUCHDB_PASSWORD=password couchdb:latest



# create empty directory, looping until couchdb is ready

base_url="http://localhost:5984"
curl_cmd="curl -X PUT -u admin:password"
# setup directory
while !  $curl_cmd "$base_url/directory"; do
    echo "Failed to create db, sleeping..."
    sleep 3
    echo "Trying again..."
done

$curl_cmd $base_url/_users
$curl_cmd $base_url/_replicator
$curl_cmd $base_url/_global_changes

# setup cors
$curl_cmd $base_url/_node/_local/_config/httpd/enable_cors -d '"true"'
$curl_cmd $base_url/_node/_local/_config/cors/origins -d '"*"'
$curl_cmd $base_url/_node/_local/_config/cors/credentials -d '"true"'
$curl_cmd $base_url/_node/_local/_config/cors/methods -d '"GET, PUT, POST, HEAD, DELETE"'
$curl_cmd $base_url/_node/_local/_config/cors/headers -d '"accept, authorization, content-type, origin, referer, x-csrf-token"'

echo "Finished setting up"
