import * as fs from 'fs';
import * as path from 'path';
import {ConfigSchema, Config} from './lib/faims-infra-stack';
import {ZodError} from 'zod';
import {exit} from 'process';

function validateConfig(configPath: string): boolean {
  try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    const config: Config = JSON.parse(configContent);

    ConfigSchema.parse(config);
    console.log('Configuration is valid.');
    return true;
  } catch (error) {
    if (error instanceof ZodError) {
      console.error('Configuration validation failed:');
      error.errors.forEach(err => {
        console.error(`- ${err.path.join('.')}: ${err.message}`);
      });
    } else if (error instanceof Error) {
      console.error('Error validating configuration:', error.message);
    } else {
      console.error('An unknown error occurred during validation');
    }
    return false;
  }
}

// Get the CONFIG_FILE_NAME from environment variable
const configFileName = process.env.CONFIG_FILE_NAME;
if (!configFileName) {
  console.error(
    'Please provide a config file name with CONFIG_FILE_NAME env variable. E.g. export CONFIG_FILE_NAME=dev.json.'
  );
  exit(1);
}
const configPath = path.resolve(__dirname, 'configs', configFileName);

if (validateConfig(configPath)) {
  process.exitCode = 0;
} else {
  process.exitCode = 1;
  throw new Error(`Invalid Configuration file at ${configPath}`);
}
