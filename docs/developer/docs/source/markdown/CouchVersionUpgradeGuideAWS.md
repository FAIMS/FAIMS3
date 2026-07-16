# CouchDB version upgrade on AWS (prototype runsheet)

**Status: prototype / untested.** This guide is a proposed operator runsheet for
upgrading the CouchDB Docker image tag on an existing FAIMS AWS CDK deployment.
It was written from the CDK implementation and related docs, **not** from a
completed production upgrade. Run it first on **stage**, capture gaps, then
promote the corrected playbook to DEV and PROD.

Companion docs:

- [Deploying AWS Stack](./DeployingAWSStack.md) — initial deploy and migrate
- CDK configuration — [`infrastructure/aws-cdk/README.md`](../../../../../infrastructure/aws-cdk/README.md)
  (config files, `config.sh` pull/push, `CONFIG_FILE_NAME`, validation)
- CDK recovery notes — same README (§ Recovering couch data volume from EBS
  Snapshot)
- Upstream CouchDB upgrade notes —
  <https://docs.couchdb.org/en/stable/install/upgrading.html>

This is **not** about FAIMS application schema migrations (`pnpm run migrate`,
notebook migrations). Those remain separate.

**Session setup:** every `cdk` / `validate-config` command in this runsheet
expects the target config filename to be exported in your shell. From
`infrastructure/aws-cdk`:

```bash
export CONFIG_FILE_NAME=<env>.json   # e.g. stage.json
```

Without this, CDK will not load the environment you intend. See the CDK
README sections _Using an existing configuration from conforming config repo_
and _Validating Your Configuration_.

---

## How upgrades work in this stack

CouchDB is a **single EC2 instance** running `couchdb:<tag>` via Docker +
systemd. Persistent data is on a **separate GP3 EBS volume** mounted at
`/opt/couchdb/data` and bind-mounted into the container.

The image tag comes from config:

```json
"couch": {
  "couchVersionTag": "3.3.3"
}
```

That value is baked into **EC2 user data** (`docker pull` + the systemd
`ExecStart=` line). Changing the tag therefore changes user data. In practice
CloudFormation **replaces the EC2 instance**. The **data volume is a separate
resource** and should remain and be reattached to the new instance (user data
skips `mkfs` when a filesystem already exists).

Important implications:

| Fact                                                                   | Implication                                                                                                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| User data runs on **first boot of a new instance only**                | Rebooting the current instance does **not** apply a new tag. An in-place `docker pull` + restart is **not** what CDK automates. |
| Admin password + cookie secret come from Secrets Manager on first boot | New instance should pick up the same secrets; `local.ini` is regenerated.                                                       |
| AWS Backup snapshots the **data EBS volume only**                      | That is the primary rollback safety net for data.                                                                               |
| Conductor (ECS) is separate                                            | Brief Couch downtime during instance replacement is expected; ALB health checks will flap until the new target is healthy.      |

Default tag if omitted: `3.3.3` (`infrastructure/aws-cdk/lib/config.ts`).

---

## Scope and non-goals

**In scope**

1. Capture a verifiable baseline (version + marker data).
2. Confirm a usable EBS recovery point.
3. Change `couchVersionTag`, review `cdk diff`, deploy.
4. Verify Couch version, data integrity, Conductor/app health.
5. Document rollback (retag vs snapshot restore).

**Out of scope (for now)**

- Disaster recovery restore-only drills (use the CDK README snapshot recovery
  path separately).
- Idle-replica / replication failover (proposed in CDK README, not implemented).
- Major Couch version jumps that require intermediate upgrades (e.g. 1.x → 2.x).
  Stay within CouchDB 3.x unless you have a separate migration plan.

---

## Prerequisites

Work from `infrastructure/aws-cdk` unless noted.

1. Target environment already deployed and migrated (see
   [DeployingAWSStack](./DeployingAWSStack.md)).
2. AWS CLI authenticated to the correct account/region.
3. Config available locally and selected for this shell session (see
   [CDK configuration docs](../../../../../infrastructure/aws-cdk/README.md)):
   ```bash
   ./config.sh pull <env>
   export CONFIG_FILE_NAME=<env>.json   # required for cdk diff / deploy / validate-config
   pnpm run validate-config
   ```
   Keep `CONFIG_FILE_NAME` set for the rest of the upgrade window (new
   terminals need the export again).
4. You know:
   - Couch public URL (e.g. `https://stage-couchdb.bss.nbic.cloud`)
   - Conductor / Control Centre / app URLs
   - How to retrieve the Couch admin password from Secrets Manager
     (`…CouchDBAdminPassword…`)
5. Chosen **target** Docker Hub tag exists, e.g. `3.4.3` or `3.5.2` — check
   <https://hub.docker.com/_/couchdb>. Prefer a specific patch tag, never
   `latest` for this exercise.
6. Read upstream release notes for the jump you are making. Example gotcha:
   CouchDB **3.4.0** password-hash auto-upgrade caused painful rollbacks; prefer
   **3.4.1+** (or later 3.x) if leaving 3.3.x.
7. Maintenance window agreed (single-node Couch = downtime).

---

## Phase 0 — Record the baseline

Do this **before** changing config. Paste values into your ops notes.

### 0.1 Config and AWS identity

```bash
jq '{stackName, couchVersionTag: .couch.couchVersionTag, volumeSize: .couch.volumeSize, backup: .backup, couchHost: (.domains.couch + "." + .domains.baseDomain)}' \
  "configs/${CONFIG_FILE_NAME}"

aws sts get-caller-identity
```

### 0.2 Live Couch version and cluster welcome

```bash
COUCH_URL="https://<couch-host>"   # e.g. https://stage-couchdb.bss.nbic.cloud
curl -sS "$COUCH_URL/" | jq .
# Expect "version": "3.3.3" (or whatever is current)
```

Optional (admin creds):

```bash
curl -sS -u "admin:${COUCHDB_PASSWORD}" "$COUCH_URL/_all_dbs" | jq .
curl -sS -u "admin:${COUCHDB_PASSWORD}" "$COUCH_URL/_node/_local/_versions" | jq .
```

### 0.3 Marker data (required for a meaningful test)

Create **known, checkable** content — not just “the UI looks fine”:

- At least one team, template, and project/survey with a stable name.
- At least one record with a distinctive field value (e.g.
  `UPGRADE_MARKER_2026-07-15`).
- Note counts you can re-check:

```bash
# Example: list DBs and doc counts for a couple of known DBs
curl -sS -u "admin:${COUCHDB_PASSWORD}" "$COUCH_URL/<db-name>" | jq '{db_name, doc_count, update_seq}'
```

Record in your notes:

| Item                            | Value |
| ------------------------------- | ----- |
| Pre-upgrade Couch version       |       |
| Stack name / region             |       |
| EC2 instance ID                 |       |
| Data volume ID                  |       |
| Marker project / record IDs     |       |
| Marker doc counts               |       |
| Conductor image tag (unchanged) |       |

Find instance / volume IDs in the EC2 console (volume attached at `/dev/xvdf`,
mounted at `/opt/couchdb/data`) or via CLI once you know the stack resources.

### 0.4 SSM access smoke test (optional but useful)

Instances are granted `AmazonSSMManagedInstanceCore`. After you have the
instance ID:

```bash
aws ssm start-session --target <instance-id> --region <region>
# then on the box:
docker ps
curl -sS http://localhost:5984/ | jq .
df -h /opt/couchdb/data
```

If SSM fails, note it as a gap; public HTTPS checks may still be enough for the
upgrade trial.

---

## Phase 1 — Confirm backup before changing anything

Do **not** upgrade without a recovery point you can name.

### 1.1 Check AWS Backup recovery points for the data volume

```bash
# List recent recovery points in the vault used by this env
aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name <vault-name> \
  --region <region> \
  --by-resource-type EBS \
  --max-results 20 \
  --query 'RecoveryPoints[].{Created:CreationDate,Arn:RecoveryPointArn,Status:Status,Resource:ResourceArn}' \
  --output table
```

Confirm:

- Status is `COMPLETED`
- The resource ARN matches **this stack’s Couch data volume** (not DEV/PROD)
- The recovery point is **after** you finished seeding marker data

### 1.2 If no suitable recovery point yet

Either wait for the scheduled job (`scheduleExpression` in config, default
03:00 UTC), or take an **on-demand** EBS snapshot of the data volume and note
the `snap-…` ID:

```bash
aws ec2 create-snapshot \
  --volume-id <data-volume-id> \
  --description "pre-couch-upgrade $(date -u +%Y%m%dT%H%M%SZ)" \
  --region <region> \
  --query 'SnapshotId' --output text
```

Wait until the snapshot is `completed`. Record the ID — this is your rollback
artifact for Phase 5B.

### 1.5 Go / no-go

Proceed only if:

- [ ] Marker data documented and re-readable
- [ ] Named snapshot or Backup recovery point exists and is complete
- [ ] Target Couch tag chosen and release notes reviewed
- [ ] Stakeholders aware of downtime window

---

## Phase 2 — Change config and review the diff

### 2.1 Update `couchVersionTag`

In `configs/<env>.json`:

```json
"couch": {
  "couchVersionTag": "3.4.3",
  ...
}
```

Push to the private config repo if that is how you manage env configs:

```bash
./config.sh push <env>
```

### 2.2 Synth / diff — what you should expect

```bash
export CONFIG_FILE_NAME=<env>.json
pnpm cdk diff
```

**Expected (prototype hypothesis):**

- EC2 instance **replacement** (user data / launch template change)
- Data volume **retained** (no destroy/recreate of the volume resource)
- **No** `ebsRecoverySnapshotId` unless you intentionally set one
- Conductor / frontends largely unchanged if you only edited the Couch tag

**Stop and investigate if the diff shows:**

- Replacement or deletion of the Couch **data volume**
- Unexpected changes to backup vault, secrets, or unrelated services
- Accidental introduction of `ebsRecoverySnapshotId`

Always run `cdk diff` before `cdk deploy` on a live environment.

---

## Phase 3 — Deploy the upgrade

```bash
pnpm cdk deploy
```

During deploy:

1. CloudFormation replaces the Couch EC2 instance.
2. New user data installs Docker, pulls `couchdb:<new-tag>`, mounts existing
   data volume, starts `couchdb-docker.service`.
3. Instance registers with the existing ALB target group; health checks must
   return HTTP 200 on `/`.

Watch:

- CloudFormation stack events for `DASS-stage` (or your `stackName`)
- ALB target health for the Couch target group
- Optional: SSM into the new instance and `tail -f /var/log/user-data.log`

---

## Phase 4 — Verify

### 4.1 Couch is on the new version

```bash
curl -sS "$COUCH_URL/" | jq '{couchdb, version, git_sha}'
```

Expect the new tag’s version string.

### 4.2 Data survived

Re-check marker DBs / doc counts / distinctive records from Phase 0.

```bash
curl -sS -u "admin:${COUCHDB_PASSWORD}" "$COUCH_URL/_all_dbs" | jq .
# plus the same per-DB info / document GETs you recorded earlier
```

### 4.3 Platform health

- Conductor login / API health
- Control Centre: list teams / projects / open a survey
- Collection app (web): open the marker project and confirm the record
- Optional: create one **new** record post-upgrade and sync

### 4.4 Host sanity (if SSM works)

```bash
docker ps --format '{{.Image}} {{.Status}}'
# expect couchdb:<new-tag>
df -h /opt/couchdb/data
systemctl status couchdb-docker --no-pager
```

### 4.5 Record post-upgrade IDs

| Item                                      | Value |
| ----------------------------------------- | ----- |
| Post-upgrade Couch version                |       |
| New EC2 instance ID                       |       |
| Data volume ID (should match pre-upgrade) |       |
| Marker checks pass? (Y/N)                 |       |
| Wall-clock downtime                       |       |

---

## Phase 5 — Rollback options (if verification fails)

Choose based on failure mode.

### 5A — Version-only rollback (preferred if data looks intact)

If Couch is unhealthy or the wrong version, but the data volume is fine:

1. Set `couchVersionTag` back to the previous tag (e.g. `3.3.3`).
2. `pnpm cdk diff` — expect another instance replacement; volume retained.
3. `pnpm cdk deploy`.
4. Re-run Phase 4 checks.

**Caveat:** some Couch upgrades mutate on-disk state (e.g. password hash
formats). A simple retag may not fully undo that. If auth breaks after
rollback, use 5B.

### 5B — Restore data volume from snapshot

Use when data is corrupted, missing, or retag rollback is insufficient.
Summarised from the CDK README:

1. Identify snapshot ID (`snap-…`) from Phase 1 (EC2 Snapshots and/or AWS Backup
   restore → snapshot).
2. Set in config:
   ```json
   "couch": {
     "ebsRecoverySnapshotId": "snap-…",
     "couchVersionTag": "<desired-tag>"
   }
   ```
3. `pnpm cdk diff` carefully (volume will be created from the snapshot).
4. `pnpm cdk deploy`.
5. Verify mount + data + version.
6. **Remove** `ebsRecoverySnapshotId` from config after success so future
   deploys do not reuse it.

The README still marks this path with verification TODOs — treat a successful
stage restore as evidence to update both docs.

---

## Phase 6 — Close out

After a successful stage run:

1. Push final config (without recovery snapshot ID) via `./config.sh push`.
2. Note any playbook gaps in the section below (or a ticket).
3. Schedule the same runsheet on **DEV**, then **PROD**, only after stage
   sign-off.
4. For PROD: longer maintenance window, explicit communications, and confirm
   Backup retention covers your rollback needs.

Optional follow-ups outside this runsheet:

- Separate **DR restore-only** drill (snapshot → `ebsRecoverySnapshotId`) without
  a version change.
- Decide whether DEV’s next deploy should adopt the stack-prefixed CloudWatch
  dashboard name (already fixed in CDK for new stacks).

---

## Suggested stage trial parameters

Use these for the first end-to-end attempt (adjust if your stage baseline
differs):

| Parameter       | Suggested value                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| Environment     | `stage` / `DASS-stage`                                                                                 |
| From tag        | `3.3.3` (current explicit config)                                                                      |
| To tag          | `3.4.3` (or newer 3.x patch after reading release notes)                                               |
| Backup          | Confirm vault `faims-stage-backup-vault` has a post-seed recovery point, **or** take a manual snapshot |
| Conductor image | Leave unchanged for this trial                                                                         |

---

## Known gaps / hypotheses to validate while you run this

Capture what actually happens; update this doc afterward.

1. **Does `cdk diff` always replace only the instance when `couchVersionTag` changes?**  
   Confirm the data volume resource ID is unchanged across the deploy.
2. **Is AWS Backup’s recovery point visible as an EC2 `snap-…` usable with `ebsRecoverySnapshotId`?**  
   Or must operators restore a recovery point to a snapshot first?
3. **How long is Couch unavailable** (ALB unhealthy) during replacement?
4. **Do Conductor tasks need a restart** after Couch returns, or do they recover alone?
5. **SSM Session Manager** — does it work reliably on the new instance for log inspection?
6. **Disk monitoring** still watches `/` only, not `/opt/couchdb/data` — unrelated to upgrade but easy to misread during the drill.
7. **Password / auth edge cases** on 3.3 → 3.4+ — confirm local admin and app users still authenticate after upgrade and after any retag rollback.
8. **User-data failures** — if Docker pull fails (rate limits, bad tag), what does CFN / the instance look like, and is the old volume still safe?

---

## Feedback template (paste back after the stage run)

```text
Environment:
From tag → To tag:
Snapshot / recovery point used:
cdk diff summary (instance replace? volume retained?):
Downtime (approx):
Marker data OK after upgrade? (Y/N):
Conductor/app OK? (Y/N):
Rollback tested? (none / 5A / 5B):
Gaps / doc corrections:
```
