# FAIMS 3 CDK Deployment

This CDK project includes AWS infrastructure as code to deploy FAIMS 3 and its associated components.

## Architecture overview

### Networking

The `FaimsNetworking` construct sets up the core network infrastructure:

- **VPC**: A custom VPC with a maximum of 2 Availability Zones.
- **Subnets**: Public subnets only, with no NAT gateways.
- **Application Load Balancer (ALB)**: A shared, internet-facing ALB in the public subnets.
  - Supports both HTTP (port 80) and HTTPS (port 443) listeners.
  - Automatically redirects HTTP traffic to HTTPS.
  - Uses certificates from AWS Certificate Manager for HTTPS.

### CouchDB (Database)

The `EC2CouchDB` construct deploys CouchDB:

- **EC2 Instance**: Runs a single EC2 instance with CouchDB.
- **User Data**: Installs and configures CouchDB using Docker. Runs Docker command as systemd service. Mounts EBS for couch data and mounts into docker container.
- **Cloud Watch**: Includes a set of monitoring alarms triggering SNS topics, subscribed to an email address. Cloudwatch agent is installed and configured on instance. Logs collected and reported to /ec2/couchdb log stream.
- **Secrets Manager**: Stores CouchDB admin credentials.
- **Custom Configuration**: Sets up CouchDB with specific settings, including CORS and authentication handlers.
- **Load Balancer Integration**: Uses the shared ALB with a dedicated target group. Will support clustering in the future and performs TLS termination.
- **DNS**: Creates a custom domain for CouchDB access.

### Conductor (API Service)

The `FaimsConductor` construct sets up the API service:

- **ECS Fargate**: Runs the Conductor API as a containerized service. Can either be built using CDK with a debug flag in the code, or preferably use a docker hub image (name and tag).
- **Task Definition**: Configures the container with environment variables and secrets.
- **Load Balancer Integration**: Uses the shared ALB with a dedicated target group.
- **Auto Scaling**: Configures service auto-scaling based on memory usage and CPU usage.
- **Secrets**: Utilizes AWS Secrets Manager for sensitive data like cookie secrets and database credentials.
- **DNS**: Creates a custom domain for the Conductor API.

### Frontend

The `FaimsFrontEnd` construct manages the web applications:

#### Main FAIMS Frontend

- **S3 Bucket**: Hosts the static website files.
- **CloudFront Distribution**: Serves the website globally with HTTPS.
- **Custom Error Responses**: Configures 404 and 403 errors to return the index.html for SPA routing.
- **Build Process**: Uses a custom build script with environment variable injection.
- **Content Security Policy**: Configures CSP headers for connecting to CouchDB and Conductor.

#### Web (New-conductor) Frontend

- Similar setup to the main frontend, but with a separate S3 bucket and CloudFront distribution.

#### Documentation site

- **Part of FaimsFrontEnd**: Built and deployed by the same construct as the app and web frontends.
- **S3 Bucket + CloudFront**: Static documentation site built from the `/docs` Sphinx user docs.
- **Build**: Uses CDK Docker bundling with the image built from `docs/Dockerfile` (Sphinx + themes). The `docs/user` tree is built with `sphinx-build -b html` and deployed to the bucket.
- **Domain**: Served at the `docs` subdomain (e.g. `docs.your-domain.com`). Configure via `domains.docs`; pass `docsDomainName` and mobile app URLs in the frontend props.

### TTL cleanup (scheduled one-shot)

The `FaimsTtlCleanup` construct (gated by `ttlCleanup.enabled`) runs expired ephemeral CouchDB auth/invite document cleanup as a **separate Fargate task**, not as in-process cron on the Conductor service:

- **Same image** as Conductor (`conductorDockerImage` / tag), with container **command override** to `node scripts/ttlCleanup.js` (WORKDIR `/app/api/build/src` from `Dockerfile.build` / `NODE_RUN_DIR`).
- **EventBridge Scheduler → ECS RunTask** (`taskCount: 1`) so Conductor auto-scaling does not multiply cleanup runs.
- **Schedule timezone:** cron hours use `ttlCleanup.scheduleExpressionTimezone` (default `Australia/Sydney`), so the default `cron(0 2 * * ? *)` is **02:00 Sydney local** (AEST/AEDT), not UTC.
- Shares Conductor cluster, security group, env, and Couch/KEY_SOURCE secrets; logs under CloudWatch prefix `faims-ttl-cleanup`.
- **Failure alerts:** an EventBridge rule watches ECS Task State Change for this task family; if the cleanup container exits non-zero, a clear message is published to the CouchDB ops SNS topic (`couch.monitoring.alarmTopic.emailAddress` subscribers).
- Design notes and retention rules: [TtlCleanup.md](../../docs/developer/docs/source/markdown/TtlCleanup.md).

Ship an API image that includes the script **before** setting `ttlCleanup.enabled: true`. Prefer `dryRun: true` first in non-prod; keep `compact: false` on the daily schedule. Ensure Couch monitoring alarm email is configured if you want email delivery of TTL cleanup failures.

### Auxiliary Components

- **Lambda Function**: A Node.js function to deregister EC2 instances from CloudMap during termination.
- **EventBridge Rule**: Triggers the deregistration Lambda when an Auto Scaling group terminates an instance.

### Security and Access Management

- **Certificates**: Uses ACM certificates for HTTPS, with separate certs for CloudFront and ALB.
- **Secrets**: Stores and manages various secrets including database credentials, API keys, and JWT signing keys.

This infrastructure is defined using AWS CDK, allowing for easy replication and modification across different environments.

## Installation

With nvm

```
nvm install 20
nvm use 20
```

or if you have it installed already

```
pnpm i aws-cdk -g
pnpm i
```

Now follow the below steps to setup your configuration.

## Building artifacts

PNPM is used to manage building some utility lambda functions separately to CDK process.

**Note**: These are intended to completely standalone from the monorepo in which this project lives.

To build the project

```
pnpm run build
```

To package for deployment.

```
pnpm run package
```

or just

```
pnpm run build && pnpm run package
```

This should build all the projects in `src`. If you add a new project, please update the `package.json` build scripts.

Use the existing packages as an example to start from, because the typescript config is very fussy.

# Configuration Setup

This project uses a JSON-based configuration system to manage different deployment settings. Here's how to set it up and use it:

## Creating Your Configuration

The deployment config is **two files**, the same ones every platform uses:
`core.json` (the shared deployment config — see
[Build Configuration](../../docs/developer/docs/source/markdown/Build-Configuration.md)),
loaded through `@faims3/build-config`'s full parser (shared invariants,
endpoint derivation), and `aws.json` (the AWS-specific extension: account /
Fargate / domains plus Secrets Manager **ARNs — never secret values**;
Secrets Manager delivers values to the ECS task and API at runtime).

**For example JSON structures, see `configs/sample/core.json` and
`configs/sample/aws.json`.** Copy them into an env folder (see below),
replacing the placeholder values with your actual settings. Legacy flat
configs can be migrated with
`library/build-config/scripts/migrate-aws-config.ts`.

## Using an existing configuration from conforming config repo

If you wish to store your configurations in a private repository, you can use our config script to easily import these configurations into your project or push your local changes back to the repository. This section explains how to structure your config repo, use the config script, and manage multiple environments.

### Config Repository Structure

There is **one** config layout for every platform (app, web, api, CDK). Your
configuration repository should follow this structure (base path `configs`
by default):

```
/
├── configs/
│   ├── dev/
│   │   ├── core.json
│   │   ├── aws.json
│   │   └── secrets.enc.json (optional, SOPS-encrypted; not used by CDK)
│   ├── staging/
│   │   ├── core.json
│   │   ├── aws.json
│   │   └── secrets.enc.json (optional)
│   └── prod/
│       ├── core.json
│       ├── aws.json
│       └── secrets.enc.json (optional)
└── (other repository files)
```

- Each environment directory contains exactly one `core.json` (shared,
  non-secret — the same file the app/web/api builds use) and, for AWS
  deployments, `aws.json` (AWS extension, secret ARNs only). No
  SOPS/`secrets.enc.json` step is needed or used for CDK deployments: AWS
  secret values live in Secrets Manager and are resolved at runtime.
  `secrets.enc.json` exists only for deployments that keep secret values in
  the overlay for non-AWS consumers / local dev replicas, and is ignored
  by the CDK.
- You can include other environment-specific files in each environment
  directory as needed. One is synced automatically: `cdk.context.json`,
  the CDK context cache, is a tracked build artifact (see
  [CDK Context File](#cdk-context-file-cdkcontextjson) below).

### Pulling / pushing config: the sync script

All platforms share one script, `scripts/sync-deployment-config.sh` in the
repo root (there is no CDK-specific config script). It mirrors an env
folder between the private config repo and a local working copy at
`<repo-root>/config/<environment>/`:

```bash
# from the FAIMS3 repo root
./scripts/sync-deployment-config.sh pull prod --config-repo "https://github.com/your-org/your-private-config-repo.git"
./scripts/sync-deployment-config.sh push prod --branch release --message "Updated prod configuration"
```

- `<push/pull>`: Use `pull` to fetch an environment into `config/<env>/`,
  `push` to commit your edited `config/<env>/` back to the repository.
- `<environment>`: The name of the environment (e.g., "dev", "staging", "prod").
- Options: `--force` (skip confirmations), `--branch <name>` (default:
  main), `--message <text>` (push only), `--config-repo <url>` or
  `--repo-path <path>` (an already-cloned config repo),
  `--config-path <path>` (base path in the repo, default: `configs`),
  `--local-root <path>` (local mirror root, default: `<repo-root>/config`).

Push only sends what changed, prompts for confirmation unless `--force`,
and refuses to commit unexpected files. `aws.json` and `secrets.json` are
both optional per environment — an AWS + mobile env with no overlay secrets
pushes and pulls cleanly with just `core.json` + `aws.json`.

### Handling Multiple Environments

1. Pull the environment you want (from the repo root):

   ```bash
   ./scripts/sync-deployment-config.sh pull prod
   ```

2. Point the CDK at the local mirror and work as usual (from
   `infrastructure/aws-cdk`):

   ```bash
   export CONFIG_ENV=prod
   pnpm run validate-config
   pnpm cdk diff
   ```

   `CONFIG_ENV=<name>` loads `<repo-root>/config/<name>/core.json` +
   `aws.json`. Alternatively point the CDK straight at any env folder —
   e.g. a checked-out config repo — with
   `CONFIG_DIR=<checkout>/configs/prod` (this is what CI does; files are
   read in place, nothing is copied).

3. Edit files under `config/<env>/`, then push them back:

   ```bash
   ./scripts/sync-deployment-config.sh push prod
   ```

### Important Notes

- Make sure your private repository is accessible from the machine where you're running the script.
- Keep your config repository private and secure, as it may contain sensitive information.
- When pushing changes, review your modifications carefully, especially for production environments.
- Always ensure that you're not accidentally pushing sensitive information to the repository. Secret _values_ never belong in `core.json`/`aws.json` — AWS values live in Secrets Manager (referenced by ARN); overlay values belong in `secrets.json`, which the sync script only ever pushes SOPS-encrypted.

By following this approach, you can securely manage different configurations for multiple environments while keeping your main project repository clean and your sensitive configuration data separate and private.

## Validating Configuration

To ensure your configuration files are correct and complete, we provide a validation script. This script checks your configuration against the defined schema, helping you catch errors before deploying.

Note that this validation is at a schema level, it might not catch improperly formed AWS references, instance sizes, invalid configurations etc. These will either be caught at synth time, or during CloudFormation deployment.

#### Running the Validation Script

1. To target your configuration files, set the `CONFIG_ENV` environment variable:

   ```bash
   export CONFIG_ENV=prod
   ```

   This will target the local mirror `config/prod/core.json` + `aws.json` at the repo root (or use `CONFIG_DIR`, or `CORE_CONFIG_FILE` + `AWS_CONFIG_FILE`, to point elsewhere).

2. The validation script is already set up in the `package.json`. To run it, use the following command:

   ```bash
   pnpm run validate-config
   ```

   This will validate the configuration resolved from `CONFIG_ENV` / `CONFIG_DIR` / `CORE_CONFIG_FILE` + `AWS_CONFIG_FILE`.

#### What the Validation Script Does

- The script loads the configuration exactly as the CDK app will (same env resolution, same parsers).
- It validates `core.json` through `@faims3/build-config` (full schema + shared invariants) and `aws.json` against the `AwsConfigSchema`, plus the cross-file provider rule.
- If the configuration is valid, you'll see a summary message with stack/account/region.
- If there are any validation errors, the script will output detailed error messages, indicating which parts of the configuration failed validation.

In GitHub Actions, `.github/workflows/validate-config.yml` always parses `core.json` via `@faims3/build-config`. When `aws.json` is present it also runs this same CDK command against the checked-out config repo (`CONFIG_DIR`). It needs the config-repo token and path variables, but not AWS credentials. See [Deploying the AWS stack](../../docs/developer/docs/source/markdown/DeployingAWSStack.md#github-actions-validate--one-click-cdk-deploy).

## Configuration documentation

The CDK loads **two config files**:

- **`core.json`** — the shared deployment config (branding, endpoints/domains, maps,
  sync, auth, authProviders, authTokens, limits, email, observability, android,
  ios, couchdb, dev, pouchdb). This is the same `core.json` every platform uses;
  the complete field reference is in the
  [Build Configuration](../../docs/developer/docs/source/markdown/Build-Configuration.md)
  page. The CDK parses it via `@faims3/build-config`'s `parseBuildConfig`.
- **`aws.json`** — the AWS-specific extension: account/region, hosted zone,
  certificates, Fargate sizing, backup, TTL cleanup, and Secrets-Manager
  **ARNs** (SMTP credentials, auth-provider credentials, signing key). Secret
  values are never in these files and are never fetched by the CDK — ECS
  injects them into the task from Secrets Manager, and the API fetches its
  signing key from Secrets Manager itself at runtime.

`configs/sample/core.json` + `configs/sample/aws.json` show the full shape.
The **`aws`** fields are documented below.

### `aws`

- `stackName`: The name of the stack to deploy to cloudformation. Note that changing this will completely redeploy your application.
- `hostedZone`: Used for deploying Route 53 routes in AWS.
  - `id`: The ID of your Route 53 hosted zone
  - `name`: The domain name of your hosted zone
- `certificates`:
  - `primary`: ARN of your primary ACM certificate (must support \*.base.domain)
  - `cloudfront`: ARN of your CloudFront ACM certificate (must be in us-east-1 and support \*.base.domain)
- `account`: Your AWS account ID
- `region`: The AWS region for deployment (e.g., ap-southeast-2 for Sydney) - defaults to ap-southeast-2
- `secrets`:
  - `privateKey`: ARN of the signing-key secret in Secrets Manager (one secret whose JSON holds both `rsa_private_key` and `rsa_public_key`; the API reads it at runtime)
- `smtpCredentialsSecretArn`: ARN of the secret containing SMTP credentials (`host`, `port`, `secure`, `user`, `pass`)
- `authProviders`: (Optional) AWS-specific social sign-in configuration (provider definitions live in `core.authProviders`)
  - `providers`: Array of provider IDs enabled for this stack (each must exist in `core.authProviders`)
  - `secretArn`: ARN of the Secrets Manager secret holding provider credentials (`<provider>-clientID`, `<provider>-clientSecret`, `<provider>-privateKey`, `<provider>-publicKey`, and `<provider>-idpPublicKey` when the SAML IdP cert is not in `core.authProviders`)
- `backup`:
  - `vaultName`: The name of the AWS Backup vault to create or use
  - `vaultArn`: (Optional) The ARN of an existing backup vault to use. If provided, a new vault will not be created
  - `retentionDays`: The number of days to retain backups (default: 30)
  - `scheduleExpression`: The cron schedule for running backups (default: daily at 3 AM)
- `ttlCleanup`: (Optional) Scheduled Conductor TTL cleanup of ephemeral CouchDB auth/invite docs. Defaults to disabled when omitted.
  - `enabled`: When `false`, no schedule or cleanup task definition is created (default: `false`)
  - `scheduleExpression`: EventBridge Scheduler cron/rate (default: `cron(0 2 * * ? *)` — 02:00 in `scheduleExpressionTimezone`)
  - `scheduleExpressionTimezone`: IANA timezone for the cron (default: `Australia/Sydney`). Hours in `scheduleExpression` are local to this zone, so daily runs stay at 02:00 through AEST/AEDT. Set to `UTC` if you need a fixed UTC hour instead.
  - `dryRun`: Pass `--dry-run` (report only; default: `false`)
  - `compact`: Pass `--compact` after successful deletes (default: `false`; keep off on frequent schedules)
  - `includeLongLived`: Pass `--include-longlived` for optional long-lived token sweep (default: `false`)
  - `deleteExhaustedInvites`: Pass `--delete-exhausted-invites` for non-expired invites with exhausted uses (default: `false`; keep off so uses can be raised later)
  - `cpu` / `memory`: Fargate size for the one-shot task (defaults: `256` / `512`)
  - Failure alerts use the CouchDB monitoring SNS topic (`couch.monitoring.alarmTopic.emailAddress`)
- Shared UI, maps, support, and email fields live in `core.json` — see
  [Build Configuration](../../docs/developer/docs/source/markdown/Build-Configuration.md)
  and `configs/sample/core.json`. Map / autosuggest keys in `core.maps` are
  baked into the front-end at build time; only use keys suitable for public
  consumption and set provider usage limits.

- `support` (**in `core.support`**): Links shown in the app (support, privacy, contact, docs).
  - `supportEmail`: Support email address (default: support@fieldmark.au)
  - `privacyPolicyUrl`: Privacy policy URL (default: https://fieldnote.au/privacy)
  - `appContactUrl`: Contact page URL; empty string hides the contact link
  - `docsUrl`: (Optional) Documentation site URL
- `couch`:
  - `volumeSize`: The size in GB of the EBS volume to mount to the EC2 instance
  - `couchVersionTag`: (Optional) The DockerHub version tag to use for the couch image - defaults to 3.3.3, e.g. 'latest'
  - `instanceType`: The EC2 instance type for CouchDB (e.g., "t3.small")
  - `ebsRecoverySnapshotId`: (Optional) The ID of an EBS snapshot to recover the couch data volume from
  - `monitoring`: (Optional) Configuration for CouchDB monitoring alarms
    - `cpu`: (Optional) CPU utilization alarm settings
      - `threshold`: Percentage threshold for CPU utilization (0-100)
      - `evaluationPeriods`: Number of periods to evaluate before triggering alarm
      - `datapointsToAlarm`: Number of datapoints that must be breaching to trigger alarm
    - `memory`: (Optional) Memory usage alarm settings (same structure as cpu)
    - `disk`: (Optional) Disk usage alarm settings (same structure as cpu)
    - `statusCheck`: (Optional) EC2 status check alarm settings
      - `evaluationPeriods`: Number of periods to evaluate before triggering alarm
      - `datapointsToAlarm`: Number of datapoints that must be breaching to trigger alarm
    - `networkIn`: (Optional) Network in alarm settings (same structure as cpu, but threshold in bytes)
    - `networkOut`: (Optional) Network out alarm settings (same structure as cpu, but threshold in bytes)
    - `http5xx`: (Optional) HTTP 5xx errors alarm settings (same structure as cpu, but threshold is count of errors)
    - `alarmTopic`: (Optional) SNS topic settings for alarms
      - `emailAddress`: Email address to send alarm notifications
- `conductor`: AWS-specific configuration for the Conductor API service (Fargate image/sizing, autoscaling, `localhostWhitelist`, `enhancedObservability`). Shared instance identity (`core.branding.conductorInstanceName`, `conductorDescription`, `conductorShortCodePrefix`), SSO policy (`core.auth.provisionSsoUsersPolicy`), and migration flags (`core.migration.*`) live in **`core.json`** — see [Build Configuration](../../docs/developer/docs/source/markdown/Build-Configuration.md).
  - `conductorDockerImage`: Conductor docker image name from public registry (e.g. ghcr.io/faims/faims3-api or org/faims3-api)
  - `conductorDockerImageTag`: (default "latest") Image tag; composed with `conductorDockerImage` as `image`:`tag`.
  - `enhancedObservability`: (Optional) Enable ECS enhanced observability (container insights)
  - `cpu`: The number of CPU units for the Fargate task
  - `memory`: The amount of memory (in MiB) for the Fargate task
  - `ephemeralStorageGiB`: (default `21`, range 21–200) Fargate ephemeral disk for the API task. Map-layer GDAL scratch is on the spatial worker (`spatialCapacity.ephemeralStorageGiB`, default 80), not here.
  - `localhostWhitelist`: (default false) Allow localhost-style redirects; not recommended for production
  - `autoScaling`: Auto scaling configuration for the Conductor service
    - `desiredCapacity`: The desired number of tasks to run
    - `minCapacity`: The minimum number of tasks to run
    - `maxCapacity`: The maximum number of tasks that can be run
    - `targetCpuUtilization`: The target CPU utilization percentage for scaling
    - `targetMemoryUtilization`: The target memory utilization percentage for scaling
    - `scaleInCooldown`: The cooldown period (in seconds) before allowing another scale in action
    - `scaleOutCooldown`: The cooldown period (in seconds) before allowing another scale out action
- `migration` (**now in `core.migration`**):
  - `disableMigrateOnStartup`: (default `false`) Skip API-boot Couch migrate and notebook walks (`DISABLE_MIGRATE_ON_STARTUP`). Leave false so boot still runs `initialiseAndMigrateDBs` + `validateDatabases`. Set true only when migrate is handled out of band (`pnpm migrate-with-keys`) or for a debug stack against an already-migrated DB. When true, the lock is unused (forced off). Setting `startupMigrationLockEnabled: true` with this flag is a config error.
  - `startupMigrationLockEnabled`: (optional) Couch-mediated startup-migration lock. AWS ECS is clustered, so CDK **defaults the lock on** when this is omitted. Set `false` to opt out on a single-task / debug stack (the same reason local `pnpm run dev` defaults the env flag off — a killed reload can leave a `running` lock that strands the next boot until the steal timeout). Skip-migrate forces the lock off.
  - `startupMigrationLockTimeoutMs`: (default `1800000`) Age of a still-`running` lock after which clustered waiters steal it and run migrate themselves (`STARTUP_MIGRATION_LOCK_TIMEOUT_MS`, 30 minutes). Timeout is not “skip migrate and attach”. Age is `now - startedAtMs` (no heartbeat); a steal does not cancel the original doer. Only used when the lock is enabled. The Conductor ALB health check is `GET /up` (bound before migrate; old images already served this path). `GET /ready` is mounted only after the full API attaches. ECS `healthCheckGracePeriod` is 120s for process start through that bind.
- `domains`: Route 53 subdomain prefixes that set up DNS/CDN. These are configured to **match** the URLs derived from `core.domains` (see [Build Configuration](../../docs/developer/docs/source/markdown/Build-Configuration.md)). Note: Apex domains are not currently supported.
  - `baseDomain`: The base domain for all services
  - `conductor`: The subdomain prefix for the conductor service
  - `couch`: The subdomain prefix for the CouchDB service
  - `faims`: The subdomain prefix for the main FAIMS web application
  - `web`: The subdomain prefix for the new-conductor web application
  - `docs`: The subdomain prefix for the documentation site (default: `docs`)
- `endpoints` (**in `core.endpoints`**): Configuration for mobile app store URLs.
  - `androidAppPublicUrl`: The public URL for the Android application in the Google Play Store
  - `iosAppPublicUrl`: The public URL for the iOS application in the Apple App Store
- `authTokens` & `limits` (**in `core.authTokens` and `core.limits`**): Security-related Conductor API settings. Defaults applied when omitted.
  - `maximumLongLivedDurationDays` (`core.authTokens`): (Optional) Max lifetime in days for long-lived tokens (default 90), or `"unlimited"` for no cap.
  - `rateLimiterEnabled` (`core.limits`): (default `true`) Express HTTP IP rate limiter (`RATE_LIMITER_ENABLED`). Set `false` when per-IP limiting is handled upstream (e.g. ALB/WAF). Does **not** control CouchDB-backed auth attempt limits or the export limiter.
  - `attemptLimiterEnabled` (`core.limits`): (default `true`) Per-user email-code / verification-challenge attempt limits (`ATTEMPT_LIMITER_ENABLED`). Keep `true` in production even when HTTP rate limiting is disabled upstream.
  - `exportRateLimiterEnabled` (`core.limits`): (default `true`) Dedicated limiter for notebook export mint/redeem (`EXPORT_RATE_LIMITER_ENABLED`). Independent of `rateLimiterEnabled` so ZIP/GDAL work stays capped when the global IP limiter is off.
  - `exportRateLimiterWindowMs` (`core.limits`): (default `600000`) Export-limiter window in milliseconds (`EXPORT_RATE_LIMITER_WINDOW_MS`).
  - `exportRateLimiterPerWindow` (`core.limits`): (default `20`) Export mint/redeem requests allowed per window (`EXPORT_RATE_LIMITER_PER_WINDOW`). Raise for bulk scripted dumps.

To use a specific configuration when deploying or synthesizing your CDK stack:

1. Open a terminal and navigate to your project directory.
2. Set the `CONFIG_ENV` environment variable to the name of your environment.
3. Run your CDK command.

For example, to deploy using the `prod` configuration (the local mirror
`config/prod/core.json` + `aws.json` at the repo root, pulled with the sync
script):

```bash
CONFIG_ENV=prod cdk deploy
```

Or to synthesize using the `dev` configuration:

```bash
CONFIG_ENV=dev cdk synth
```

Alternatively point at any directory containing `core.json` + `aws.json` (e.g. an env folder in a checked-out config repo, read in place — this is what CI uses):

```bash
CONFIG_DIR=../../config-repo/configs/dev cdk synth
```

## Switching Between Configurations

You can easily switch between different configurations by changing the `CONFIG_ENV`:

- For development: `CONFIG_ENV=dev`
- For production: `CONFIG_ENV=prod`
- For any other environment: `CONFIG_ENV=<name>` (the local mirror folder `config/<name>/` at the repo root)

## Configuration File Location

One layout everywhere: an env folder holding `core.json` + `aws.json`. In
the private config repository it lives at `configs/<environment>/` (base
path configurable); locally the sync script mirrors it to
`config/<environment>/` at the FAIMS3 repo root, and `CONFIG_ENV` reads
from there. `CONFIG_DIR` can point at any such folder directly.

The local mirror is automatically git ignored.

## Generating Keys and Setting ARNs

This project includes a script to generate RSA key pairs and store them in AWS Secrets Manager. Follow these steps to generate keys and set the ARNs in your configuration:

1. Locate the script at `scripts/genKeysAWS.sh` in your project directory.

2. Run the script with the following command:

   ```bash
   ./scripts/genKeysAWS.sh <host_target> [profile_name] [--replace]
   ```

   - `<host_target>`: The name of the host (e.g., dev, prod).
   - `[profile_name]`: (Optional) The name of the profile to generate keys. Default is 'default'.
   - `[--replace]`: (Optional) Flag to replace existing secrets instead of aborting.

3. The script will generate RSA key pairs and store them in AWS Secrets Manager. It will output the ARNs for both the public and private key secrets.

4. Copy the ARNs provided in the script output.

5. Update your `aws.json` (e.g., `config/prod/aws.json` in the local mirror) with the new ARN:

   ```json
   {
     ...
     "secrets": {
       "privateKey": "arn:aws:secretsmanager:region:account-id:secret:dev-keys-host-profile-private-xxxx"
     }
   }
   ```

   Only the `privateKey` ARN exists in config: the API reads both
   `rsa_private_key` and `rsa_public_key` from that one secret's JSON at
   runtime.

6. Replace the placeholder ARNs with the actual ARNs output by the script.

This process ensures that your CDK stack uses the correct, securely stored keys for JWT signing and validation.

Remember to run this script and update your configuration whenever you need to rotate keys or set up a new environment.

# CDK Context File (cdk.context.json)

The `cdk.context.json` file (in this directory) is CDK's cache of
non-deterministic resolutions made at synth time: AMI lookups, availability
zones, subnet/VPC lookups, and similar. CDK generates and updates it
automatically, and pinned values make synths reproducible across machines —
without it, every fresh checkout re-resolves against live AWS and can drift.

It is **not config**, so it doesn't live in the config mirror; it is a
_tracked build artifact_. The shared sync script
(`scripts/sync-deployment-config.sh`) keeps a copy per environment in the
private config repo (`configs/<env>/cdk.context.json`) and syncs it with
the file here:

- `pull <env>` copies the env's `cdk.context.json` into this directory (if
  the env has one).
- `push <env>` copies this directory's file back to the config repo (if it
  exists locally; CDK mutating it during synth is exactly what push
  captures). Absent on either side is a no-op — environments that have never
  tracked one are unaffected. `--no-artifacts` skips artifact sync.

Important notes about `cdk.context.json`:

1. This file is gitignored in this repo (per-environment copies live in the
   private config repo instead).
2. Its contents are non-secret (AMI/AZ/subnet identifiers), but keep the
   config repo private as usual.
3. Pinned values are deliberate: if an AMI is deregistered or an AZ removed,
   synth fails loudly rather than silently shifting. To refresh, delete the
   file, run `cdk synth`, then `sync-deployment-config.sh push <env>`.

In CI, the CDK deploy workflow restores the env's `cdk.context.json` from
the checked-out config repo into this directory before running CDK (and
does not write it back — refresh it from a developer machine via push).

## Security Note

Your configuration files may contain sensitive information. Do not commit these files to version control. They are already added to `.gitignore` for your protection.

# Config Troubleshooting

- If you encounter an error about missing or invalid configuration, ensure that:
  1. Your configuration files exist (`config/<env>/core.json` + `aws.json` in the repo-root local mirror, or your `CONFIG_DIR` folder).
  2. The env name matches what you specified in `CONFIG_ENV`.
  3. The JSON in your configuration files is valid and contains all required fields.

By following these steps, you can easily manage different configurations for various deployment environments in this project.

# Deploying CDK app

Ensure you have sufficient permissions for the target account and that they are available to the CLI e.g. `aws sts get-caller-identity`.

Then follow the above steps to

- build the package artifacts `pnpm run build && pnpm run package`
- generate your keys i.e. `./scripts/genKeysAWS.sh <host_target> [profile_name] [--replace]`
- setup your config
  - download your config from the private repo (`./scripts/sync-deployment-config.sh pull dev` from the repo root), then `export CONFIG_ENV=dev`
  - the same pull restores the env's `cdk.context.json` into this folder (tracked artifact; nothing to set up by hand)
- run appropriate cdk command
  - to synth only `cdk synth`
  - to diff `cdk diff`
  - to deploy or update `cdk deploy`

# Initialising DBs on first launch

The DBs are now initialised using a combination of

- EC2 user data on startup
- Conductor initialise route `/api/initialise`

The first is automatic, the second requires calling this endpoint, simply

```
curl -X POST https://your-conductor-endpoint.com/api/initialise
```

will suffice.

This

- establishes databases and configuration for them
- sets the public key for the database

This operation is a "no-op" if already setup.

# Recovering couch data volume from EBS snapshot

Couch data lives on a separate EBS volume (`/dev/xvdf`). AWS Backup
(`BackupConstruct`) snapshots that volume on the `backup` schedule; ad-hoc
snapshots use `scripts/ec2Snapshot.sh`. Restore is driven by
`couch.ebsRecoverySnapshotId` (`snap-…`).

**Operator procedure:** [CouchDB backup recovery on AWS](../../docs/developer/docs/source/markdown/CouchBackupRecoveryGuideAWS.md)
— prepare-replace → set snap id → `cdk deploy` → `ec2StartInstance.sh` →
`migrate-with-keys` → **leave the snapshot id set** (removing it and redeploying
replaces the volume with an empty disk).

Related scripts under `scripts/`: `ec2Snapshot.sh`, `ec2PrepareReplace.sh`,
`ec2StartInstance.sh`, `ssmCouchTunnel.sh` (VPC-only Couch / proxy stacks).

# Email Configuration

## Configuration

### SMTP Configuration

To configure the email service, put identity and service type in
`core.email` and the credentials ARN on `aws.smtpCredentialsSecretArn`:

```json
"email": {
  "emailServiceType": "SMTP",
  "emailFromAddress": "notifications@your-domain.com",
  "emailFromName": "FAIMS Notification Service",
  "emailReplyTo": "support@your-domain.com",
  "testEmailAddress": "admin@your-domain.com",
  "smtpCacheExpirySeconds": 300
}
```

```json
"smtpCredentialsSecretArn": "arn:aws:secretsmanager:region:account-id:secret:smtp-credentials-id"
```

Parameters:

- `emailServiceType`: The email service implementation to use (SMTP or MOCK)
- `emailFromAddress`: The email address to use as the sender
- `emailFromName`: The display name to use for the sender
- `emailReplyTo`: (Optional) The reply-to email address
- `testEmailAddress`: Email address for admin verification tests
- `smtpCacheExpirySeconds`: (Optional) Duration to cache SMTP connections in seconds
- `smtpCredentialsSecretArn`: ARN of the secret containing SMTP credentials (`aws.json`)

### SMTP Credentials Secret

The SMTP credentials must be stored in AWS Secrets Manager with the following structure:

```json
{
  "host": "smtp.example.com",
  "port": "587",
  "secure": "true",
  "user": "smtp_username",
  "pass": "smtp_password"
}
```

The script `scripts/genSMTPAWS.sh` provides a guided interface to generating this secret with the right structure in your AWS account.

- ensure you have an active AWS session with the right creds for the target account
- run `./scripts/genSMTPAWS.sh` and follow the prompts
- add the resulting config to your config JSON

## Testing Email Functionality

Once deployed, administrators can test the email service by making a POST request to the test endpoint:

```bash
curl -X POST https://your-conductor-endpoint.com/api/admin/test-email \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

This will:

1. Send a test email to the configured test address
2. Return detailed diagnostics about the process
3. Help identify any configuration issues

# Map-layer object storage

CDK creates a private S3 bucket for map-layer originals and normalized files, with CORS `GET`/`HEAD` so the app and Control Centre can download via a Conductor-issued presigned URL. CouchDB stores only metadata, including an S3 resource URI (`s3://region/bucket/key`). The Conductor task role and the spatial-worker task role are granted read/write; the capacity manager is not. Static AWS access keys are not set.

The capacity manager is a Fargate service with desired count 1 (min and max 1). It reads the Couch `pending` / `processing` queue and calls `ecs:RunTask` on the spatial-worker **task definition** (there is no worker service). Each worker polls and processes jobs until `spatialCapacity.idleExitMs` (default 60s) with nothing to claim, then exits. Idle tasks are not replaced. The manager role can `RunTask`, `ListTasks`, and `DescribeTasks`; it cannot `StopTask` or `UpdateService`.

Worker count is a threshold map of total queue depth (`inFlight` + `unclaimed`), not one task per job. `scaleThresholds` are the depths at which count increases from 1: `[3, 8, 16, 32]` means 1 worker below 3 jobs, 2 below 8, 3 below 16, 4 below 32, and 5 at 32+, always capped by `maxCapacity`. `starvationMs` (default 5 minutes) is a second scale-up trigger: if the oldest unclaimed job has waited that long, the manager asks for one extra worker above the depth step. `scaleInCooldownMs` (default `2 * starvationMs`, 10 minutes) spaces further extras from that same stale job so a worker coming online is not treated as another scale-up. Worker count never exceeds `maxCapacity` or the number of jobs in the queue (`inFlight` + `unclaimed`). `starvationMs: 0` disables the staleness trigger; `scaleInCooldownMs: 0` keeps only the first extra.

Optional `aws.json` block (defaults shown). Performance knobs are conservative for the
default 1 vCPU / 2 GiB worker. `gdalNumThreads: "ALL_CPUS"` already uses the
task vCPU count; raise `gdalCacheMaxMb` and `gdalWarpMemoryMb` on larger
tasks (for example 2048 / 1024 on an 8 vCPU / 32 GiB worker). Omit
`tippecanoeMaxThreads` to let tippecanoe use all CPUs.

```json
"spatialCapacity": {
  "maxCapacity": 4,
  "scaleThresholds": [3, 8, 16, 32],
  "reconcileMs": 15000,
  "starvationMs": 300000,
  "scaleInCooldownMs": 600000,
  "idleExitMs": 60000,
  "cpu": 1024,
  "memory": 2048,
  "ephemeralStorageGiB": 80,
  "managerCpu": 256,
  "managerMemory": 512,
  "gdalNumThreads": "ALL_CPUS",
  "gdalCacheMaxMb": 256,
  "gdalWarpMemoryMb": 256,
  "gdalWarpMulti": true
}
```

Those fields become worker-task env (`GDAL_NUM_THREADS`, `GDAL_CACHEMAX`,
`GDAL_WARP_MEMORY_MB`, `GDAL_WARP_MULTI`, and optional
`TIPPECANOE_MAX_THREADS`). The capacity manager does not receive them.
`gdalwarp` also gets `-multi`, `-wm`, `-wo NUM_THREADS=…`, and
`-co TILED=YES`. Homogeneous vector layers are written as FlatGeobuf;
mixed or unknown geometry becomes GeoJSONSeq. Both are tiled with
`tippecanoe` with family-specific thinning (polygons `-z 16`, drop and simplify at low zoom, no `--coalesce`; `--drop-fraction-as-needed --extend-zooms-if-still-dropping` so dense cadastre does not exit 100 or dissolve street blocks).

Attachment storage JSON in `core.json` (defaults shown):

```json
"attachmentStorage": {
  "serviceType": "S3",
  "prefix": "map-assets"
}
```

Conductor receives `ATTACHMENT_STORAGE_TYPE`, `ATTACHMENT_S3_BUCKET`, `ATTACHMENT_S3_PREFIX`, and `ATTACHMENT_S3_REGION`. After deploy, an operations admin can smoke-test auth with:

```bash
curl -X POST https://your-conductor-endpoint.com/api/admin/test-attachment-storage \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```
