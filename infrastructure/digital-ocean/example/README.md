# FAIMS3 Digital Ocean Deployment

The example root is deliberately thin: it accepts `config_dir`,
`do_token`, and optional registry credentials, then delegates resource
coordination to `modules/deployment`. That module owns core/DO config parsing,
domain derivation, env generation, and wiring between the API, apps, CouchDB,
and documentation modules.

This folder contains the Terraform configuration for deploying FAIMS3 to Digital Ocean. When using this template:

1. Create a new private repository for your deployment
2. Copy this example folder to your new repository
3. Configure your Digital Ocean credentials
4. Run Terraform commands to deploy
5. Commit the resulting Terraform state files along with your code

## Prerequisites

- Digital Ocean account
- Terraform installed locally
- Digital Ocean API token

## Configuration

The deployment is driven by an explicit `config_dir` input. This must point at the environment folder that contains the canonical config files, for example:

```text
config/dev/core.json
config/dev/do.json
config/dev/secrets.enc.json   # optional SOPS-encrypted overlay
config/dev/do-secrets.enc.json # required SOPS-encrypted DigitalOcean backup secrets
```

No fixed fallback path is used. The example deployment is intentionally required to receive its config location as a Terraform input so every deployment remains explicit and reproducible.

The shared logic for generating application env values lives in the reusable module at `infrastructure/digital-ocean/modules/config`. It reads `core.json`, decrypts and merges `secrets.enc.json` via SOPS when present, and invokes the repo-wide `generate-build-config.ts` contract instead of hand-building a custom `.env` flow.

`do.json` remains a deployment/infrastructure input and is read by the root deployment to configure DigitalOcean-specific resources (region, instance sizing, storage, etc.), not to derive application env variables.

The Conductor image defaults to `GHCR/faims/faims3-api`. Override the optional
`conductor.image` object when deploying a fork or alternate registry:

```json
{
  "conductor": {
    "imageTag": "sha-abc1234",
    "instanceSize": "basic-m",
    "image": {
      "registryType": "GHCR",
      "registry": "your-organisation",
      "repository": "your-faims3-api"
    }
  }
}
```

The tag remains explicitly pinned and `latest` is rejected. Private third-party
images can use the existing `registry_credentials` Terraform input.

DigitalOcean-only secrets live separately in `do-secrets.enc.json`. The
deployment requires the backup credentials and a long-lived signing key pair
at `signingKeys.privateKey` and `signingKeys.publicKey`. Both signing keys are
base64-encoded PEM values: PKCS#8 for the private key and SPKI for the public
key. Generate them once per environment and do not rotate or regenerate them
during ordinary deploys.

Generate a new pair for a new environment with:

```bash
pnpm --filter=@faims3/infra-digital-ocean generate-signing-keys
```

This prints only a JSON `signingKeys` fragment; it does not write key material
to disk. Treat the terminal output as sensitive. Add that fragment to the
decrypted `do-secrets.enc.json` using SOPS:

```bash
sops config/staging/do-secrets.enc.json
```

Run the generator only when provisioning an environment for the first time.
Replacing an existing pair invalidates JWTs and can disrupt mobile sync until
CouchDB accepts the new public key and existing access tokens expire.

This file is decrypted by the dedicated `do-secrets` module and is never
merged into `core.json` or passed to `generate-build-config`. The API module
selects `KEY_SOURCE=ENV` and injects both signing-key values as DigitalOcean
App Platform secret environment variables.

For API deployment, that module now emits separate non-secret and secret env payloads. Secret keys are derived from values that come from `secrets.enc.json` and are sent to DigitalOcean App Platform with `type = "SECRET"`.

The API uses the public, load-balanced CouchDB URL for both
`COUCHDB_INTERNAL_URL` and `COUCHDB_PUBLIC_URL`. DigitalOcean App Platform
does not have private-network access to the CouchDB Droplet; its HTTPS request
terminates at the load balancer, which forwards HTTP to CouchDB on port 5984.
The API module therefore also sets the CouchDB and Conductor external ports to
443.

Deployment/runtime secrets should come from `secrets.enc.json` and be decrypted at deploy time via SOPS. The generated API env is loaded into DigitalOcean App Platform as `type = "SECRET"` entries. Terraform inputs should be limited to deployment credentials such as `do_token` (and registry auth if required), not a second source of app secrets.

## Deployment

Initialise Terraform:

```bash
terraform init
```

Review the deployment plan:

```bash
terraform plan
```

The plan exposes four generated-config outputs to support local verification:

- `generated_api_public_env`
- `generated_apps_public_env`
- `generated_api_secret_env_keys`
- `generated_apps_secret_env_keys`

Public values are shown in full. Secret values remain hidden; their generated
environment variable names are shown so the secret-overlay coverage can be
checked without printing credentials into terminal logs.

Deploy the infrastructure:

```bash
terraform apply
```

The deployment will show some output as the various resources are created. Once
complete, the configuration of the servers may take a little longer as they
run the scripts to install the required software. When this is complete you
should be able to access the server at the configured subdomain. If
the SUBDOMAIN setting in conductor.env is 'faims.example.com' then you
should be able to access couchdb at <http://db.faims.example.com> and
the conductor server at <https://conductor.faims.example.com>.

To login to the servers you can use the public key created earlier.

```bash
ssh -i assets/private_key.pem conductor@conductor.faims.example.com
```

## State Management

The Terraform state files (`.tfstate`) should be committed to this private
repository after deployment. This means that anyone with access to the repository
can manage the deployment - updating the servers, adding new servers, etc.

## Maintenance

If the main terraform modules (part of the FAIMS3 repository) are updated then
re-running `terraform plan` will show any changes that would be made to your infrastructure.
For example, if a newer version of the Conductor server docker container is available,
this would deploy an updated version of the container (destroying the current server
and creating a new one).

Data for CouchDB is stored on a volume which should not change even if the CouchDB droplet
is updated. However, backups before updating any infrastructure are recommended.

Remember to run terraform plan before any changes to review potential impacts to your infrastructure.
