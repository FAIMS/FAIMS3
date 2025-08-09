# Deploying AWS Stack from scratch

This guide will explain how to go from an empty AWS account with some basic pre-requisites met, to a complete working FAIMS3 deployment.

Please keep a digital note taking app handy so you can reference some AWS resource IDs (ARNs) as we create some manual resources.

From now on, when I refer to commands in the CLI, assume unless otherwise stated they are running from `infrastructure/aws-cdk` as this is the working directory for the CDK project.

## External pre-requisites

### SMTP

You will need an SMTP server - including the following parameters:

```json
    "fromEmail": "notifications@your-domain.com",
    "fromName": "FAIMS Notification Service",
    "replyTo": "support@your-domain.com",
    "testEmailAddress": "admin@your-domain.com",
```

And your credentials for it (which will be in AWS secrets manager) including the

- host URL
- port
- TLS true/false
- username
- password

SMTP2Go and Mailgun have been tested as functioning.

### Maptiler API

If you want to enable offline mapping, you will need to pay for a basic Maptiler API key.

## Installation

Follow the usual repository pre-requisites, i.e. ensure

- docker is installed
- nvm is being used to manage a node v20+

## Repo setup

**From the repo root**, install dependencies as per usual i.e.

```
npm i
```

## AWS Pre-requisites

You will need high level permissions into your target AWS account, active in the current terminal session.

## CDK Bootstrap

Follow the guide at [CDK Bootstrap](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping-env.html) to bootstrap your AWS account with CDK.

i.e.

```
npm i aws-cdk -g
# ensuring credentials are setup for target AWS account(!)
cdk bootstrap <aws://123456789012/ap-southeast-2>
```

Replacing the AWS account ID above with your actual account. This should result in a stack being deployed successfully. If not, please consult the guide/online advice on any issues encountered.

## Domain name and certificates

The FAIMS stack will be deployed to a given base domain, with a wildcard set of subdomains. For this reason you will need the following

- a route 53 managed domain name (i.e. a route53 hosted zone of which CDK can programmatically add routes - the domain itself may not need to be purchased via Amazon's registry, but it needs to be deleted to a Route53 hosted zone)
- target region certificates for the **base domain and subdomains** - for example if you wish to deploy to `my-faims.com` you will need `my-faims.com` and `*.my-faims.com` in **both the target deployment region, and us-east-1**. You always need `us-east-1` because Cloudfront always uses US certs.

Setting up your domain names, and route 53 hosted zone is an issue that is quite specific to your context. However, I would recommend you have an entire hosted zone dedicated to this application if possible, so that CDK can fully manage it.

### Creating certificates

Navigate to AWS Certificate manager - **ensure you are in the target app deployment region**.

![aws certificate manager](assets/aws_cm.png)

Then select request certificate on the left panel, request a public certificate.

Enter the following settings. In (1) include your base domain e.g. test.com. In (2), include the wildcard subdomains i.e. '\*.test.com'.

![aws certificate manager](assets/cert.png)

Then add some tags if you like, and submit the cert.

Once submitted, click the "Create records in Route 53 button" - ensuring you have a managed hosted zone with control over the target domain.

**Note down the ARN of the certificate**. You can find it/copy it as below:

![aws certificate manager](assets/cert_arn.png)

Repeat this process, but using the `us-east-1` region, and note down the certificate ARN separately.

You should now have two validated certificates, and a target domain name noted down.

## Creating your configuration repository

The CDK deployment refers to a remote repository to manage configuration files. Configuration files are extensively documented in the `README` of the `infrastructure/aws-cdk` folder in the source code.

In short, create a private repository, and create the following files/structure within it

```
.
├── infrastructure
│   └── dev
│       └── configs
│           └── dev.json
└── README.md
```

Replacing `dev` with your proposed stage. There can be multiple stages, as in this example. I am going to deploy the `prod` stage.

```
.
├── infrastructure
│   ├── dev
│   │   └── configs
│   │       └── dev.json
│   └── prod
│       └── configs
│           └── prod.json
└── README.md
```

Use the `sample.json` in `infrastructure/aws-cdk/configs/sample.json` as a starting point for your configuration json.

From now on, when I refer to updating values in the `config json` - this is the file I am referring to. **Ensure you sync your changes using the config script in the infrastructure/aws-cdk package to pull/push the latest changes to your deployment context as you go!**.

Validate that you can pull the config by running

```
./config.sh
./config.sh pull prod --config_repo git@github.com:repo-org/repo-name.git
```

assuming you use SSH for git authentication. `prod` being replaced with your stage. After you do this once, you can push pull without the config repo argument.

Now, when we edit the config json, just change it directly in your configs/<file.json> path, and push the changes using

```
./config.sh push prod
```

## Completing your configuration

Now update the following values in your config json

### Stack name

Set this to a nice short ID for the whole deployment. Changing this will require re-deploying the entire app! So choose something reasonable. It is just an identifier, it does not effect the app and is not displayed anywhere.

```json
  "stackName": "YourStackName",
```

### Hosted zone

Enter the domain and ID of the hosted zone, as above

```json
  "hostedZone": {
    "id": "your-hosted-zone-id",
    "name": "your-domain.com"
  },
```

You can find these in the hosted zones menu as below:

![hz details](assets/hz.png)

### Certs

Fill in these certificates - you noted down the ARNs earlier. Primary = your deployment region. Cloudfront = `us-east-1`

```json
  "certificates": {
    "primary": "arn:aws:acm:region:account-id:certificate/certificate-id",
    "cloudfront": "arn:aws:acm:us-east-1:account-id:certificate/certificate-id"
  },
```

### AWS Region and account ID

To be sure we are deploying to the right target, we include the AWS account ID and region:

```
  "aws": {
    "account": "your-aws-account-id",
    "region": "ap-southeast-2"
  },
```

### Private and public key secrets

Next, we will generate and link to the JWT public and private key secrets.

To generate them, ensure your AWS credentials in the terminal are active for the target account.

Then run

```
./scripts/genKeysAWS.sh <stage name e.g. prod>
```

for example

```
./scripts/genKeysAWS.sh prod
```

This will generate the keys locally, and upload them to AWS SM. Grab the indicated ARNs in the output to the terminal, and put them in the JSON:

```
  "secrets": {
    "privateKey": "arn:aws:secretsmanager:region:account-id:secret:private-key-secret-id",
    "publicKey": "arn:aws:secretsmanager:region:account-id:secret:public-key-secret-id"
  },
```

### UI Configuration

Let's talk through each option in the below:

```json
  "uiConfiguration": {
    "uiTheme": "default",
    "notebookListType": "tabs",
    "notebookName": "notebook",
    "appName": "FAIMS Mobile",
    "appId": "FAIMS",
    "offlineMaps": {
      "mapSource": "maptiler",
      "mapSourceKey": "your-maptiler-api-key",
      "offlineMaps": true,
      "mapStyle": "basic"
    }
  },
```

- `uiTheme`: there are currently two themes, `bubble` or `default`.
- `notebookListType`: 'tabs' or 'headings' display mode for notebook list
- `notebookName`: the app display name for notebooks, e.g. 'survey'
- `appName`: the title/display name of the app
- `appId` : the registered ID for any associated mobile apps - usually a globally unique short ID - will depend on/inform your app deployments.
- `headingAppName`: the heading banner display name - I'd recommend a short (fewer than five characters) acronym or abbreviation
- `offlineMaps`
  - `offlineMaps` true/false - false disables
  - `mapStyle`: the map style can be basic, osm-bright, openstreetmap or toner
  - `mapSource`: currently only supports 'osm' or 'maptiler'
  - `mapSourceKey`: API key for maptiler or OSM

If you just want to get a deployment going, you can leave most of these options default.

### Support links

```json
  "supportLinks": {
    "supportEmail": "support@your-domain.com",
    "privacyPolicyUrl": "https://your-domain.com/privacy-policy",
    "contactUrl": "https://your-domain.com/contact"
  },
```

Fill out these with sensible contact links, and privacy policy links.

### Couch DB Detailed instance configuration

The following parameters configure couch DB. Most are related to the instance size or monitoring thresholds. For more documentation on what they mean - see the configuration section of the infrastructure README.

I recommend the following configuration for a production level deployment - you may want to tinker with the volume size, and you'll need to update your contact email. If you are getting too many threshold emails, consider whether you need to increase resources, or increase the threshold.

```json
  "couch": {
    "volumeSize": 150,
    "instanceType": "m5.large",
    "monitoring": {
      "cpu": {
        "threshold": 80,
        "evaluationPeriods": 3,
        "datapointsToAlarm": 2
      },
      "memory": {
        "threshold": 85,
        "evaluationPeriods": 3,
        "datapointsToAlarm": 2
      },
      "disk": {
        "threshold": 70,
        "evaluationPeriods": 3,
        "datapointsToAlarm": 2
      },
      "statusCheck": {
        "evaluationPeriods": 2,
        "datapointsToAlarm": 2
      },
      "networkIn": {
        "threshold": 10000000,
        "evaluationPeriods": 3,
        "datapointsToAlarm": 2
      },
      "networkOut": {
        "threshold": 50000000,
        "evaluationPeriods": 5,
        "datapointsToAlarm": 3
      },
      "http5xx": {
        "threshold": 10,
        "evaluationPeriods": 5,
        "datapointsToAlarm": 3
      },
      "alarmTopic": {
        "emailAddress": "TODO@gmail.com"
      }
    }
  }
```

### Backups

```json
  "backup": {
    "vaultName": "faims-backup-vault",
    "retentionDays": 30,
    "scheduleExpression": "cron(0 3 * * ? *)"
  },
```

The prior configuration is valid - consider the combination of retention and schedule which suits your requirements for snapshot retention.

These snapshots retain the **EBS Volume backing couch** - we have tested that you can recover completely from this volume.

The above expression schedules a daily update at 3am - in combination with 30 day retentions, this means 30 concurrent snapshots - if you have a lot of data, this could result in a lot of storage costs - so beware.

### Conductor (API) Configuration

The following section configures the API

```json
  "conductor": {
    "name": "FAIMS Server",
    "description": "FAIMS Conductor instance deployment.",
    "conductorDockerImage": "org/faims3-api",
    "conductorDockerImageTag": "latest",
    "shortCodePrefix": "FAIMS",
    "cpu": 1024,
    "memory": 2048,
    "autoScaling": {
      "minCapacity": 1,
      "maxCapacity": 10,
      "targetCpuUtilization": 70,
      "targetMemoryUtilization": 70,
      "scaleInCooldown": 300,
      "scaleOutCooldown": 60
    },
    "localhostWhitelist": false
  },
```

You need to update the following

- `conductorDockerImage`: you can either use `ghcr.io/faims/faims3-api` OR you can fork the repo, and deploy your own container to GHCR, which will allow you more control over the lifecycle. I think by default use a tagged version of the FAIMS upstream container image.
- `conductorDockerImageTag`: I don't recommend using latest, as you may get out of sync, instead, specify the specific commit e.g. `sha-522bb4b`

The remaining options are for your consideration. They are largely performance, the below is a suitable production profile:

```json
        "cpu": 2048,
        "memory": 4096,
        "autoScaling": {
            "minCapacity": 2,
            "maxCapacity": 5,
            "targetCpuUtilization": 60,
            "targetMemoryUtilization": 65,
            "scaleInCooldown": 600,
            "scaleOutCooldown": 120
        }
```

keep `localhostWhitelist` false unless you are deploying a DEV server - this determines whether `localhost` is a valid URL for auth redirects. This is insecure for production systems.

### Domains

All of the routes used in the app are controlled by these domain prefixes - they will be subdomains on the specified base domain. E.g. for `your-domain.com`, this would result in couch being at `couchdb.your-domain.com`. Choose accordingly.

```json
  "domains": {
    "baseDomain": "your-domain.com",
    "conductor": "conductor",
    "couch": "couchdb",
    "faims": "faims",
    "web": "web"
  },
```

I am using the following prefixes:

```json
  "domains": {
    "conductor": "api",
    "couch": "db",
    "faims": "app",
    "web": "manager"
  },
```

Note that:

- conductor = the API
- couch = the main DB
- faims = the web deployment of the collection app
- web = the control center/admin console

### Mobile application links

Put in the public links to the iOS and Android apps, once they are deployed. I would recommend deploying the backend and web interfaces first (what we are doing now), then adding in the app deployments.

```json
  "mobileApps": {
    "androidAppPublicUrl": "https://play.google.com/store/apps/details?id=your.android.app.id",
    "iosAppPublicUrl": "https://apps.apple.com/app/your-ios-app-id"
  },
```

### SMTP

As noted previously, you need to have an SMTP server configured to send email validations, password resets etc.

First, gather your connection details, then create an AWS Secret Manager secret with the following template fields:

```json
{
  "host": "host-url",
  "port": "2525",
  "secure": "false",
  "user": "email@email.com",
  "pass": "password"
}
```

Create the secret with the above KVPs, and then copy the secret ARN.

Include the secret ARN alongside other parameters in the config file:

```json
    "emailServiceType": "SMTP",
    "fromEmail": "notifications@your-domain.com",
    "fromName": "FAIMS Notification Service",
    "replyTo": "support@your-domain.com",
    "testEmailAddress": "admin@your-domain.com",
    "cacheExpirySeconds": 300,
```

## Deploying using your configuration

You have bootstrapped your CDK account, setup some initial dependencies, and configured your config json (remembering to push it using `./config.sh push <stage>`), you should be ready to deploy FAIMS now.

To deploy, first ensure you have your AWS credentials for the target account configured.

Next, tell our CDK scripts which config to use, by setting the below environment variable to the filename of your config

```bash
export CONFIG_FILE_NAME=prod.json
```

then run a CDK diff

```
npx cdk diff
```

Note that this will take some time, as it involves building out some Docker and/or local assets.

Given that the application is not deployed yet, the diff should be successful, and indicate all new assets (green).

Once you're happy that the diff is as you expect, run a deploy!

```
npx cdk deploy
```

This will rebuild some assets, and request permission to deploy.

In my case, deployment was successful in about 10 minutes.

## Migrating your database

To get started, you'll need to run the DB migration.

Before doing this, you'll need to find the auto generated DB credentials. Navigate to AWS Secrets Manager, and find the secret with a name such as `couchdbCouchDBAdminPassword-ABCD1234`. Click on it, and retrieve the secret value.

**Warning**: This is the root credentials for the DB. Do NOT share this, or leave it in a vulnerable location.

Now, from the repo root, setup a `.env` file in the `api` package:

```
cd api
cp .env.dist .env
```

Then add the following values to the bottom of the .env file:

```
# OVERRIDES
COUCHDB_USER=admin
COUCHDB_PASSWORD="<YOUR DB PASSWORD>"
COUCHDB_EXTERNAL_PORT=443
COUCHDB_INTERNAL_URL=https://db.<your domain>:443/
COUCHDB_PUBLIC_URL=https://db.<your domain>:443/
AWS_DEFAULT_REGION=<your deployment region e.g. ap-southeast-2>
KEY_SOURCE=AWS_SM
AWS_SECRET_KEY_ARN=<secret ARN of the private key in AWS SM>
```

**Note**: The Secret key ARN above should be the same value as the

```json
  "secrets": {
    "privateKey": "arn:aws:secretsmanager:region:account-id:secret:private-key-secret-id",
```

value from above.

From within `api` (again ensuring your have AWS creds active!)

```
npm i
npx turbo build
npm run migrate -- --keys
```

This will migrate all the databases, and force push the JWT signing keys. In the future, you do not need to include the `-- --keys` postfix for routine migrations.

You should see output similar to

```
Public keys will be configured during migration
AWS SM Key Cache miss
JWT public key configured in CouchDB
Database auth (AUTH) is already up to date at version 5
Database directory (DIRECTORY) is already up to date at version 1
Database invites (INVITES) is already up to date at version 3
Database people (PEOPLE) is already up to date at version 4
Database projects (PROJECTS) is already up to date at version 2
Database templates (TEMPLATES) is already up to date at version 2
Migration completed successfully
```

After you have migrated your databases, the system should be fully operational.

## Bootstrapping your user account

I don't recommend using the CouchDB admin user/password to manage the system. Instead

1. create a team e.g. System Managers
2. create an admin team invite
3. open the invite link in a new anonymous tab and sign up with a real email/password
4. returning to your CouchDB admin account tab/window, refresh to see the new user (you), and grant them the General Admin role
5. logout of the CouchDB admin account, and sign in with your personal account

You can now manage the deployment with your personal login.

## Additional configurations

There are other additional configurations we did not cover, however they are out of scope for this particular tutorial.

For example, you can configure Google social sign in, and apply different themeing. You may also want to setup the GitHub actions CDK deployment workflow which allows a one click deploy.
