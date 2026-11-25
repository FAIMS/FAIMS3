# Deploy Fieldmark to Digital Ocean via Terraform

This directory contains the DigitalOcean deployment modules and the staging ground for the repo's modernised deployment model.

## Current state

The DigitalOcean path is in transition from the older, manual deployment pattern to the same configuration-driven deployment architecture used elsewhere in the repo.

The older example under `infrastructure/digital-ocean/example/` is useful as a historical reference, but it reflects the manual `.env` + committed-state pattern we want to replace.

## Configuration model

The DO deployment should follow the same pattern as the AWS deployment flow:

- `core.json` for shared non-secret runtime config
- `do.json` for DigitalOcean-specific deployment settings
- optional encrypted `secrets.enc.json` overlays via SOPS
- `do-secrets.enc.json` for DigitalOcean-only backup credentials
- local mirror under `config/<environment>/`
- sync via `scripts/sync-deployment-config.sh`

`core.json` is the sole source of truth for the deployment domain:
`domains.base` and `domains.services` are shared with the mobile and web
applications. DigitalOcean infrastructure must derive its hostnames from that
contract rather than duplicating a base domain in `do.json`.

The deployment root constructs the full API, app, web, CouchDB, and docs
domains from those shared settings and passes them explicitly into each module.
Modules retain `deployment_domain` for resource naming and DNS zone selection,
but must not synthesize service hostnames from provider-specific defaults.

A sample config layout is provided under `infrastructure/digital-ocean/configs/sample/`.

`do.json` has a strict, DigitalOcean-local schema in `validateConfig.ts`. It
currently covers only the fields consumed by the Terraform deployment and
rejects unknown fields so new settings must be added deliberately as modules
adopt them.

CouchDB backup behavior is configured from `do.json` under `backup`:
- `bucket` and `endpoint` (required) for the Spaces repository
- optional `schedule.onCalendar` and `schedule.randomizedDelayMinutes` for the
  systemd timer (UTC)
- optional `retention.daily|weekly|monthly`, `tag`, and `logDir`

Validate an environment directory with:

```bash
pnpm --filter=@faims3/infra-digital-ocean validate-config \
  --config-dir "$PWD/infrastructure/digital-ocean/configs/sample"
```

## CouchDB logs

CouchDB writes application logs to stderr, which the systemd service sends to
the persistent journal. Use the journal for both live and historical access:

```bash
sudo journalctl -u couchdb -f
sudo journalctl -u couchdb --since today
sudo journalctl -u couchdb-backup -f
sudo journalctl -u couchdb-backup --since "7 days ago"
```

Journal storage is persistent and capped at 500 MB on the CouchDB droplet.

## CouchDB backup and restore

Scheduled backups leave CouchDB running. CouchDB's append-only storage supports
copying `.couch` files while live. The backup follows CouchDB's recommended
ordering: secondary indexes under `.shards` are captured first, then the main
database/shard files. Both restic snapshots receive the same backup-run ID so
restore selects the exact pair rather than matching nearby timestamps.

The restore script accepts the new run-matched snapshot pairs, older
timestamp-matched pairs, and the stopped-instance complete snapshots. Restoring
a file-level backup onto a new instance may still require rewriting CouchDB
shard/node metadata because that metadata contains the Erlang node name. Always
restore to an isolated target and verify the databases before switching
production traffic.

New snapshots include a compatibility manifest with the exact installed
CouchDB package version and Erlang node name. A live restore refuses to proceed
when that metadata is missing or does not match the restore target. Prefer
provisioning the target with the backed-up version and node name. This keeps
the existing shard placement metadata valid without rewriting it. Temporary
restores remain available for manual inspection or an explicitly controlled
metadata repair; they are not automatically made live.

## Planned migration

Phase 1 work is to establish the config structure and compatibility model before reworking the Terraform root deployment itself.

The next steps are:

1. standardise the config layout and naming
2. replace ad hoc `.env`-driven values with config-backed inputs
3. add the map-layer / spatial-processing and backup / ttl-cleanup hooks to the platform config
4. convert the example deployment into a coherent runtime root using the new config model
