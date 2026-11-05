/**
 * Tests for the CDK config schema. The shared deployment config is validated
 * by @faims3/build-config (core slot); here we test the AWS-specific extension
 * (AwsConfigSchema) and the cross-slot provider rule in parseConfig. The
 * shared refines (maps/autosuggest keys, migrate/lock invariant) are covered
 * by the build-config test suite.
 */
import {ZodError} from 'zod';
import {
  AttachmentStorageConfigSchema,
  AwsConfigSchema,
  ConductorConfigSchema,
  ConfigSchema,
  SpatialCapacityConfigSchema,
  loadConfigFromEnv,
  parseConfig,
} from '../lib/config';

const minimalAws = (overrides: Record<string, unknown> = {}) => ({
  stackName: 'faims-test',
  hostedZone: {id: 'Z123', name: 'example.com'},
  certificates: {primary: 'arn:cert:p', cloudfront: 'arn:cert:c'},
  account: '123456789012',
  region: 'ap-southeast-2',
  secrets: {privateKey: 'arn:sm:pk'},
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
    expect(parsed.conductor.ephemeralStorageGiB).toBe(21);
    expect(parsed.conductor.localhostWhitelist).toBe(false);
    // spatialCapacity defaults
    expect(parsed.spatialCapacity.maxCapacity).toBe(4);
    expect(parsed.spatialCapacity.ephemeralStorageGiB).toBe(80);
  });

  it('has no secrets.publicKey slot (public key lives in the privateKey secret)', () => {
    const parsed = AwsConfigSchema.parse(
      minimalAws({
        secrets: {privateKey: 'arn:sm:pk', publicKey: 'arn:sm:pubk'},
      })
    );
    expect(parsed.secrets.privateKey).toBe('arn:sm:pk');
    expect('publicKey' in parsed.secrets).toBe(false);
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
  it('accepts an ephemeral storage override and rejects out of range', () => {
    const base = minimalAws().conductor;
    expect(
      ConductorConfigSchema.parse({...base, ephemeralStorageGiB: 100})
        .ephemeralStorageGiB
    ).toBe(100);
    expect(() =>
      ConductorConfigSchema.parse({...base, ephemeralStorageGiB: 20})
    ).toThrow();
    expect(() =>
      ConductorConfigSchema.parse({...base, ephemeralStorageGiB: 201})
    ).toThrow();
  });

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

describe('AttachmentStorageConfigSchema', () => {
  it('defaults to S3 and the map-assets prefix', () => {
    const parsed = AttachmentStorageConfigSchema.parse({});
    expect(parsed.serviceType).toBe('S3');
    expect(parsed.prefix).toBe('map-assets');
  });

  it('accepts a custom prefix', () => {
    const parsed = AttachmentStorageConfigSchema.parse({
      serviceType: 'S3',
      prefix: 'layers',
    });
    expect(parsed.prefix).toBe('layers');
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
    expect(parsed.core.attachmentStorage.prefix).toBe('map-assets');
    expect(parsed.aws.stackName).toBe('faims-test');
  });

  it('applies the shared core invariants (domains -> endpoint derivation)', () => {
    // Regression: the CDK used to parse core with the bare object schema,
    // skipping parseBuildConfig, so domain-derived endpoints never applied
    // and frontend bundles fell back to localhost defaults.
    const parsed = ConfigSchema.parse({
      core: {
        domains: {
          base: 'example.com',
          services: {conductor: 'api', web: 'web', app: 'app'},
        },
      },
      aws: minimalAws(),
    });
    expect(parsed.core.endpoints.apiUrl).toBe('https://api.example.com');
    expect(parsed.core.endpoints.webUrl).toBe('https://web.example.com');
    expect(parsed.core.endpoints.appUrl).toBe('https://app.example.com');
    expect(parsed.core.endpoints.conductorUrls).toEqual([
      'https://api.example.com',
    ]);
  });
});

describe('parseConfig cross-file provider rule', () => {
  it('accepts enabled providers defined in core', () => {
    const parsed = parseConfig(
      {
        authProviders: {
          google: {
            id: 'google',
            type: 'google',
            displayName: 'Google',
            scope: [],
          },
        },
      },
      minimalAws({
        authProviders: {providers: ['google'], secretArn: 'arn:sm:auth'},
      })
    );
    expect(parsed.aws.authProviders?.providers).toEqual(['google']);
  });

  it('rejects enabled providers missing from core.authProviders', () => {
    expect(() =>
      parseConfig(
        {},
        minimalAws({
          authProviders: {providers: ['google'], secretArn: 'arn:sm:auth'},
        })
      )
    ).toThrow(/no core\.authProviders entry/);
  });
});

describe('loadConfigFromEnv', () => {
  const fs = require('node:fs') as typeof import('node:fs');
  const os = require('node:os') as typeof import('node:os');
  const path = require('node:path') as typeof import('node:path');

  // Layout mirrors the real repo: <root>/infrastructure/aws-cdk is the
  // baseDir the loader receives, and CONFIG_ENV resolves the sync script's
  // local mirror at <root>/config/<env>/.
  let repoRoot: string;
  let baseDir: string;
  let mirrorEnvDir: string;
  const writeJson = (p: string, v: unknown) => {
    fs.mkdirSync(path.dirname(p), {recursive: true});
    fs.writeFileSync(p, JSON.stringify(v));
  };

  beforeEach(() => {
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cdk-config-'));
    baseDir = path.join(repoRoot, 'infrastructure', 'aws-cdk');
    mirrorEnvDir = path.join(repoRoot, 'config', 'dev');
    writeJson(path.join(mirrorEnvDir, 'core.json'), {
      domains: {
        base: 'example.com',
        services: {conductor: 'api'},
      },
    });
    writeJson(path.join(mirrorEnvDir, 'aws.json'), minimalAws());
  });

  afterEach(() => {
    fs.rmSync(repoRoot, {recursive: true, force: true});
    // reportAndThrow sets this on load failures we deliberately trigger.
    if (process.exitCode === 1) process.exitCode = 0;
  });

  it('loads the sync-script local mirror config/<env>/ via CONFIG_ENV', () => {
    const config = loadConfigFromEnv(baseDir, {CONFIG_ENV: 'dev'});
    expect(config.aws.stackName).toBe('faims-test');
    expect(config.core.endpoints.apiUrl).toBe('https://api.example.com');
  });

  it('loads via CONFIG_DIR in place (config-repo checkout, as in CI)', () => {
    const ext = path.join(repoRoot, 'config-repo', 'configs', 'prod');
    writeJson(path.join(ext, 'core.json'), {});
    writeJson(path.join(ext, 'aws.json'), minimalAws());
    const config = loadConfigFromEnv(baseDir, {CONFIG_DIR: ext});
    expect(config.aws.stackName).toBe('faims-test');
  });

  it('loads explicit CORE_CONFIG_FILE + AWS_CONFIG_FILE', () => {
    const config = loadConfigFromEnv(baseDir, {
      CORE_CONFIG_FILE: path.join(mirrorEnvDir, 'core.json'),
      AWS_CONFIG_FILE: path.join(mirrorEnvDir, 'aws.json'),
    });
    expect(config.aws.stackName).toBe('faims-test');
  });

  it('requires both explicit files to be set', () => {
    expect(() =>
      loadConfigFromEnv(baseDir, {
        CORE_CONFIG_FILE: path.join(mirrorEnvDir, 'core.json'),
      })
    ).toThrow(/must be set together/);
  });

  it('errors clearly when nothing is configured', () => {
    expect(() => loadConfigFromEnv(baseDir, {})).toThrow(
      /No deployment config specified/
    );
  });

  it('errors when the CONFIG_ENV mirror env does not exist', () => {
    expect(() => loadConfigFromEnv(baseDir, {CONFIG_ENV: 'nope'})).toThrow(
      /Error loading configuration/
    );
  });
});

describe('SpatialCapacityConfigSchema GDAL / tippecanoe knobs', () => {
  it('fills conservative performance defaults', () => {
    const parsed = SpatialCapacityConfigSchema.parse({
      cpu: 8192,
      memory: 32768,
    });
    expect(parsed.gdalNumThreads).toBe('ALL_CPUS');
    expect(parsed.gdalCacheMaxMb).toBe(256);
    expect(parsed.gdalWarpMemoryMb).toBe(256);
    expect(parsed.gdalWarpMulti).toBe(true);
    expect(parsed.tippecanoeMaxThreads).toBeUndefined();
    expect(parsed).not.toHaveProperty('tippecanoeReadParallel');
    expect(parsed.starvationMs).toBe(5 * 60 * 1000);
    expect(parsed.scaleInCooldownMs).toBeUndefined();
  });

  it('accepts a custom scale-in cooldown including disable', () => {
    expect(
      SpatialCapacityConfigSchema.parse({scaleInCooldownMs: 0})
        .scaleInCooldownMs
    ).toBe(0);
    expect(
      SpatialCapacityConfigSchema.parse({scaleInCooldownMs: 120_000})
        .scaleInCooldownMs
    ).toBe(120_000);
  });

  it('accepts a custom starvation timeout including disable', () => {
    expect(
      SpatialCapacityConfigSchema.parse({starvationMs: 0}).starvationMs
    ).toBe(0);
    expect(
      SpatialCapacityConfigSchema.parse({starvationMs: 120_000}).starvationMs
    ).toBe(120_000);
  });

  it('rejects a negative starvation timeout', () => {
    expect(() => SpatialCapacityConfigSchema.parse({starvationMs: -1})).toThrow(
      ZodError
    );
  });

  it('rejects a negative scale-in cooldown', () => {
    expect(() =>
      SpatialCapacityConfigSchema.parse({scaleInCooldownMs: -1})
    ).toThrow(ZodError);
  });

  it('accepts an explicit thread cap and larger warp buffer', () => {
    const parsed = SpatialCapacityConfigSchema.parse({
      gdalNumThreads: 8,
      gdalCacheMaxMb: 2048,
      gdalWarpMemoryMb: 1024,
      tippecanoeMaxThreads: 8,
    });
    expect(parsed.gdalNumThreads).toBe(8);
    expect(parsed.gdalCacheMaxMb).toBe(2048);
    expect(parsed.tippecanoeMaxThreads).toBe(8);
  });

  it('rejects a zero warp buffer', () => {
    expect(() =>
      SpatialCapacityConfigSchema.parse({gdalWarpMemoryMb: 0})
    ).toThrow(ZodError);
  });
});
