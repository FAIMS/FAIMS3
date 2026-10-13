/**
 * Tests for the CDK config schema. The shared deployment config is validated
 * by @faims3/build-config (core slot); here we test the AWS-specific extension
 * (AwsConfigSchema) and the cross-slot provider rule in loadConfig. The
 * shared refines (maps/autosuggest keys, migrate/lock invariant) are covered
 * by the build-config test suite.
 */
import {ZodError} from 'zod';
import {
  AwsConfigSchema,
  ConductorConfigSchema,
  ConfigSchema,
} from '../lib/config';

const minimalAws = (overrides: Record<string, unknown> = {}) => ({
  stackName: 'faims-test',
  hostedZone: {id: 'Z123', name: 'example.com'},
  certificates: {primary: 'arn:cert:p', cloudfront: 'arn:cert:c'},
  account: '123456789012',
  region: 'ap-southeast-2',
  secrets: {privateKey: 'arn:sm:pk', publicKey: 'arn:sm:pubk'},
  smtpCredentialsSecretArn: 'arn:sm:smtp',
  couch: {
    volumeSize: 100,
    instanceType: 'm5.large',
  },
  backup: {vaultName: 'faims-backup'},
  conductor: {
    conductorDockerImage: 'ghcr.io/faims/faims3-api',
    cpu: 256,
    memory: 512,
    autoScaling: {
      desiredCapacity: 1,
      minCapacity: 1,
      maxCapacity: 2,
      targetCpuUtilization: 70,
      targetMemoryUtilization: 70,
      scaleInCooldown: 30,
      scaleOutCooldown: 30,
    },
  },
  domains: {baseDomain: 'example.com'},
  ...overrides,
});

describe('AwsConfigSchema', () => {
  it('parses a minimal aws config with defaults applied', () => {
    const parsed = AwsConfigSchema.parse(minimalAws());
    expect(parsed.stackName).toBe('faims-test');
    // ttlCleanup defaults to disabled
    expect(parsed.ttlCleanup?.enabled).toBe(false);
    // conductor defaults
    expect(parsed.conductor.conductorDockerImageTag).toBe('latest');
    expect(parsed.conductor.localhostWhitelist).toBe(false);
  });

  it('defaults region to ap-southeast-2 when omitted', () => {
    const {region: _ignored, ...rest} = minimalAws();
    expect(AwsConfigSchema.parse(rest).region).toBe('ap-southeast-2');
  });

  it('accepts an explicit authProviders (enabled list + secret ARN)', () => {
    const parsed = AwsConfigSchema.parse(
      minimalAws({
        authProviders: {providers: ['google'], secretArn: 'arn:sm:auth'},
      })
    );
    expect(parsed.authProviders?.providers).toEqual(['google']);
    expect(parsed.authProviders?.secretArn).toBe('arn:sm:auth');
  });
});

describe('ConductorConfigSchema is AWS-only', () => {
  it('rejects shared fields that moved to core', () => {
    // `name` is no longer on the conductor config; it lives in core.branding.
    expect(() =>
      ConductorConfigSchema.parse({
        conductorDockerImage: 'x',
        cpu: 256,
        memory: 512,
        autoScaling: {
          desiredCapacity: 1,
          minCapacity: 1,
          maxCapacity: 2,
          targetCpuUtilization: 70,
          targetMemoryUtilization: 70,
          scaleInCooldown: 30,
          scaleOutCooldown: 30,
        },
        name: 'should not be here',
      })
    ).toThrow(ZodError);
  });
});

describe('ConfigSchema is { core, aws }', () => {
  it('requires both slots', () => {
    expect(() => ConfigSchema.parse({aws: minimalAws()})).toThrow(ZodError);
    expect(() => ConfigSchema.parse({core: {}})).toThrow(ZodError);
  });

  it('accepts an empty core (all groups default) plus aws', () => {
    const parsed = ConfigSchema.parse({core: {}, aws: minimalAws()});
    // core defaults apply
    expect(parsed.core.branding.theme).toBe('default');
    expect(parsed.aws.stackName).toBe('faims-test');
  });
});
