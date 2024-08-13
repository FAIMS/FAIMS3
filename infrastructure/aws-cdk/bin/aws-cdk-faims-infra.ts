#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {HostedZoneAttributes} from 'aws-cdk-lib/aws-route53';
import {FaimsInfraStack, loadConfig} from '../lib/faims-infra-stack';
import * as path from 'path';

// Read the config file path from the environment variable
const configFileName = process.env.CONFIG_FILE_NAME;
if (!configFileName) {
  throw new Error('CONFIG_FILE_NAME environment variable is not set');
}

const configFilePath = path.resolve(__dirname, '../configs', configFileName);

// Load and validate the configuration
const config = loadConfig(configFilePath);

const app = new cdk.App();

// Set up hosted zone attributes
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const zoneAttributes: HostedZoneAttributes = {
  hostedZoneId: config.hostedZone.id,
  zoneName: config.hostedZone.name,
};

// Create the stack
new FaimsInfraStack(app, config.stackName, {
  env: {
    account: config.aws.account,
    region: config.aws.region,
  },
  config,
});
