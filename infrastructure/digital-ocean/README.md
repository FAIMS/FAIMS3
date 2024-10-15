# Deploy Fieldmark to Digital Ocean via Terraform

## CouchDB

Create a three node cluster with a front end load balancer. Configure
as a CouchDB cluster.  

Partly based on this tutorial:
[How To Use Terraform with DigitalOcean](https://www.digitalocean.com/community/tutorials/how-to-use-terraform-with-digitalocean).

## Configuration

```bash
export DO_PAT="digital ocean personal access token"
export COUCHDB_PASSWORD="secret admin password"
export COUCHDB_SECRET="cookie secret"
```

I created a new SSH key in the current directory using `ssh-keygen` but you could
also use an existing key in the path below.  DO needs to know about this key.

## Build the cluster

To validate the configuration and view the plan:

```bash
terraform plan \
  -var "do_token=${DO_PAT}" \
  -var "pvt_key=./id_rsa" \
  -var "subdomain=${SUBDOMAIN}"
```

To create the cluster substitute `terraform apply`.

To destroy the cluster `terraform destroy`

### TODO

- copy in properly configured local.ini file for cluster configuration
- make this a terrform module that we can include from a 'real' deployment config
  - <https://developer.hashicorp.com/terraform/language/modules/sources#github>

## Conductor

```bash
terraform plan \
  -var "do_token=${DO_PAT}" \
  -var "pvt_key=./id_rsa" \
  -var "subdomain=demo.fieldmark.app" \
  -var "contact_email=me@here.com"
```

### TODO

- set up nginx to proxy traffic to port 80
- set up let's encrypt to generate a certificate, needs the domain in place