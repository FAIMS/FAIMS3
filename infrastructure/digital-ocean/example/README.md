# FAIMS3 Digital Ocean Deployment

This folder contains the Terraform configuration for deploying FAIMS3 to Digital Ocean. When using this template:

1. Create a new private repository for your deployment
2. Copy this example folder to your new repository
3. Configure your Digital Ocean credentials
4. Run Terraform commands to deploy
5. Commit the resulting Terraform state files along with your code

## Prerequisites

- Digital Ocean account
- Terraform installed locally
- Digital Ocean API token

## Configuration

Configure your deployment by copying the file `terraform.tfvars.dist` as
`terraform.tfvars`. Edit this file to add your Digital Ocean
credentials and a contact email address for the Let's Encrypt SSL certificate.
These settings relate to the deployment process.

Create `conductor.env` by copying `conductor.env.dist` and adding your configuration
for the server deployment. This file is copied to the server and contains
runtime settings for the server instance.

Run the script to create a key pair and CouchDB configuration
file for your deployment. This will create a folder `assets` that will be
used as part of the deployment process.

```bash
./makeInstanceKeys.sh
```

Add these new files to version control including the key pair and configured
secrets. You **must** ensure that the repository is **private** if it is to be
stored on e.g. Github. This repository will be the record of your deployment
and the files are required to update the deployment or gain access to the
servers.

## Deployment

Initialise Terraform:

```bash
terraform init
```

Review the deployment plan:

```bash
terraform plan
```

Deploy the infrastructure:

```bash
terraform apply
```

The deployment will show some output as the various resources are created. Once
complete, the configuration of the servers may take a little longer as they
run the scripts to install the required software. When this is complete you
should be able to access the server at the configured subdomain. If
the SUBDOMAIN setting in conductor.env is 'faims.example.com' then you
should be able to access couchdb at <http://db.faims.example.com> and
the conductor server at <https://conductor.faims.example.com>.

To login to the servers you can use the public key created earlier.

```bash
ssh -i assets/private_key.pem conductor@conductor.faims.example.com
```

The CouchDB nodes will have domain names of the form `couchdb-<number>.faims.example.com` and
the username `couchdb` can be used to login, eg:

```bash
ssh -i assets/private_key.pem couchdb@couchdb-0.faims.example.com
```

## State Management

The Terraform state files (`.tfstate`) should be committed to this private
repository after deployment. This means that anyone with access to the repository
can manage the deployment - updating the servers, adding new servers, etc.

## Maintenance

If the main terraform modules (part of the FAIMS3 repository) are updated then
re-running `terraform plan` will show any changes that would be made to your infrastructure.
For example, if a newer version of the Conductor server docker container is available,
this would deploy an updated version of the container (destroying the current server
and creating a new one).

Data for CouchDB is stored on a volume which should not change even if the CouchDB droplet
is updated. However, backups before updating any infrastructure are recommended.

Remember to run terraform plan before any changes to review potential impacts to your infrastructure.

## Note on Destroying the Deployment

At the moment there is a problem with `terraform destroy` that prevents a clean
tear down. The problem is that the certificate on the load balancer depends
on the domain so the domain can't be deleted until the certificate is removed.
Terraform can't work out how to do this (or I can't work out how to tell terraform
to do this) so for now you need to manually delete the certificate.

Go to the Digital Ocean control panel and select `Networking', open the load
balancer and look at the Settings panel. Under Forwarding Rules, first add
an HTTP rule, then delete the HTTPS rule. Then delete the certificate
via the doctl command line tool:

```bash
doctl compute certificate list # to get the ID
doctl compute certificate delete <ID>
```

You can then run `terraform destroy` to remove the rest of the infrastructure.
