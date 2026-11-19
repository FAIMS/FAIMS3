# DigitalOcean sample config

This directory is a starting point for the DigitalOcean deployment configuration layout.

The long-term goal is to follow the same pattern used by the AWS deployment path:

- `core.json` holds shared, non-secret deployment/runtime configuration,
  including the canonical `domains.base` and service hostnames
- `do.json` holds DigitalOcean-only resource settings
- `secrets.enc.json` is optional and encrypted via SOPS for secret overlays
- config is pulled into a local mirror under `config/<environment>/` via `scripts/sync-deployment-config.sh`

The files in this directory are intentionally illustrative placeholders rather than a production-ready deployment. Replace the example values with the actual environment values for your deployment before using them in a real environment.

Suggested local layout:

```text
config/
  dev/
    core.json
    do.json
    secrets.enc.json
  staging/
    core.json
    do.json
    secrets.enc.json
  prod/
    core.json
    do.json
    secrets.enc.json
```

This is the config structure we need to migrate the DigitalOcean deployment toward.
