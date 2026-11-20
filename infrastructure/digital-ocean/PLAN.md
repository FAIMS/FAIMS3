# Digital Ocean Deployment Plan

## Goal

Bring the Digital Ocean deployment code back into the main repository and modernise it to match the repo's current configuration-driven deployment model. The end state should be a repeatable, reviewable, and secure deployment process that is easier to maintain by anyone other than the original author.

This plan is designed to replace the old fragile pattern of manually editing `.env` files, checking in generated deployment state, and making one-off infrastructure tweaks without a repeatable workflow.

## Background and current state

The current Digital Ocean implementation in this directory is in an intermediate state:

- there is a partial legacy deployment example under `infrastructure/digital-ocean/example/`
- the example still uses a manual setup: copying `terraform.tfvars`, generated local keys, ad hoc `.env` files, and checked-in state assumptions
- the legacy flow documents committing Terraform state to a private deployment repo and granting broad access to deployers
- there is no CI workflow, no automated validation, and no standard environment separation
- the current Terraform modules are not yet aligned with the repo's shared deployment configuration pattern

That legacy pattern is the opposite of the architecture now used elsewhere in the repo. The AWS deployment path already documents a cleaner model using:

- a private config repository
- a shared config sync script
- per-environment config folders
- a non-secret `core.json` plus platform-specific extension files
- optional encrypted secret overlays (`secrets.enc.json` via SOPS)
- environment-specific config selection via `CONFIG_ENV` / `CONFIG_DIR`

The DO deployment should follow that approach rather than inventing a different configuration model.

## Target architecture

### 1. Config repository / environment model

We should adopt the same structure used by the AWS deployment flow:

```text
config/
  dev/
    core.json
    do.json
    secrets.enc.json   # optional
  staging/
    core.json
    do.json
    secrets.enc.json   # optional
  prod/
    core.json
    do.json
    secrets.enc.json   # optional
```

The exact file names can follow the same repo convention as the AWS path, but the important design is:

- `core.json` contains shared non-secret configuration
- platform-specific config contains DO-specific settings (domains, region, sizes, app settings, etc.)
- secrets remain separate and encrypted
- envs are isolated by deployment target (`dev`, `staging`, `prod`)

The repo's shared sync script is the canonical mechanism to mirror config between a private config repository and the local working tree:

- `scripts/sync-deployment-config.sh`
- local mirror under `config/<environment>/`
- `CONFIG_ENV` or `CONFIG_DIR` used to select the current environment

We should treat this as the standard deployment configuration pattern for DO too.

### 2. State management

Terraform state must not live in the same repo as the deployment code and should not be managed as a checked-in deployment artifact.

Recommended pattern:

- remote state backend for each environment
- separate state workspace per environment
- protected locking and access controls
- no `.tfstate` files committed to source control

This is one of the biggest changes from the legacy example and is essential to making the deployment repeatable and safe.

### 3. Secrets management

Sensitive values must remain separate from the general deployment config. The recommended pattern is:

- keep non-secret config in the config repo
- keep encrypted secret overlays in the private config repo or equivalent secure secret store
- use SOPS for encrypted secret files where needed
- never hardcode live credentials in Terraform modules or application `.env` files in the repo

Where the deployment needs direct runtime values for the app, the app should consume them from a secure path at runtime rather than as plaintext in the Terraform source.

### 4. CI and deployment workflow

The DO deployment should have a proper CI path with:

- validation on pull requests
- `terraform fmt` and `terraform validate`
- `terraform plan` against the target environment
- approval gate before production apply
- smoke testing after deployment

This should replace the old ad hoc manual process.

### 5. Map storage and spatial processing services

The DO deployment also needs to include the newer map-layer storage and processing stack that was recently added to the AWS deployment path. In AWS this is handled as a S3-backed spatial storage layer plus a capacity-manager / spatial-worker job flow. The DO equivalent should include:

- S3-compatible object storage for map-layer originals and processed tiles
- a capacity manager that watches the job queue and starts processing workers
- a spatial worker task that performs raster processing / tiling / GDAL operations
- secure IAM / credentials / bucket access model that grants read/write to workers only where needed
- environment config for worker sizing, idle exit time, concurrency and cache settings

This is not optional; it is now part of the core deployment stack for map data services and needs to be included in the DO design and config model.

### 6. TTL cleanup and CouchDB backup cron jobs

The DO deployment should also cover the operational jobs that the AWS stack explicitly configures:

- TTL cleanup for expired ephemeral CouchDB auth/invite records
- scheduled CouchDB backup jobs with retention policy and storage destination
- logging and alerting around failed backup or cleanup runs
- timezone-aware cron configuration so the schedule is predictable and valid in production

The existing DO CouchDB module already contains backup scripts and a backup env file, so this work is partly present but needs to be formalized as a proper deployment feature rather than a manually managed script path.

## Why the AWS model is the right reference

The AWS deployment path is already a consistent, repo-native pattern for:

- config repo structure
- env scoping
- secure config sync
- deployment validation
- operating practices around secrets and state

We do not need to invent a brand-new model. The job is to adapt the same approach to Digital Ocean.

Relevant references in the repo:

- [infrastructure/aws-cdk/README.md](../aws-cdk/README.md)
- [infrastructure/aws-cdk/lib/config.ts](../aws-cdk/lib/config.ts)
- [scripts/sync-deployment-config.sh](../../scripts/sync-deployment-config.sh)
- [docs/developer/docs/source/markdown/Build-Configuration.md](../../docs/developer/docs/source/markdown/Build-Configuration.md)

## Key migration issues to address

### 1. Remove the legacy manual deployment pattern

The old example at `infrastructure/digital-ocean/example/` has the wrong operating model:

- manual key generation in a deployment repo
- `.env` and `terraform.tfvars` editing by hand
- local secret files committed or generated as deployment artifacts
- no review pipeline
- state stored with the deployment repo

This should be treated as a historical reference only, not as the default deployment pattern going forward.

### 2. Reconcile the modules with the current config design

The Terraform modules must be reviewed and normalized so they consume config from the environment model, rather than ad hoc variables deep in one-off deployment files.

This includes:

- standardizing module names and inputs
- removing stale or duplicated variables
- making module boundaries consistent
- ensuring the root environment declaration reads from env config rather than generated local files
- replacing hardcoded values where they are not actually environment-specific

### 3. Make the stack more robust

The current deployment flow is fragile because it depends on generated local assets and manual state. We need to make it more repeatable by:

- centralizing environment configuration
- removing generated secrets from the working tree where possible
- reducing implicit assumptions about hostnames, keys, and local file layout
- making Terraform validation explicitly part of the workflow
- using one canonical path for deploys

### 4. Define a safe environment lifecycle

We should define and document a clear lifecycle for each target environment:

- `dev`: disposable or low-risk testing environment
- `staging`: near-production validation
- `prod`: real deployment

Each environment should have its own config folder, state workspace, and approval path.

## Workstreams

### Workstream 1: align the DO deployment with the shared config system

Tasks:

- define the DO config structure and naming convention
- decide which values are shared vs DO-specific
- decide which values are secrets vs non-secret
- map the current module inputs onto config-backed values
- ensure the root environment declaration reads from env config rather than generated local files

Deliverable:

- a working config-backed DO deployment root that can load environment-specific values without hand-editing `.env` files

### Workstream 2: replace the legacy example with a coherent root deployment

Tasks:

- replace the example-based root with a proper deployment root structure
- ensure the root refers to modules consistently and correctly
- remove stale assumptions from the example README and scripts
- document the supported env structure and module wiring

Deliverable:

- a clean, coherent deployment root that can serve as the canonical DO deployment entrypoint

### Workstream 3: improve robustness and repeatability

Tasks:

- reduce hardcoded region, hostname, and module assumptions
- fix mismatches between module names and variables
- formalize required variables and validations
- standardize inputs for secrets and runtime configuration
- separate runtime config from deployment scaffolding

Deliverable:

- a Terraform stack that is less error-prone and easier to review

### Workstream 4: implement a safe deployment workflow

Tasks:

- configure remote state backend
- define environment handoff flow (`dev` -> `staging` -> `prod`)
- create approval gates for production
- add CI checks for fmt/validate/plan
- add a smoke-test path after apply

Deliverable:

- a documented deployment process that another maintainer can follow without the original author being present

### Workstream 5: map storage and spatial-processing services

Tasks:

- add map storage to the deployment model and config schema
- define the S3-compatible storage target for map-layers / processed assets
- add the capacity-manager and spatial-worker deployment pattern from the AWS model
- configure worker sizing, concurrency, GDAL tuning, and idle exit behavior
- define access and logging for the map-processing pipeline

Deliverable:

- a deployed DO map pipeline that supports the same spatial processing model as the AWS stack

### Workstream 6: scheduled operational jobs and maintenance automation

Tasks:

- add TTL cleanup scheduling for expired CouchDB auth/invite documents
- ensure CouchDB backup jobs are part of the deployment rather than manual post-deploy scripts
- define retention rules, destinations, logging, and failure handling
- schedule backup and cleanup windows in a timezone-aware way
- document how to recover or restore from backup safely

Deliverable:

- a deployed maintenance layer for backup and cleanup that is repeatable and not dependent on custom manual intervention

### Workstream 7: validate in staging before production

Tasks:

- run a disposable DigitalOcean dev deployment
- verify API, database, app, docs, and spatial-processing services
- validate certificate and DNS setup
- verify auth and secret wiring
- promote only after successful stage validation

Deliverable:

- confidence that production deployment can be run with minimal manual intervention

## Proposed implementation sequence

### Phase 1: audit and cleanup

- review current DO modules and identify stale or mismatched inputs
- document the current root stack and what should be replaced
- decide which legacy example files are historical and which parts are to be retained as templates

### Phase 2: align the configuration model

- create the env config pattern based on the AWS model
- define non-secret vs secret values
- define the DO-specific config extension
- update the deployment root to consume the selected env config

### Phase 3: rebuild the deployment root

- create the canonical root deployment for DO
- compose the modules through that single root
- remove manual `terraform.tfvars` patterns from the default workflow
- ensure all required values are explicit and validated

### Phase 4: harden the modules

- fix duplicate or stale module names
- reconcile `region` handling and naming conventions
- remove brittle asset-generation assumptions from the default path
- make runtime configuration explicit and deterministic

### Phase 5: validation, staging, and rollout

- set up a dev/staging environment
- run `terraform validate` and `terraform plan`
- deploy to a disposable test stack
- smoke test the stack
- then move to production only after a successful staged rollout

## Operational guidance for maintainers

### Recommended deployment ownership model

A workable long-term model is:

- a private config repository holds deployment configuration and encrypted secrets
- the Terraform repo contains deployment code and modules
- Terraform state is stored in a remote secure backend
- a small set of trusted maintainers can manage the deployment via CI or controlled commands
- production applies require approval and a documented rollout review

This is much better than keeping all state and settings in a single private repo and treating deployment as a manual local activity.

### Local development workflow

The recommended local working pattern is:

1. pull the target environment config into `config/<environment>/`
2. set `CONFIG_ENV` or `CONFIG_DIR` to the correct environment
3. run `terraform init`
4. run `terraform validate`
5. run `terraform plan`
6. apply only to a disposable or staging environment while validating the stack

This should be the standard development and QA loop.

## Testing strategy

We should validate the stack at multiple stages.

### Static validation

- `terraform fmt -check`
- `terraform validate`
- `terraform plan` for each environment

### Runtime smoke tests

After a deployment, verify:

- API health endpoint responds
- web app loads correctly
- docs site loads correctly
- database connectivity works
- certificate and DNS are valid
- auth and signing configuration load properly

### Environment-specific validation

- dev: disposable, fast feedback
- staging: near-production checks
- prod: only after staged validation passes

## Risks and constraints

The main risks in this migration are:

- relying on stale manual assumptions from the old example
- mixing secrets and config in the same file set
- checking in Terraform state or generated local config artifacts
- not separating development and production deployment targets clearly enough
- not having CI validation before apply

The plan is to deliberately address each of these by design, not by one-off patches.

## Exit criteria

The work is complete when all of the following are true:

- Digital Ocean deployment configuration is driven by the repo's shared config model
- the deployment root is coherent and no longer depends on manual `.env` editing and generated asset assumptions
- runtime secrets are separated from the general config
- Terraform state is in a secure remote backend
- `dev`, `staging`, and `prod` (or equivalent) are clearly defined
- CI validates the deployment via fmt / validate / plan
- a staging deployment can be created and smoke-tested reliably
- maintainers can operate the stack without the legacy manual practice

## Immediate next step

The next concrete step is to turn this plan into a real implementation pass:

1. define the exact DO config layout and file names
2. identify the root deployment structure to replace the legacy example
3. convert the current modules to consume config from the environment model
4. add the first validation pipeline and staging workflow

This is a substantial effort, but the target structure is clear and aligns with the rest of the repository's deployment model.
