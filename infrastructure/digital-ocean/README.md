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
- local mirror under `config/<environment>/`
- sync via `scripts/sync-deployment-config.sh`

A sample config layout is provided under `infrastructure/digital-ocean/configs/sample/`.

## Planned migration

Phase 1 work is to establish the config structure and compatibility model before reworking the Terraform root deployment itself.

The next steps are:

1. standardise the config layout and naming
2. replace ad hoc `.env`-driven values with config-backed inputs
3. add the map-layer / spatial-processing and backup / ttl-cleanup hooks to the platform config
4. convert the example deployment into a coherent runtime root using the new config model
