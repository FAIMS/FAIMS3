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

## Planned migration

Phase 1 work is to establish the config structure and compatibility model before reworking the Terraform root deployment itself.

The next steps are:

1. standardise the config layout and naming
2. replace ad hoc `.env`-driven values with config-backed inputs
3. add the map-layer / spatial-processing and backup / ttl-cleanup hooks to the platform config
4. convert the example deployment into a coherent runtime root using the new config model
