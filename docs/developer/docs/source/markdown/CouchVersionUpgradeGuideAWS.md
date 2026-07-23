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
- Expect Couch downtime during replacement.
- Prefer a specific 3.x patch tag.
- After replace, re-push JWT public keys into Couch (`migrate-with-keys`); user
  data regenerates `local.ini` but does not restore signing-key config.

## Setup

From `infrastructure/aws-cdk`:

```bash
./config.sh pull <env>
export CONFIG_FILE_NAME=<env>.json
pnpm run validate-config
```

Keep `CONFIG_FILE_NAME` set for the whole window.

## 1. Baseline

```bash
cp scripts/.env.dist scripts/.env
# fill COUCH_URL, COUCHDB_PASSWORD, MARKER_DBS, EC2_INSTANCE_ID
pnpm run couch-upgrade-baseline     # save the JSON output
```

With `CONFIG_FILE_NAME` set, the script also prints a short config summary.

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

Before deploy, stop the instance and detach the data volume. CFN cannot move
`VolumeAttachment` to the new instance while the volume is still attached:

```bash
./scripts/ec2PrepareReplace.sh
pnpm cdk deploy
```

Watch CloudFormation events and ALB Couch target health until healthy. Update
`EC2_INSTANCE_ID` in `scripts/.env` to the new instance id.

## 4. Re-init keys and migrate

Build `api/.env` from the deployed Conductor task (Secrets Manager values
included), then re-run DB init + JWT key push against the new Couch instance.
`stackName` / region are in `configs/<env>.json`.

From `api` (AWS credentials active):

```bash
./scripts/env-from-cdk-stack.sh <stack-name> -o .env --region <region>
# e.g. ./scripts/env-from-cdk-stack.sh DASS-stage -o .env -r ap-southeast-2
pnpm run migrate-with-keys
```

Expect `JWT public key configured in CouchDB` and a successful migration.

## 5. Verify

Update `EC2_INSTANCE_ID` in `scripts/.env` if you have not already, then from
`infrastructure/aws-cdk` re-run the baseline and compare to the pre-upgrade
output (version, markers):

```bash
pnpm run couch-upgrade-baseline
```

Smoke-test Conductor login, Control Centre, and the collection app.

## 6. Rollback

**Version only** (data looks intact): set `couchVersionTag` back, prepare-replace,
`cdk diff`, `cdk deploy`, re-run keys/migrate, re-verify. Some upgrades mutate
on-disk state; if auth breaks, use snapshot restore instead.

**Data restore:** follow
[Recovering couch data volume from EBS Snapshot](../../../../../infrastructure/aws-cdk/README.md#recovering-couch-data-volume-from-ebs-snapshot)
(`ebsRecoverySnapshotId`). Remove that field from config after a successful
restore.

## 7. Close out

Push final config (no `ebsRecoverySnapshotId`). Promote the same steps to DEV,
then PROD, only after stage sign-off.
