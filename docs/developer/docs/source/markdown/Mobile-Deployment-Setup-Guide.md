# Mobile Deployment Setup Guide

This is the practical workflow for setting up the first mobile deployment using the shared configuration repository model.

The model we are using is:

- The app code repository owns the build logic and workflow definitions.
- A separate private repository stores the mobile deployment config and Fastlane Match assets.
- Each deployment environment is represented by a folder under `mobile/<environment>/` in that private repo.
- The repo is checked out by the workflow using `vars.APP_CONFIG_REPO_SLUG`.
- Secrets are decrypted at runtime with `secrets.SOPS_AGE_KEY` and then merged into the generated env.

This guide covers the first-time setup and the workflow you can repeat for additional environments.

## 1. Decide where to keep your local working config

Keep a local working draft outside the tracked app source, but inside the repo tree for convenience.

Recommended pattern:

```text
config/
  mobile-local/
    production/
      build-config.json
      build-secrets.json
    nightly/
      build-config.json
      build-secrets.json
```

Why this is a good place:

- It is close to the repo root and easy to find.
- It is clearly not part of the app build itself.
- It is easy to exclude from git if you want a local-only scratch area.
- It matches the eventual target structure in the private repo: `mobile/<environment>/...`

If you prefer, you can keep the local draft somewhere else entirely (for example in your home directory or in a separate working folder), but the repo-local `config/mobile-local/` approach is the easiest to understand and maintain.

Add the folder to `.gitignore` if you do not want to commit the local draft files.

## 2. Decide on the environment slug

The environment slug is the value in `mobile/<environment>/...` and is also used by the workflow variable `vars.MOBILE_CONFIG_ENVIRONMENT`.

This should reflect deployment intent rather than a branch name.

Recommended naming for initial setup:

- `production` for production App Store / Play deployments
- `nightly` for the nightly test build workflow
- `testflight` if you want a separate TestFlight-specific config set
- `staging` or `qa` for future non-production validation builds

Recommended design rule:

- one environment slug = one deployment target
- one deployment target = one config folder + one secret bundle
- use stable names; do not create one-off values for every workflow run

For example:

- `production` => production iOS + production Android builds
- `nightly` => nightly test build flows

This keeps the workflow variable and the config repo structure aligned.

## 3. Create the local config files

Begin with a local file for the environment you are setting up.

Example layout:

```text
config/mobile-local/production/
  build-config.json
  build-secrets.json
```

### build-config.json

This is the non-secret config for that environment.

Use the shared schema defined by `library/build-config/src/build-config.ts` and the sample structure in `library/build-config/config/mobile-secrets.sample.json` as your starting point.

Typical values include:

- app name / bundle identifier / URLs
- iOS App Store Connect IDs
- Android deploy track/release status
- app metadata and map settings
- any non-secret build variables required by the build pipeline

### build-secrets.json

This is the local working copy of the encrypted secret bundle. It will be merged into the private repo and then SOPS-encrypted.

It contains entries like:

- Android keystore/base64 data
- Google Play service account JSON/base64 data
- iOS Match password
- Apple API key material
- BrowserStack credentials
- any other secret values that should not sit in plain-text GitHub variables

Do not commit this file to the app repo. It should only exist locally while you prepare and sync it to the private config repo.

## 4. Fill in the values

Use the field map in [Mobile-Build-Config-Env-Mapping.md](Mobile-Build-Config-Env-Mapping.md) as the authoritative reference for which JSON fields become which generated environment variables.

A good first pass is:

- start with one environment only: `production`
- add the minimum values for the relevant workflow(s)
- verify that the generated env matches what the workflow expects
- then duplicate the pattern for `nightly` or other environments

## 5. Create or clone the private config repository

You need a private repo that stores:

- `mobile/<environment>/build-config.json`
- `mobile/<environment>/build-secrets.enc.json`
- optionally any Match files / certs / profiles created by Fastlane Match

This repo is the same repo used for Fastlane Match signing assets. That means the repository has two jobs:

- store the app deployment config
- store the app signing material used by Fastlane Match

This is why it is important to keep config edits separated from signing-management changes and why `APP_CONFIG_REPO_SLUG` is the canonical repo pointer.

If you do not have the repo yet:

1. Create a new private GitHub repository.
2. Add the `mobile/` directory structure.
3. Configure SOPS / age so the repo can decrypt and encrypt JSON files.
4. Add the repo slug to GitHub Actions as `vars.APP_CONFIG_REPO_SLUG`.

Example slug:

```text
my-org/mobile-config
```

This is the value used in the workflow, not the full HTTPS URL.

## 6. Sync the local secret bundle into the private repo

The helper script is designed for this exact purpose:

```bash
./scripts/sync-deployment-config.sh <environment> <local_secrets_file> [options]
```

Example:

```bash
./scripts/sync-deployment-config.sh \
  production \
  config/mobile-local/production/build-secrets.json \
  --config_repo git@github.com:my-org/mobile-config.git \
  --branch main \
  --target mobile/production/build-secrets.enc.json
```

Or, if the repo is already cloned locally:

```bash
./scripts/sync-deployment-config.sh \
  production \
  config/mobile-local/production/build-secrets.json \
  --repo-path /path/to/mobile-config \
  --branch main \
  --target mobile/production/build-secrets.enc.json
```

What the script does:

- validates the local JSON file
- ensures the target repo path is present
- tries to decrypt the existing target if it exists
- merges the new values with the existing encrypted file
- re-encrypts the merged result with SOPS
- commits and pushes the change to the selected branch

Important: the script expects the local file to be valid JSON and the repo to be available to `sops` via the expected key mechanism (`SOPS_AGE_KEY`, `SOPS_AGE_KEY_FILE`, or local age config).

## 7. Create the non-secret config file in the private repo

The non-secret config file is not pushed by the helper script; it is part of the repository contents.

Create:

```text
mobile/production/build-config.json
```

with the environment-specific values that should be versioned and reviewed.

This file should reflect the final build configuration for that environment, while the `build-secrets.enc.json` file carries values that must stay encrypted.

## 8. Register the environment in GitHub Actions

Set the following repository variables for the workflow to discover the environment:

- `APP_CONFIG_REPO_SLUG`
- `MOBILE_CONFIG_ENVIRONMENT`
- optionally `MOBILE_CONFIG_BRANCH` if you are not using `main`

Example:

```text
APP_CONFIG_REPO_SLUG = my-org/mobile-config
MOBILE_CONFIG_ENVIRONMENT = production
MOBILE_CONFIG_BRANCH = main
```

For nightly builds:

```text
APP_CONFIG_REPO_SLUG = my-org/mobile-config
MOBILE_CONFIG_ENVIRONMENT = nightly
MOBILE_CONFIG_BRANCH = main
```

The workflow will then read:

```text
config_repo/mobile/${MOBILE_CONFIG_ENVIRONMENT}/build-config.json
config_repo/mobile/${MOBILE_CONFIG_ENVIRONMENT}/build-secrets.enc.json
```

## 9. Validate the first environment before full release

Before using a production config in a real release workflow, run through a minimal validation:

1. Check the generated config directory exists in the private repo.
2. Verify the JSON is valid.
3. Ensure the repo is decryptable locally with your SOPS setup.
4. Run the sync script once to publish the secret bundle.
5. Confirm the workflow can read the files.
6. Trigger the non-production workflow first if there is a test/nightly build path.

This is especially useful for the first run because it catches mismatched environment slugs, missing values, and secret layout mistakes before the production lane is used.

## 10. Recommended first-time rollout plan

For the first deployment, this is the safest sequence:

1. Create `production` config and secret bundle.
2. Validate Android `production` path.
3. Validate iOS `production` path.
4. Create `nightly` config bundle next.
5. Run the nightly/test workflow once.
6. Only then treat the production workflow as the main release path.

This keeps the private repo stable and makes it clear which environment is assigned to which build lane.

## 11. Suggested naming policy

The environment name should match the deployment intent and workflow target, not the branch or a random local label.

Good examples:

- `production`
- `nightly`
- `testflight`
- `staging`

Avoid:

- ad-hoc names like `fred-test-4`
- names tied to a single engineer or machine
- names that do not map to a workflow lane

## 12. Final recommendation

For the first pass, use:

- `production` for production workflows
- `nightly` for the nightly test build workflow

This gives you a clean, predictable mapping between:

- workflow target
- GitHub variable `MOBILE_CONFIG_ENVIRONMENT`
- repo path `mobile/<environment>/...`
- secrets bundle in the private config repository

You can add more environments later without changing the structure. The important part is to keep the naming stable and workflow-driven.
