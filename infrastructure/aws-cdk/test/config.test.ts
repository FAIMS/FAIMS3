/**
 * Tests for config schema validation, especially addressAutosuggest + map source
 * key rules (MapTiler key required in one of two places when source is MAPTILER).
 */
import {ZodError} from 'zod';
import {ConfigSchema, UiConfiguration} from '../lib/config';

function minimalOfflineMaps(
  overrides: {
    mapSource?: 'osm' | 'maptiler';
    mapSourceKey?: string;
  } = {}
) {
  return {
    mapSource: 'maptiler' as const,
    mapSourceKey: 'map-key',
    offlineMaps: false,
    mapStyle: 'basic' as const,
    ...overrides,
  };
}

function minimalUiConfig(overrides: Record<string, unknown> = {}) {
  return {
    uiTheme: 'default' as const,
    notebookListType: 'tabs' as const,
    notebookName: 'survey',
    appName: 'Test App',
    appId: 'FAIMS',
    offlineMaps: minimalOfflineMaps(),
    addressAutosuggest: {source: 'NONE' as const},
    ...overrides,
  };
}

describe('UiConfiguration addressAutosuggest + MapTiler key validation', () => {
  it('accepts MAPTILER when maptilerKey is set', () => {
    const config = minimalUiConfig({
      addressAutosuggest: {
        source: 'MAPTILER',
        maptilerKey: 'autosuggest-key',
      },
    });
    expect(() => UiConfiguration.parse(config)).not.toThrow();
  });

  it('accepts MAPTILER when mapSource is maptiler and mapSourceKey is set (no maptilerKey)', () => {
    const config = minimalUiConfig({
      offlineMaps: minimalOfflineMaps({
        mapSource: 'maptiler',
        mapSourceKey: 'map-key',
      }),
      addressAutosuggest: {source: 'MAPTILER'},
    });
    expect(() => UiConfiguration.parse(config)).not.toThrow();
  });

  it('rejects MAPTILER when neither maptilerKey nor map source key is provided (mapSource is osm)', () => {
    const config = minimalUiConfig({
      offlineMaps: minimalOfflineMaps({
        mapSource: 'osm',
        mapSourceKey: undefined,
      }),
      addressAutosuggest: {source: 'MAPTILER'},
    });
    expect(() => UiConfiguration.parse(config)).toThrow(ZodError);
    try {
      UiConfiguration.parse(config);
    } catch (e) {
      const err = e as ZodError;
      expect(err.message).toContain('MAPTILER');
      expect(err.message).toMatch(/maptilerKey|mapSource|mapSourceKey/);
    }
  });

  it('rejects MAPTILER when mapSource is maptiler but mapSourceKey is missing', () => {
    const config = minimalUiConfig({
      offlineMaps: minimalOfflineMaps({
        mapSource: 'maptiler',
        mapSourceKey: undefined,
      }),
      addressAutosuggest: {source: 'MAPTILER'},
    });
    expect(() => UiConfiguration.parse(config)).toThrow(ZodError);
  });

  it('rejects MAPTILER when mapSource is maptiler but mapSourceKey is empty string', () => {
    const config = minimalUiConfig({
      offlineMaps: minimalOfflineMaps({
        mapSource: 'maptiler',
        mapSourceKey: '',
      }),
      addressAutosuggest: {source: 'MAPTILER'},
    });
    expect(() => UiConfiguration.parse(config)).toThrow(ZodError);
  });

  it('rejects MAPTILER when maptilerKey is empty string and mapSourceKey is not set', () => {
    const config = minimalUiConfig({
      offlineMaps: minimalOfflineMaps({
        mapSource: 'osm',
        mapSourceKey: undefined,
      }),
      addressAutosuggest: {source: 'MAPTILER', maptilerKey: ''},
    });
    expect(() => UiConfiguration.parse(config)).toThrow(ZodError);
  });

  it('uses map source key when maptilerKey is whitespace-only and mapSource has key', () => {
    const config = minimalUiConfig({
      offlineMaps: minimalOfflineMaps({
        mapSource: 'maptiler',
        mapSourceKey: 'map-key',
      }),
      addressAutosuggest: {source: 'MAPTILER', maptilerKey: '   '},
    });
    expect(() => UiConfiguration.parse(config)).not.toThrow();
  });
});

function minimalStackConfig(overrides: Record<string, unknown> = {}) {
  return {
    stackName: 'TestStack',
    hostedZone: {id: 'Z123', name: 'example.com'},
    certificates: {
      primary: 'arn:aws:acm:ap-southeast-2:123456789012:certificate/abc',
      cloudfront: 'arn:aws:acm:us-east-1:123456789012:certificate/def',
    },
    aws: {account: '123456789012', region: 'ap-southeast-2'},
    secrets: {
      privateKey:
        'arn:aws:secretsmanager:ap-southeast-2:123456789012:secret:pk',
      publicKey:
        'arn:aws:secretsmanager:ap-southeast-2:123456789012:secret:pub',
    },
    uiConfiguration: minimalUiConfig(),
    supportLinks: {
      supportEmail: 'support@example.com',
      privacyPolicyUrl: 'https://example.com/privacy',
      contactUrl: 'https://example.com/contact',
    },
    couch: {
      volumeSize: 20,
      instanceType: 't3.small',
    },
    backup: {
      vaultName: 'test-vault',
      retentionDays: 30,
      scheduleExpression: 'cron(0 3 * * ? *)',
    },
    conductor: {
      name: 'Test',
      description: 'Test conductor',
      conductorDockerImage: 'ghcr.io/faims/faims3-api',
      cpu: 512,
      memory: 1024,
      autoScaling: {
        desiredCapacity: 1,
        minCapacity: 1,
        maxCapacity: 2,
        targetCpuUtilization: 70,
        targetMemoryUtilization: 70,
        scaleInCooldown: 60,
        scaleOutCooldown: 60,
      },
    },
    domains: {baseDomain: 'example.com'},
    mobileApps: {
      androidAppPublicUrl: 'https://play.google.com/store/apps/details?id=x',
      iosAppPublicUrl: 'https://apps.apple.com/app/x',
    },
    web: {title: 'Control Centre'},
    smtp: {
      emailServiceType: 'SMTP',
      fromEmail: 'notify@example.com',
      fromName: 'FAIMS',
      testEmailAddress: 'admin@example.com',
      credentialsSecretArn:
        'arn:aws:secretsmanager:ap-southeast-2:123456789012:secret:smtp',
    },
    bugMonitoring: {},
    ...overrides,
  };
}

describe('ConfigSchema couchAuthProxy', () => {
  it('defaults to disabled when couchAuthProxy is omitted', () => {
    const parsed = ConfigSchema.parse(minimalStackConfig());
    expect(parsed.couchAuthProxy.enabled).toBe(false);
    expect(parsed.couchAuthProxy.imageTag).toBe('sha-3004091');
    expect(parsed.couchAuthProxy.image).toBe(
      'ghcr.io/peterbaker0/couch-auth-proxy'
    );
  });

  it('accepts enabled proxy config with defaults for cpu/memory/count', () => {
    const parsed = ConfigSchema.parse(
      minimalStackConfig({
        couchAuthProxy: {enabled: true},
      })
    );
    expect(parsed.couchAuthProxy.enabled).toBe(true);
    expect(parsed.couchAuthProxy.cpu).toBe(512);
    expect(parsed.couchAuthProxy.memory).toBe(1024);
    expect(parsed.couchAuthProxy.desiredCount).toBe(2);
    expect(parsed.couchAuthProxy.imageTag).toBe('sha-3004091');
  });

  it('accepts a custom image pin', () => {
    const parsed = ConfigSchema.parse(
      minimalStackConfig({
        couchAuthProxy: {
          enabled: true,
          image: 'ghcr.io/peterbaker0/couch-auth-proxy',
          imageTag: 'sha-deadbeef',
          cpu: 256,
          memory: 512,
          desiredCount: 1,
        },
      })
    );
    expect(parsed.couchAuthProxy.imageTag).toBe('sha-deadbeef');
    expect(parsed.couchAuthProxy.cpu).toBe(256);
  });

  it('rejects non-positive cpu', () => {
    expect(() =>
      ConfigSchema.parse(
        minimalStackConfig({
          couchAuthProxy: {enabled: true, cpu: 0},
        })
      )
    ).toThrow(ZodError);
  });
});
