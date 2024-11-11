# Deploy Fieldmark to Digital Ocean via Terraform

This folder contains two Terraform modules to configure and deploy both CouchDB
and the Conductor server to Digital Ocean.   It also contains an example deployment
project that can be used as a template for an individual deployment.

## CouchDB

The CouchDB module creates a cluster of droplets running the CouchDB docker image, each
with an attached volume for persistent storage. A load balancer is configured as a front
end to the cluster and an SSL certificate is created to allow HTTPS access.

TODO: currently only a single node is tested, more nodes can be created but the configuration
doesn't set up CouchDB clustering so they would be independent nodes.

## Conductor

Conductor is deployed on a single droplet configured to use HTTPS and connect to the CouchDB
cluster.

## Example Deployment

The `example` folder contains a Terraform configuration that uses the two modules
above to deploy a full FAIMS3 server configuration.  To manage a deployment, create
a private repository and copy the `example` folder to it.  Further instructions
are in the README.md file in the `example` folder.

