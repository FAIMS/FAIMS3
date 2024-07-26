# FAIMS 3 CDK Deployment

This CDK project includes AWS infrastructure as code to deploy FAIMS 3 and its associated components.

## TODO fix the below

## How to deploy from scratch

I believe the following steps are required to deploy from scratch

### Setup keys

```
# move to conductor
cd ../FAIMS3-conductor
# generate public private key pair
./keymanagement/makeInstanceKeys.sh
```

This will setup the local.ini file which is used to configure CouchDB in the docker build.

Please edit the local.ini file in couchdb folder to remove the admin=... section - this is not necessary given that we include this env variable during database startup in the docker build from an auto-generated AWS secret.

### Deploy CDK infrastructure

You might need to tinker with

- the target environment, see `bin/faims-infra.ts`
- the domain names, see `lib/faims-infra-stack.ts`
- the fixed hosted zones and certificate ARNs, see `bin/faims-infra.ts` (these must match the domains to deploy to)

```
npm i aws-cdk -g
npm i
cdk deploy
```

### Initialise database

Once the deployment is up and going, you need to

- `cd ../FAIMS3-conductor`
- copy an example .env file to `.env` and update `CONDUCTOR_PUBLIC_URL` to the deployment URL you have above e.g. `https://conductor.bss.nbic.cloud`
- `npm i`
- `npm run init`

### Initialise notebooks

If you want to put demo notebooks in:

- go to AWS secret management, get the DB password handy
- visit the conductor, login using the admin/password above, and then get the token from the copy token button on the home page
- `cd ../FAIMS3-conductor`
- update the .env file to specify
  - CONDUCTOR_PUBLIC_URL (as above)
  - USER_TOKEN (from what you just copied)
- `npm i`
- `npm run load-notebooks`

## TODOs

Variety of improvements to be made - but current deployment okay as a technical demonstrator **with no real data**.

### Reliability / Correctness

- fix the ECS - EFS mounts so that CouchDB uses persistent storage
- test ECS CouchDB container recovery from EFS storage

### Security

- fix security of conductor docker build to not include the keys in the docker image layers

### Automation

- integrate key generation process into automated deployment - possibly as custom resource - e.g. you could use custom lambda resource which generates - might have issues if the key folder needs to be mounted into the docker build

### Cost savings

- re-engineer the ECS load balanced service setup to use the multi target-group version to save costs on load balancer(s)
