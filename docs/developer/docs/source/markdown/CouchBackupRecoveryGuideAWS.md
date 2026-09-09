# CouchDB backup recovery on AWS

Purpose: Restore the CouchDB **data** EBS volume from a known-good snapshot (manual
`ec2Snapshot.sh` or AWS Backup recovery point) by setting
`couch.ebsRecoverySnapshotId` and redeploying.

**Status**: Validated on DEV. Proceed carefully. Emergency recovery process. Worth exercising.

Related docs:

- [CouchDB version upgrade on AWS](./CouchVersionUpgradeGuideAWS.md) — similar
  tooling (`scripts/.env`, prepare-replace, `migrate-with-keys`)
- [Deploying AWS Stack](./DeployingAWSStack.md) — `backup` config
- [CDK README](../../../../../infrastructure/aws-cdk/README.md) — config
  pull/push, validation

## How backups relate to the stack

| Piece                                        | Role                                                                                   |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| Couch EC2                                    | Boot + Docker + `local.ini`; **not** the durable datastore                             |
| Data EBS (`/dev/xvdf` → `/opt/couchdb/data`) | Couch databases; retained across instance replace                                      |
| AWS Backup (`BackupConstruct`)               | Scheduled snapshots of **that EBS volume only** (vault + plan from `backup` in config) |
| Manual snapshot                              | `./scripts/ec2Snapshot.sh create` — same volume, ad-hoc `snap-…`                       |
| `couch.ebsRecoverySnapshotId`                | CDK creates a **new** volume from `snap-…` and attaches it                             |

AWS Backup EBS recovery-point ARNs look like
`arn:aws:ec2:<region>::snapshot/snap-…` — the `snap-…` id is what you put in
config.

Changing `ebsRecoverySnapshotId` replaces the **Volume** (and attachment). CDK
embeds the snap id in those construct ids (`…FromSnap…`) so CloudFormation
creates a new volume from the snap — you cannot add `SnapshotId` to an existing
volume in place. The same snap id keeps those ids stable (no churn). Clearing
the field drops the suffix and would replace again with an empty `volumeSize`
volume. The instance may stay; user data does not re-run unless the instance is
also replaced. This procedure stops/detaches first (same as upgrade) so
CloudFormation can move the attachment, then starts Couch again and re-runs
keys/migrate.

## Notes (AWS)

- **Downtime** from prepare-replace until Couch is healthy and
  `migrate-with-keys` succeeds. Notify users first.
- Restoring overwrites live on-disk data with the snapshot point-in-time. Newer
  writes are gone unless you have another copy.
- Prefer a completed snapshot **before** you destroy or detach anything you
  might still need (take a “last chance” snapshot of the current volume if it
  is still readable).
- After restore, run `pnpm run migrate-with-keys` (JWT public key + design-doc /
  schema migrations). Fresh `local.ini` from user data / boot is not enough for
  FAIMS auth.
- **Leave `ebsRecoverySnapshotId` in config after a successful restore.** Clearing
  it and redeploying replaces the data volume with a new empty one (`volumeSize`)
  and loses the recovered disk. Leaving the id only matters if the Volume
  resource is created/replaced again (it does not re-copy the snap every deploy).
- Default volume `RemovalPolicy` retains the old volume when CFN replaces it —
  delete the orphan manually only after you are sure.

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

From `infrastructure/aws-cdk`:

```bash
./scripts/env-from-cdk-stack.sh <stack-name> -o ../../api/.env --region <region>
# e.g. ./scripts/env-from-cdk-stack.sh DASS-stage -o ../../api/.env -r ap-southeast-2
```

Confirm `api/.env` includes the region (needed for Secrets Manager / JWT key
load). The export script writes this when you pass `--region`; if missing, add:

```bash
# api/.env
AWS_DEFAULT_REGION=ap-southeast-2
```

### Setup scripting env

From `infrastructure/aws-cdk` (separate from `api/.env`):

```bash
cp scripts/.env.dist scripts/.env
```

Then use the values from `api/.env` to fill out the first fields (db url,
username, password) in `scripts/.env`, and set `STACK_NAME` to the CloudFormation
stack name from `configs/<env>.json` (same as `stackName`).

### Local access to VPC-only Couch (couch auth proxy)

**When** couch-auth-proxy is deployed (Couch no longer on the public ALB;
[#2211](https://github.com/FAIMS/FAIMS3/pull/2211) — expected on `main` later),
`env-from-cdk-stack` sets `COUCHDB_INTERNAL_URL` to a **VPC private** address.
Laptop scripts (`dump-user-emails`, `migrate-with-keys`, baseline) cannot reach
it directly.

**Fix:** SSM port-forward Couch `:5984` to localhost, then point both
`api/.env` and `scripts/.env` at the tunnel (leave `COUCHDB_PUBLIC_URL` as the
public proxy hostname). Ensure `scripts/.env` has `STACK_NAME` (see Baseline
below).

```bash
# from infrastructure/aws-cdk — STACK_NAME from scripts/.env; leave running
./scripts/ssmCouchTunnel.sh
```

```bash
# api/.env
COUCHDB_INTERNAL_URL=http://127.0.0.1:5984

# infrastructure/aws-cdk/scripts/.env (baseline / EC2 helpers)
COUCH_URL=http://127.0.0.1:5984
```

Until proxy lands on `main`, skip this if Couch is still reachable via the
exported public/internal URL.

### Notify users

Dump active user emails (uses `api/.env` above) and send a maintenance notice
**before** you stop Couch:

```bash
cd api
pnpm run dump-user-emails                 # one address per line (stdout)
pnpm run dump-user-emails --format=bcc # comma-separated for a BCC field
pnpm run dump-user-emails --format=csv > users.csv
```

Default skip filters drop addresses matching `test`, `demo`, or `example.com`;
see `api/README.md` (`--skip` / `--no-skip`).

## 1. Baseline and choose recovery point

From `infrastructure/aws-cdk`, ensuring `scripts/.env` is correct:

```bash
pnpm run couch-upgrade-baseline --instance-id   # writes EC2_INSTANCE_ID; save JSON
./scripts/ec2Snapshot.sh list                        # recent snaps for /dev/xvdf
```

Pick a `snap-…` (table above, EC2 → Snapshots, or AWS Backup → vault recovery
points — parse `snap-…` from the EBS recovery-point ARN).

Optional last-chance backup of current data (if the volume is still good enough
to snapshot):

```bash
./scripts/ec2Snapshot.sh create   # wait until completed; keep this id aside
```

## 2. Set recovery snapshot in config

In `configs/<env>.json`:

```json
"couch": {
  "...": "...",
  "ebsRecoverySnapshotId": "snap-0123456789abcdef0"
}
```

`volumeSize` is ignored while a snapshot id is set (size comes from the snap).

```bash
./config.sh push <env>   # if you use the private config repo
pnpm cdk diff            # expect new Volume (+ attachment) ids (…FromSnap…); stop if blast radius is wrong
```

## 3. Stop, detach, deploy

**Hard downtime starts here.**

### Why we can't just run deploy: `ec2PrepareReplace.sh`

Setting `ebsRecoverySnapshotId` makes CDK/CloudFormation **replace** the Couch
data `Volume` (new construct id → new volume from `snap-…`) and
`VolumeAttachment`. That fails while the current data volume is still attached
to the instance (“already attached” / attachment cannot move).

`./scripts/ec2PrepareReplace.sh` (reads `EC2_INSTANCE_ID` from `scripts/.env`)
does the minimum AWS-side prep:

1. **Stop** the Couch EC2 instance (Couch down from here).
2. **Detach** the data volume on `/dev/xvdf` (or `EC2_DATA_DEVICE`).
3. **Wait** until that volume is `available`.

It does **not** delete the old volume, create the snapshot, or change config —
those are separate steps. After it finishes, `cdk deploy` can create the
recovery volume and attach it. (The script was named for instance-replace
upgrades; recovery reuses the same stop/detach precondition.)

### Run the setup and then deploy

```bash
./scripts/ec2PrepareReplace.sh
pnpm cdk deploy
```

Watch CloudFormation / CDK status until the update succeeds. Prepare-replace left
the instance **stopped**; after the new volume is attached, start it:

```bash
./scripts/ec2StartInstance.sh   # start EC2_INSTANCE_ID; wait until running
```

Then wait for ALB Couch target healthy and refresh the instance id:

```bash
pnpm run couch-upgrade-baseline --instance-id
```

If mount/Couch looks wrong on the old instance, force a clean user-data boot by
also replacing the instance (e.g. bump a harmless user-data-affecting setting or
follow the upgrade prepare-replace + deploy path) — draft note: confirm the
lightest reliable path while testing.

## 4. Re-init keys and migrate

AWS credentials active; use Setup’s `api/.env`:

```bash
cd api
pnpm run migrate-with-keys
```

Expect `JWT public key configured in CouchDB` and a successful migration.

## 5. Verify

```bash
# from infrastructure/aws-cdk — compare markers/version to step 1 / expected snap era
pnpm run couch-upgrade-baseline --instance-id
```

Smoke-test Conductor login, Control Centre, collection app. Optionally SSM to the
instance: `df -h /opt/couchdb/data`, `curl -s http://localhost:5984`.

## 6. After restore — leave the snapshot id

Keep `ebsRecoverySnapshotId` set to the snap you restored from (and push config
if you use the private config repo). Do **not** remove it and `cdk deploy` —
that replaces the Volume with a blank `volumeSize` disk.

Leaving the pin is fine for ongoing ops: unchanged deploys leave the existing
volume alone. The downside is only if the volume resource is later replaced
(stack recreate / attachment replace / accidental property churn): CFN would
build again from that same `snap-…`.

Optional later: delete any **previous** orphaned data volume CFN retained when
the restore replaced the live volume (irreversible — only after you are sure).

**Later task (not documented here):** procedure to copy data onto a “clean”
volume (no `SnapshotId` in the template) and drop the recovery pin safely.
