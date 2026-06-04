import 'source-map-support/register';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as cdk from 'aws-cdk-lib';
import {loadLoadTestInfraConfig} from '../lib/config';
import {LoadTestStack} from '../lib/load-test-stack';

dotenv.config({path: path.join(__dirname, '../.env')});

const config = loadLoadTestInfraConfig();

const app = new cdk.App();

new LoadTestStack(app, config.STACK_NAME, {
  env: {
    account: config.AWS_ACCOUNT_ID,
    region: config.AWS_REGION,
  },
  config,
  description: 'DASS load testing - ECS task definitions + metrics EC2',
});

app.synth();
