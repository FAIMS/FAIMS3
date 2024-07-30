#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { HostedZoneAttributes } from "aws-cdk-lib/aws-route53";
import { FaimsInfraStack } from "../lib/faims-infra-stack";
import { loadConfig } from "../configs/config-class";
import * as path from "path";

// Read the config file path from the environment variable
const configFileName = process.env.CONFIG_FILE_NAME;
if (!configFileName) {
  throw new Error("CONFIG_FILE_NAME environment variable is not set");
}

const configFilePath = path.resolve(__dirname, "../configs", configFileName);

// Load and validate the configuration
const config = loadConfig(configFilePath);

const app = new cdk.App();

// Set up hosted zone attributes
const zoneAttributes: HostedZoneAttributes = {
  hostedZoneId: config.hostedZone.id,
  zoneName: config.hostedZone.name,
};

// Create the stack
new FaimsInfraStack(app, "FaimsInfraStack", {
  env: {
    account: config.aws.account,
    region: config.aws.region,
  },
  hzAttributes: zoneAttributes,
  primaryCertArn: config.certificates.primary,
  cloudfrontCertArn: config.certificates.cloudfront,
  privateKeySecretArn: config.secrets.privateKey,
  publicKeySecretArn: config.secrets.publicKey,
  backupVaultName: config.backup.vaultName,
  existingBackupVaultArn: config.backup.vaultArn,
  scheduleExpression: config.backup.scheduleExpression,
  backupRetentionDays: config.backup.retentionDays,
});
