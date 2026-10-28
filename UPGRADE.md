# Upgrades/Migrations

This document will describe the necessary steps to migrate existing deployments through versions of FAIMS.

## Config consolidation: `NEW_CONDUCTOR_URL`, `web` env renames, and two-file AWS CDK config

### Conductor API (`NEW_CONDUCTOR_URL` removed)

The `NEW_CONDUCTOR_URL` environment variable is no longer used by the Conductor/api. It carried the Control Centre (web) URL, which is already provided to the server via `REDIRECT_WHITELIST` (used for both auth redirects and the browser CORS allowlist).

- Remove `NEW_CONDUCTOR_URL` from any conductor/api build configuration.
- Ensure the Control Centre URL is present in `REDIRECT_WHITELIST` (the aws-cdk IaC already includes it).

### Control Centre (`web`) environment variable renames

The Control Centre (`web`) now shares the same env variable names as the mobile app (`app`) via `@faims3/build-config`:

- Rename `VITE_APP_THEME` to `VITE_THEME`.
- Rename `VITE_BUGSNAG_API_KEY` to `VITE_BUGSNAG_KEY`.

### AWS CDK two-file configuration (`core.json` + `aws.json`)

The single-file AWS CDK config (`infrastructure/aws-cdk/configs/<name>.json` loaded via `CONFIG_FILE_NAME`) has been replaced by the shared two-file layout (`core.json` + `aws.json` loaded via `CONFIG_ENV` or `CONFIG_DIR`).

To migrate an existing single-file CDK config into `core.json`, `secrets.json`, and `aws.json`:

```bash
pnpm --filter=@faims3/build-config run migrate-aws --config path/to/old-config.json --out-dir config/<env>
```

### GitHub Actions

CDK CI no longer uses `CONFIG_FILE_NAME`. Every deploy/validate/mobile workflow now takes a GitHub Environment dropdown (`dev`, `prod`, `stage`). Create those three Environments and put the config-targeting settings **on each Environment** (not as repo-wide values) so you can swap deployment configs independently. Rename any existing `CDK_*` / `APP_CONFIG_*` / `MOBILE_CONFIG_*` settings to:

| Setting              | Type     | Purpose                                                                                    |
| -------------------- | -------- | ------------------------------------------------------------------------------------------ |
| `GIT_AUTHORIZATION`  | Secret   | Token with read access to the private config repo (and Fastlane git auth)                  |
| `CONFIG_REPO_SLUG`   | Variable | Config repo slug (`owner/repo`)                                                            |
| `CONFIG_ENVIRONMENT` | Variable | Required. Config-repo folder name this GitHub Environment maps to (e.g. `prod`, `nightly`) |
| `CONFIG_BRANCH`      | Variable | Optional; defaults to `main`                                                               |
| `CONFIG_REPO_PATH`   | Variable | Optional base path in the config repo; defaults to `configs`                               |

CDK-only (not used by `validate-config` or mobile):

| Setting              | Type     | Purpose                                                      |
| -------------------- | -------- | ------------------------------------------------------------ |
| `DEPLOY_GA_ROLE_ARN` | Variable | IAM role for CDK deploy (OIDC). Was `CDK_DEPLOY_GA_ROLE_ARN` |

Mobile-only, also per Environment: `secrets.SOPS_AGE_KEY`, optionally `vars.FASTLANE_REPO_SLUG`. Need more than `dev`/`prod`/`stage`? Fork and add another choice + Environment.

Scheduled workflows do **not** default an Environment. Set these **repository** (global) variables to the GitHub Environment name the cron should use:

| Setting                                | Workflow                   |
| -------------------------------------- | -------------------------- |
| `SCHEDULED_ANDROID_ENVIRONMENT`        | Nightly Android            |
| `SCHEDULED_IOS_TESTFLIGHT_ENVIRONMENT` | iOS TestFlight (scheduled) |

The env folder must contain `core.json` + `aws.json` (plus optional `secrets.enc.json` for mobile). `validate-config` needs no AWS credentials — it only checks that the config repo is reachable and the files parse.

### `@faims3/data-model` `configHelpers` removed

The `configHelpers` export (and `library/data-model/src/config/*`) has moved to `@faims3/build-config`. Import `parseApiEnv` / `parseAppEnv` / `parseWebEnv` / `parseDesignerEnv` (or `parseBuildConfig`) from `@faims3/build-config` instead of `import {configHelpers} from '@faims3/data-model'`.

## [feat: admin forgot password reset workflow](https://github.com/FAIMS/FAIMS3/pull/1334)

### CouchDB migration

This functionality will not work until you apply the following migration

- setup pnpm env cd /api && pnpm i
- run the migrate action `pnpm run migrate`
- Try generating a code and make sure the workflow is functional.

**Note** If you are running inside a container, then the above command needs to be
run in the container rather than from your local environment:

```bash
docker compose exec conductor pnpm run migrate
```

### Deployment configuration

Add the new `NEW_CONDUCTOR_URL` environment variable to the conductor/api build. This is already done in the aws-cdk IaC - however in existing deployments you may need to update your build configuration.

This variable was later removed; see [Config consolidation](#config-consolidation-new_conductor_url-web-env-renames-and-two-file-aws-cdk-config) above.

**Note** ensure this includes the https:// prefix!

This is a mandatory property and not including it will break the deployment.

## [feat: permissions, db, migrations overhaul](https://github.com/FAIMS/FAIMS3/pull/1380)

After deployment, the system will likely not function until the DB migration is run. To run the migration:

### Setup your environment

- ensure your environment is updated/installed - I'd recommend a cleanse and then rebuild e.g. from `FAIMS3` root of repo `./scripts/purge.sh . && pnpm i && npx turbo build```
- setup a working local dev environment for `api`
- ensure the `.env` of your API is accurately configured for the target deployment (being careful of secrets here)

### Run the migration command

- run the migration command `pnpm run migrate`

**Note** If you are running inside a container, then the above command needs to be
run in the container rather than from your local environment:

```bash
docker compose exec conductor pnpm run migrate
```

You should see output indicating that a) the invites DB has been migrated without errors b) the people DB has been migrated without errors. If either fails, login to your couchDB and interrogate the migration DB logs.

### Force the migration to run

If needed, you can login to your `/_utils` fauxton instance of CouchDB, then navigate to the Migrations DB.
Find the migration document for the target DB, and update the `version` field to reflect what
you want the migration system to think the database version is.
