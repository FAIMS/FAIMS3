import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {FaimsInfraStack} from '../lib/faims-infra-stack';
import * as path from 'path';
import {loadConfigFromEnv} from '../lib/config';

// The deployment config is the two shared files every platform uses —
// core.json (parsed by @faims3/build-config, shared invariants applied) +
// aws.json (AWS-only extension: ARNs, never secret values) — resolved from
// the environment by loadConfigFromEnv (CONFIG_ENV=<name> reads the local
// mirror at <repo-root>/config/<name>/ written by
// scripts/sync-deployment-config.sh; CONFIG_DIR points at any env folder,
// e.g. a config-repo checkout in CI; CORE_CONFIG_FILE + AWS_CONFIG_FILE
// address the two files directly).
const config = loadConfigFromEnv(path.resolve(__dirname, '..'));

const app = new cdk.App();

// Create the stack
new FaimsInfraStack(app, config.aws.stackName, {
  env: {
    account: config.aws.account,
    region: config.aws.region,
  },
  config,
});
