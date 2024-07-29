# FAIMS 3 CDK Deployment

This CDK project includes AWS infrastructure as code to deploy FAIMS 3 and its associated components.

## Installation

With nvm

```
nvm install 20
nvm use 20
```

or if you have it installed already

```
npm i aws-cdk -g
npm i
```

Now follow the below steps to setup your configuration.

## Building artifacts

NPM is used to manage building some utility lambda functions separately to CDK process.

**Note**: These are intended to completely standalone from the monorepo in which this project lives.

To build the project

```
npm run build
```

To package for deployment.

```
npm run package
```

or just

```
npm run build && npm run package
```

This should build all the projects in `src`. If you add a new project, please update the `package.json` build scripts.

Use the existing packages as an example to start from, because the typescript config is very fussy.

## Configuration Setup

This project uses a JSON-based configuration system to manage different deployment settings. Here's how to set it up and use it:

### Creating Your Configuration

1. Navigate to the `configs/` directory in the project.
2. You'll find a file named `sample-config.json`. This is a template for your configuration.
3. Copy this file and rename it according to your environment (e.g., `development.json`, `production.json`).
4. Open your new configuration file and replace the placeholder values with your actual settings.

Example configuration structure:

```json
{
  "hostedZone": {
    "id": "your-hosted-zone-id",
    "name": "your-domain-name"
  },
  "certificates": {
    "primary": "your-primary-certificate-arn",
    "cloudfront": "your-cloudfront-certificate-arn"
  },
  "aws": {
    "account": "your-aws-account-id",
    "region": "your-aws-region"
  },
  "secrets": {
    "privateKey": "your-private-key-secret-arn",
    "publicKey": "your-public-key-secret-arn"
  }
}
```

Note: The values provided above are examples. Replace them with your actual values.

Here's a breakdown of each configuration value and its purpose:

- hostedZone - used for deploying route 53 routes in AWS
  - id: The ID of your Route 53 hosted zone
  - name: The domain name of your hosted zone
- certificates
  - primary: ARN of your primary ACM certificate (must support \*.base.domain)
  - cloudfront: ARN of your CloudFront ACM certificate (must be in us-east-1) (must support \*.base.domain)
- aws
  - account: Your AWS account ID
  - region: The AWS region for deployment (e.g., ap-southeast-2 for Sydney) - defaults to ap-southeast-2
- secrets
  - privateKey: ARN of your private key in Secrets Manager
  - publicKey: ARN of your public key in Secrets Manager

### Using Your Configuration

To use a specific configuration when deploying or synthesizing your CDK stack:

1. Open a terminal and navigate to your project directory.
2. Set the `CONFIG_FILE_NAME` environment variable to the name of your configuration file.
3. Run your CDK command.

For example, to deploy using a `production.json` configuration:

```bash
CONFIG_FILE_NAME=production.json cdk deploy
```

Or to synthesize using a `development.json` configuration:

```bash
CONFIG_FILE_NAME=development.json cdk synth
```

### Switching Between Configurations

You can easily switch between different configurations by changing the `CONFIG_FILE_NAME`:

- For development: `CONFIG_FILE_NAME=development.json`
- For production: `CONFIG_FILE_NAME=production.json`
- For any other environment: `CONFIG_FILE_NAME=your-config-file-name.json`

### Configuration File Location

All configuration files should be placed in the `configs/` directory of the project.

These are automatically git ignored.

### Generating Keys and Setting ARNs

This project includes a script to generate RSA key pairs and store them in AWS Secrets Manager. Follow these steps to generate keys and set the ARNs in your configuration:

1. Locate the script at `scripts/genKeysAWS.sh` in your project directory.

2. Run the script with the following command:

   ```bash
   ./scripts/genKeysAWS.sh <host_target> [profile_name] [--replace]
   ```

   - `<host_target>`: The name of the host (e.g., dev, prod).
   - `[profile_name]`: (Optional) The name of the profile to generate keys. Default is 'default'.
   - `[--replace]`: (Optional) Flag to replace existing secrets instead of aborting.

3. The script will generate RSA key pairs and store them in AWS Secrets Manager. It will output the ARNs for both the public and private key secrets.

4. Copy the ARNs provided in the script output.

5. Update your configuration file (e.g., `configs/development.json` or `configs/production.json`) with the new ARNs:

   ```json
   {
     ...
     "secrets": {
       "privateKey": "arn:aws:secretsmanager:region:account-id:secret:dev-keys-host-profile-private-xxxx",
       "publicKey": "arn:aws:secretsmanager:region:account-id:secret:dev-keys-host-profile-public-xxxx"
     }
   }
   ```

6. Replace the placeholder ARNs with the actual ARNs output by the script.

This process ensures that your CDK stack uses the correct, securely stored keys for JWT signing and validation.

Remember to run this script and update your configuration whenever you need to rotate keys or set up a new environment.

### CDK Context File (cdk.context.json)

**If you have an existing deployment**.

The `cdk.context.json` file is used by CDK to cache context values, which can include information about your AWS environment. This file is automatically generated and updated by CDK.

Important notes about `cdk.context.json`:

1. This file is gitignored to prevent committing potentially sensitive information.
2. If you have an existing deployment, you should include this file in your work environment.
3. Do not share this file publicly, as it may contain sensitive information about your AWS resources.

Managing `cdk.context.json`:

- For personal use: Keep the file locally and do not commit it to version control.
- For team use: Consider storing file in a private repository or a secure shared location.

To use an existing `cdk.context.json`:

1. Obtain the `cdk.context.json` file from your existing deployment or secure storage.
2. Place it in the root directory of this CDK project.
3. CDK will automatically use this file for context lookups.

If you need to refresh the context, you can delete the file and run `cdk synth` to regenerate it.

### Security Note

Your configuration files may contain sensitive information. Do not commit these files to version control. They are already added to `.gitignore` for your protection.

### Troubleshooting

- If you encounter an error about missing or invalid configuration, ensure that:
  1. Your configuration file exists in the `configs/` directory.
  2. The file name matches what you specified in `CONFIG_FILE_NAME`.
  3. The JSON in your configuration file is valid and contains all required fields.

By following these steps, you can easily manage different configurations for various deployment environments in this project.

## Deploying CDK app

Ensure you have sufficient permissions for the target account and that they are available to the CLI e.g. `aws sts get-caller-identity`.

Then follow the above steps to

- build the package artifacts `npm run build && npm run package`
- generate your keys i.e. `./scripts/genKeysAWS.sh <host_target> [profile_name] [--replace]`
- setup your config
  - download your config from private repo, put in `configs`, `export CONFIG_FILE_NAME=dev.json` for example
  - setup your `cdk.context.json` - put in this folder
- run appropriate cdk command
  - to synth only `cdk synth`
  - to diff `cdk diff`
  - to deploy or update `cdk deploy`

## Initialising DBs on first launch

The DBs are now initialised using a combination of

- EC2 user data on startup
- Conductor initialise route `/api/initialise`

The first is automatic, the second requires calling this endpoint, simply

```
curl -X POST https://your-conductor-endpoint.com/api/initialise
```

will suffice.

This

- establishes databases and configuration for them
- sets the public key for the database

This operation is a "no-op" if already setup.
