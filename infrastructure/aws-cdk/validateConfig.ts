import * as path from 'path';
import {ZodError} from 'zod';
import {exit} from 'process';
import {loadConfigFromEnv} from './lib/config';

// Validates the deployment config exactly as the CDK app will load it
// (core.json via @faims3/build-config + aws.json), using the same env
// resolution as bin/aws-cdk-faims-infra.ts. E.g.:
//   CONFIG_ENV=prod pnpm run validate-config
//   CONFIG_DIR=../../config-repo/configs/prod pnpm run validate-config
try {
  const config = loadConfigFromEnv(path.resolve(__dirname));
  console.log(
    `Configuration is valid. Stack: ${config.aws.stackName}, account: ${config.aws.account}, region: ${config.aws.region}.`
  );
  process.exitCode = 0;
} catch (error) {
  if (error instanceof ZodError) {
    console.error('Configuration validation failed:');
    error.issues.forEach(err => {
      console.error(`- ${err.path.join('.')}: ${err.message}`);
    });
  } else if (error instanceof Error) {
    console.error('Error validating configuration:', error.message);
  } else {
    console.error('An unknown error occurred during validation');
  }
  process.exitCode = 1;
  exit(1);
}
