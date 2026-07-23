# CouchDB version upgrade on AWS

Upgrade the CouchDB Docker image tag on an existing FAIMS AWS CDK deployment by
changing `couch.couchVersionTag` and redeploying.

Related docs:

- [Deploying AWS Stack](./DeployingAWSStack.md)
- [CDK README](../../../../../infrastructure/aws-cdk/README.md) — config pull/push,
  validation, and [EBS snapshot recovery](../../../../../infrastructure/aws-cdk/README.md#recovering-couch-data-volume-from-ebs-snapshot)
- Upstream: <https://docs.couchdb.org/en/stable/install/upgrading.html>

Not covered: notebook JSON migrations.

## Notes

- CouchDB runs as a single EC2 instance with `userDataCausesReplacement: true`.
  Changing `couchVersionTag` changes user data, so CloudFormation **replaces the
  instance**. The data EBS volume is separate and should be retained and
  reattached. The first deploy after enabling that flag also replaces once.
- **This procedure incurs Couch (and therefore app) downtime** while the
  instance is stopped/replaced and until keys are re-pushed. The sysadmin
  should notify users ahead of the maintenance window.
- Prefer a specific 3.x patch tag.
- After replace, re-push JWT public keys into Couch (`migrate-with-keys`); user
  data regenerates `local.ini` but does not restore signing-key config.

## Setup

### CDK config

From `infrastructure/aws-cdk`:

```bash
./config.sh pull <env> # note you may need --config_repo <git clone string> if first time running on a stage
export CONFIG_FILE_NAME=<env>.json
pnpm run validate-config
```

Keep `CONFIG_FILE_NAME` set for the whole window. `stackName` / region are in
`configs/<env>.json`.

### Repo revision and build

**Use the same whole-repo revision as the deployed FAIMS stack** (e.g. `main`
pulled up to date if that is what is deployed, or the git SHA/tag matching the
deployed Conductor/app image tags). A newer or older local tree can apply schema
changes early/late, regress the env, or leave design docs / shared packages out
of sync.

From the repo root:

```bash
pnpm install
pnpm build   # or npx turbo build
```

### API env from the deployed stack

With **AWS credentials active**, build `api/.env` from the Conductor task
(Secrets Manager values included). Later steps reuse this file.

From `api`:

```bash
./scripts/env-from-cdk-stack.sh <stack-name> -o .env --region <region>
# e.g. ./scripts/env-from-cdk-stack.sh DASS-stage -o .env -r ap-southeast-2
```

Confirm `api/.env` includes the region (needed for Secrets Manager / JWT key
load). The export script writes this when you pass `--region`; if missing, add:

```bash
# api/.env
AWS_DEFAULT_REGION=ap-southeast-2
```

### Notify users

Dump active user emails (uses `api/.env` above) and send a maintenance notice
**before** you stop Couch:

```bash
cd api
pnpm run dump-user-emails                 # one address per line (stdout)
pnpm run dump-user-emails -- --format=bcc # comma-separated for a BCC field
pnpm run dump-user-emails -- --format=csv > users.csv
```

Default skip filters drop addresses matching `test`, `demo`, or `example.com`;
see `api/README.md` (`--skip` / `--no-skip`).

## 1. Baseline

From `infrastructure/aws-cdk` (separate from `api/.env`):

```bash
cp scripts/.env.dist scripts/.env
```

Then use the values from `api/.env` to fill out the first fields (db url,
username, password) in `scripts/.env`, and set `STACK_NAME` to the CloudFormation
stack name from `configs/<env>.json` (same as `stackName`).

When ready, run (from `infrastructure/aws-cdk`, with **AWS credentials active**):

```bash
pnpm run couch-upgrade-baseline --instance-id   # resolve EC2_INSTANCE_ID into scripts/.env, then baseline
# or without lookup if EC2_INSTANCE_ID is already correct:
pnpm run couch-upgrade-baseline                    # save the JSON output
```

`--instance-id` looks up the Couch EC2 instance from `STACK_NAME` via
CloudFormation and writes `EC2_INSTANCE_ID` into `scripts/.env`. With
`CONFIG_FILE_NAME` set, the script also prints a short config summary.

## 2. Backup

Requires AWS credentials in this terminal. Uses `EC2_INSTANCE_ID` from
`scripts/.env` to find the Couch data volume (`/dev/xvdf`).

```bash
./scripts/ec2Snapshot.sh list     # recent snapshots for the data volume
./scripts/ec2Snapshot.sh create   # create snapshot; waits until completed
```

Do not proceed until you have a completed snapshot (or AWS Backup recovery
point) for this stack’s data volume.

## 3. Change tag and deploy

In `configs/<env>.json`, set `"couch": { "couchVersionTag": "<new-tag>" }`.

First push up config changes:

```bash
./config.sh push <env>   # if you use the private config repo
```

Then diff CDK to see what is changing (should expect only the instance, volume should be retained)

```bash
pnpm cdk diff            # expect instance replace; volume retained — stop if not
```

**Note**: It's not unusual for CDKBucketDeployments to get churn here. This is due to the local build environment typically being very slightly different to remote, and how it hashes files etc.

Before deploy, stop the instance and detach the data volume. CFN cannot move
`VolumeAttachment` to the new instance while the volume is still attached.

**WARNING**: This will initiate hard down-time. The couchDB will be unavailable from now until the updated CDK deployment, re-run of the user data script, and the migration. Ensure you are ready to follow through the below steps.

```bash
./scripts/ec2PrepareReplace.sh
pnpm cdk deploy
```

Watch CloudFormation events and ALB Couch target health until healthy. Refresh
`EC2_INSTANCE_ID` in `scripts/.env` for the new instance:

```bash
pnpm run couch-upgrade-baseline -- --instance-id
```

## 4. Re-init keys and migrate

Using the `api/.env` from Setup (re-run `env-from-cdk-stack.sh` only if you need
a fresh export). With **AWS credentials active** in this terminal
(`migrate-with-keys` loads signing keys from Secrets Manager):

```bash
cd api
pnpm run migrate-with-keys
```

Expect `JWT public key configured in CouchDB` and a successful migration.

## 5. Verify

From `infrastructure/aws-cdk`, refresh the instance id if needed and re-run the
baseline; compare to the pre-upgrade output (version, markers):

```bash
pnpm run couch-upgrade-baseline -- --instance-id
```

Smoke-test Conductor login, Control Centre, and the collection app.

## 6. Rollback (optional, if errors)

**Version only** (data looks intact): set `couchVersionTag` back, prepare-replace,
`cdk diff`, `cdk deploy`, re-run keys/migrate, re-verify. Some upgrades mutate
on-disk state; if auth breaks, use snapshot restore instead.

**Data restore:** follow
[Recovering couch data volume from EBS Snapshot](../../../../../infrastructure/aws-cdk/README.md#recovering-couch-data-volume-from-ebs-snapshot)
(`ebsRecoverySnapshotId`). Remove that field from config after a successful
restore.
