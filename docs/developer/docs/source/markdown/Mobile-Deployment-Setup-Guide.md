# Mobile Deployment Setup Guide

This is the practical workflow for setting up the first mobile deployment using the shared configuration repository model.

The model we are using is:

- The app code repository owns the build logic and workflow definitions.
- A private **config** repository stores the deployment config. Each environment is a
  folder under `<config-path>/<environment>/` (path defaults to `mobile/`).
- The **Fastlane Match** signing assets live in their own repository — or in the same
  repo as the config if you prefer. Keep them separate so routine config edits can't
  disturb signing state.
- The config repo is checked out by the workflow using `vars.APP_CONFIG_REPO_SLUG`
  (path `vars.APP_CONFIG_REPO_PATH`, default `mobile`). The Match repo is
  `vars.FASTLANE_REPO_SLUG` (unset = same repo as the config).
- Secrets are decrypted at runtime with `secrets.SOPS_AGE_KEY` and then merged into the generated env.

This guide covers the first-time setup and the workflow you can repeat for additional environments.

The config files are **shared**: the same `core.json` also drives the [AWS CDK deployment](DeployingAWSStack.md) and [local development](Build-Configuration.md#local-development). See the [Build Configuration](Build-Configuration.md) page for the JSON structure every platform consumes; this guide focuses on the mobile CI deployment workflow.

## 1. Set up SOPS for secret encryption

SOPS is used to manage encrypted secrets within the JSON configuration file. We
use the 'age' encryption scheme and you will need to have an encryption key
in place to make this work. You will need to install both `sops` and `age` (both
available via homebrew on MacOS). To generate a key, use `age-keygen`:

```bash
$ age-keygen -o key.txt
Public key: ageNNNNNNNNNNNN
```

This will create `key.txt` that contains the public key printed above and the
age key which you will use below (`SOPS_AGE_KEY`). To use sop locally, you need
to tell it where to find this file, set an environment variable `SOPS_AGE_KEY_FILE`
to point to the location of this file.

You will also need to tell sops which public key to use for encryption. The
easiest way to do this is to create a file `.sops.yaml` in the repository root which
specifies that you want to use age to encrypt data and the age public key
identity you want to use:

```text
creation_rules:
  - age: ageNNNNNNNNNNNN
```

## 2. Decide where to keep your local working config

Keep a local working copy of your deployment configuration in the repo tree for
convenience and as the source of truth for your deployments.

Recommended pattern:

```text
config/
  production/
    core.json
    secrets.json
  nightly/
    core.json
    secrets.json
```

Why this is a good place:

- It is close to the repo root and easy to find.
- It is clearly not part of the app build itself.
- It is easy to exclude from git if you want to keep it private locally.
- It serves as the source of truth for your deployment configuration.
- It matches the target structure in the private repo: `mobile/<environment>/...`

The `sync-deployment-config.sh` script treats the local `config/<environment>/`
directory as the source of truth, so any changes you make here will be synced to
the private repo.

The names of the two sub-directories are used as 'environment slugs' in the workflows.
`nightly` is used for nightly test builds, `production` is
used for production builds. You can keep different configurations in each set of
build config files.

The config folder has been added to `.gitignore` to prevent accidental commits
of secrets to the app repository:

```text
/config
```

## 3. Configure the build

You need to create versions of core.json and secrets.json for each
environment.

### core.json

This is the non-secret config for that environment.

Use the shared schema defined by `library/build-config/src/build-config.ts` and
the sample structure in `library/build-config/config/mobile-config.sample.json`
as your starting point. The [Build Configuration](Build-Configuration.md) page
documents every field.

Typical values include:

- app name / bundle identifier / URLs
- iOS App Store Connect IDs
- Android deploy track/release status
- app metadata and map settings
- any non-secret build variables required by the build pipeline

### secrets.json

This is the local working copy of the encrypted secret bundle. It will be merged
into the private repo and then SOPS-encrypted.

It contains entries like:

- Android keystore/base64 data
- Google Play service account JSON/base64 data
- iOS Match password
- Apple API key material
- any other secret values that should not sit in plain-text GitHub variables

Do not commit this file to the app repo. It should only exist locally while you
prepare and sync it to the private config repo.

## 4. Fill in the values

Use the [Build Configuration](Build-Configuration.md) page as the reference for the
JSON structure and the meaning of each field. The JSON is the source of truth; the
generated env var names are derived by the shared contract and do not need to be
managed by hand.

A good first pass is:

- start with one environment only: `production`
- add the minimum values for the relevant workflow(s)
- verify that the generated env matches what the workflow expects
- then duplicate the pattern for `nightly` or other environments

## 5. Create or clone the config (and Match) repositories

You need a private **config** repository that stores:

- `<config-path>/<environment>/core.json`
- `<config-path>/<environment>/secrets.enc.json`

where `<config-path>` defaults to `mobile/`.

Optionally you also need a separate private **Match** repository for the Fastlane
Match signing assets (certificates and provisioning profiles). You can keep the Match
assets in the config repo too — but keeping them separate means routine config edits
can't accidentally disturb the signing state (and vice versa).

- If the config and Match repos are the same, set only `APP_CONFIG_REPO_SLUG` (Match
  falls back to it).
- If they are separate, also set `FASTLANE_REPO_SLUG` to the Match repo.

If you do not have the config repo yet:

1. Create a new private GitHub repository.
2. Add the `<config-path>/` directory structure (e.g. `mobile/`).
3. Configure SOPS / age so the repo can decrypt and encrypt JSON files.
4. Add the repo slug to GitHub Actions as `vars.APP_CONFIG_REPO_SLUG` (and
   `vars.APP_CONFIG_REPO_PATH` if the path is not `mobile`).

Example slug:

```text
my-org/mobile-config
```

This is the value used in the workflow, not the full HTTPS URL.

## 6. Sync the local config files into the private repo

The helper script is designed to manage both `core.json` and `secrets.json` files:

```bash
./scripts/sync-deployment-config.sh push <environment> [options]
```

The script treats your local `config/<environment>/` directory as the source of truth.

First sync with a new repo URL:

```bash
./scripts/sync-deployment-config.sh push production \
  --config_repo git@github.com:my-org/mobile-config.git
```

Or, if the repo is already cloned locally:

```bash
./scripts/sync-deployment-config.sh push production \
  --repo-path /path/to/mobile-config
```

### What the script does

1. Validates both local `core.json` and `secrets.json` exist and are valid JSON
2. Connects to the private repo and fetches the latest version
3. Compares your local files with the remote versions
4. If files have changed:
   - Encrypts `secrets.json` with SOPS
   - Copies `core.json` to the remote repo
   - Commits and pushes both files together
5. Updates the local cache copies (`secrets.enc.json`)

### Usage options

- `--branch <name>` — specify the branch to push to (default: `main`)
- `--message <text>` — custom commit message (default: "update mobile config for
  <environment>")
- `--force` — skip confirmation prompts

### Example workflow

```bash
# Edit your local files
vim config/production/core.json
vim config/production/secrets.json

# Sync changes to the private repo (with confirmation prompt)
./scripts/sync-deployment-config.sh push production \
  --config_repo git@github.com:my-org/mobile-config.git

# Or force-push without confirmation
./scripts/sync-deployment-config.sh push production \
  --config_repo git@github.com:my-org/mobile-config.git \
  --force
```

### Important notes

- The script requires both `core.json` and `secrets.json` to exist in `config/<environment>/`
- The repo must be available to `sops` via the expected key mechanism (`SOPS_AGE_KEY`, `SOPS_AGE_KEY_FILE`, or local age config)
- The script only pushes if at least one file has actually changed
- Both files are committed together in a single commit

## 7. Pulling remote config changes locally

To pull the latest configuration from the private repo back into your local `config/` directory:

```bash
./scripts/sync-deployment-config.sh pull production \
  --config_repo git@github.com:my-org/mobile-config.git
```

This will:

1. Clone or update the private repo
2. Decrypt `secrets.enc.json` to `secrets.json`
3. Mirror both files into your local `config/production/` directory

Use this command when you need to sync remote changes (for example, if another team member has pushed config updates).

## 8. Register the environment in GitHub Actions

Set the `SOPS_AGE_KEY` repository secret to your key value (find this in keys.txt
generated earlier).

Set the following repository variables for the workflow to discover the environment:

- `APP_CONFIG_REPO_SLUG` — the config repo
- `MOBILE_CONFIG_ENVIRONMENT` — the environment folder name
- optionally `APP_CONFIG_REPO_PATH` — the base path within the config repo (default `mobile`)
- optionally `MOBILE_CONFIG_BRANCH` if you are not using `main`
- optionally `FASTLANE_REPO_SLUG` — the Match repo, if it is different from the config repo

Example:

```text
APP_CONFIG_REPO_SLUG = my-org/mobile-config
MOBILE_CONFIG_BRANCH = main
```

For a separate Match repo, add:

```text
FASTLANE_REPO_SLUG = my-org/mobile-match
```

The workflow will then read:

```text
config_repo/<config-path>/<environment>/core.json
config_repo/<config-path>/<environment>/secrets.enc.json
```

and use these to generate the build environment (and, for iOS, point Match at
`https://github.com/<FASTLANE_REPO_SLUG or APP_CONFIG_REPO_SLUG>.git`).

## 9. Validate the first environment before full release

Before using a production config in a real release workflow, run through a minimal validation:

1. Ensure both `config/production/core.json` and `config/production/secrets.json` exist locally.
2. Verify both JSON files are valid by running: `jq empty config/production/*.json`
3. Ensure the private repo is decryptable locally with your SOPS setup.
4. Run the sync script to publish both files: `./scripts/sync-deployment-config.sh push production --config_repo <url>`
5. Verify files exist in the private repo at `mobile/production/core.json` and `mobile/production/secrets.enc.json`
6. Confirm the workflow can read the files.
7. Trigger the non-production workflow first if there is a test/nightly build path.

This is especially useful for the first run because it catches mismatched
environment slugs, missing values, secret layout mistakes, and JSON validation
errors before the production lane is used.
