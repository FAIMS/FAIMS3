// SPDX-License-Identifier: Apache-2.0
/**
 * Template assertions for the conductor Fargate service DesiredCount
 * wiring. When autoScaling.desiredCapacity is omitted, CDK must leave
 * DesiredCount off AWS::ECS::Service (DesiredCount: 1 is a failure).
 */
import * as cdk from 'aws-cdk-lib';
import {Template} from 'aws-cdk-lib/assertions';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sm from 'aws-cdk-lib/aws-secretsmanager';
import {parseBuildConfig} from '@faims3/build-config';
import {FaimsConductor} from '../lib/components/conductor';
import {FaimsNetworking} from '../lib/components/networking';
import {ConductorConfigSchema} from '../lib/config';

const autoScalingBase = {
  minCapacity: 1,
  maxCapacity: 5,
  targetCpuUtilization: 70,
  targetMemoryUtilization: 70,
  scaleInCooldown: 30,
  scaleOutCooldown: 30,
};

function conductorServiceProperties(
  desiredCapacity?: number
): Record<string, unknown> {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, 'ConductorServiceTestStack', {
    env: {account: '123456789012', region: 'ap-southeast-2'},
  });

  const certificate = acm.Certificate.fromCertificateArn(
    stack,
    'cert',
    'arn:aws:acm:ap-southeast-2:123456789012:certificate/abc'
  );
  const networking = new FaimsNetworking(stack, 'networking', {certificate});
  const hz = route53.HostedZone.fromHostedZoneAttributes(stack, 'hz', {
    hostedZoneId: 'Z123',
    zoneName: 'example.com',
  });
  const couchDbAdminSecret = new sm.Secret(stack, 'couch', {
    secretObjectValue: {
      username: cdk.SecretValue.unsafePlainText('admin'),
      password: cdk.SecretValue.unsafePlainText('password'),
    },
  });
  const cookieSecret = new sm.Secret(stack, 'cookie', {
    secretStringValue: cdk.SecretValue.unsafePlainText('cookie'),
  });
  const mapAssetBucket = new s3.Bucket(stack, 'maps');

  const config = ConductorConfigSchema.parse({
    conductorDockerImage: 'ghcr.io/faims/faims3-api',
    cpu: 256,
    memory: 512,
    autoScaling:
      desiredCapacity === undefined
        ? autoScalingBase
        : {...autoScalingBase, desiredCapacity},
  });

  new FaimsConductor(stack, 'conductor', {
    vpc: networking.vpc,
    sharedBalancer: networking.sharedBalancer,
    domainName: 'conductor.example.com',
    privateKeySecretArn:
      'arn:aws:secretsmanager:ap-southeast-2:123456789012:secret:private-key-AbCdEf',
    hz,
    certificate,
    couchDbAdminSecret,
    couchDBPort: 443,
    couchDBEndpoint: 'https://couch.example.com:443',
    webUrl: 'https://web.example.com',
    webAppPublicUrl: 'https://app.example.com',
    appId: 'org.example.app',
    config,
    coreConfig: parseBuildConfig({}),
    cookieSecret,
    smtpCredsArn:
      'arn:aws:secretsmanager:ap-southeast-2:123456789012:secret:smtp-AbCdEf',
    mapAssetBucket,
    localhostWhitelist: false,
  });

  const template = Template.fromStack(stack);
  const services = template.findResources('AWS::ECS::Service');
  expect(Object.keys(services)).toHaveLength(1);
  return Object.values(services)[0].Properties as Record<string, unknown>;
}

function expectUnchangedServiceDeployment(properties: Record<string, unknown>) {
  expect(properties.LaunchType).toBe('FARGATE');
  const deployment = properties.DeploymentConfiguration as {
    MinimumHealthyPercent?: number;
    MaximumPercent?: number;
    DeploymentCircuitBreaker?: {Enable?: boolean; Rollback?: boolean};
  };
  expect(deployment.MinimumHealthyPercent).toBe(100);
  expect(deployment.MaximumPercent).toBe(200);
  expect(deployment.DeploymentCircuitBreaker).toEqual({
    Enable: true,
    Rollback: true,
  });
}

describe('FaimsConductor ECS DesiredCount', () => {
  it('omits DesiredCount when autoScaling.desiredCapacity is unset', () => {
    const properties = conductorServiceProperties();
    expect(properties).not.toHaveProperty('DesiredCount');
    expectUnchangedServiceDeployment(properties);
  });

  it('emits DesiredCount equal to autoScaling.desiredCapacity when set', () => {
    const properties = conductorServiceProperties(2);
    expect(properties.DesiredCount).toBe(2);
    expectUnchangedServiceDeployment(properties);
  });
});
