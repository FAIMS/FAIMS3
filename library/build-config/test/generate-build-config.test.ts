import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {generateEnv, parseArgs} from '../src/generate-build-config';
import {
  buildAuthProviderEnvMap,
  DEFAULT_LONG_LIVED_TOKEN_DURATION_HINTS,
  OptionalCsvSchema,
  parseBuildConfig,
  readAuthProviderConfigFromEnv,
  resolveInjectedAppVersion,
  sanitizeCommitVersion,
  type PartialBuildConfig,
} from '../src/build-config';
import {isGoogleProvider} from '../src/auth-provider-config';
import {generateBuildConfig} from '../src/generate-build-config';

function deepMerge(a: unknown, b: unknown): unknown {
  if (Array.isArray(a) || Array.isArray(b)) {
    return b ?? a;
  }

  if (
    a &&
    b &&
    typeof a === 'object' &&
    typeof b === 'object' &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  ) {
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    const merged: Record<string, unknown> = {...left};

    for (const key of Object.keys(right)) {
      merged[key] = deepMerge(left[key], right[key]);
    }

    return merged;
  }

  return b === undefined ? a : b;
}

const sampleConfig: PartialBuildConfig = {
  endpoints: {},
  branding: {},
  support: {},
  notebookAndRecordUX: {},
  maps: {},
  sync: {},
  attachments: {},
  migration: {},
  auth: {},
  authProviders: {},
  authTokens: {},
  limits: {},
  email: {},
  observability: {},
  teamAndRolePolicy: {},
  webDesignerLimits: {},
  android: {},
  ios: {},
  couchdb: {},
  dev: {},
  pouchdb: {},
};

test('parseArgs accepts config and platform arguments', () => {
  assert.deepEqual(parseArgs(['--config', 'demo.json', '--platform', 'apps']), {
    config: 'demo.json',
    platform: 'apps',
  });
});

test('generator emits shared app and web env values', () => {
  const output = generateEnv({config: sampleConfig, platform: 'apps'});

  assert.match(output, /VITE_APP_NAME=/);
  assert.match(output, /VITE_THEME=/);
  assert.match(output, /VITE_CONDUCTOR_URL=/);
  assert.match(output, /VITE_WEB_URL=/);
  assert.match(output, /VITE_APP_ID=/);
  assert.match(output, /VITE_CLUSTER_ADMIN_GROUP_NAME=cluster-admin/);
  assert.match(output, /VITE_SHOW_NEW_NOTEBOOK=true/);
  assert.match(output, /VITE_SHOW_RECORD_SUMMARY_COUNTS=true/);
});

test('generator resolves git commit version automatically', () => {
  const output = generateEnv({
    config: {
      ...sampleConfig,
      observability: {
        ...sampleConfig.observability,
        commitVersion: 'abcdef1',
      },
    },
    platform: 'apps',
  });

  assert.match(output, /VITE_COMMIT_VERSION=/);
  assert.match(output, /VITE_COMMIT_VERSION=abcdef1/);
});

test('generator supports platform-specific export selection', () => {
  const config = {
    ...sampleConfig,
    ios: {
      bundleIdentifier: 'au.edu.faims.electronicfieldnotebook',
      developerPortalTeamId: 'ABCDE12345',
      appStoreConnectTeamId: '123456789',
      appleId: 'developer@apple.com',
    },
    android: {
      appId: 'org.fedarch.faims3',
      releaseStatus: 'draft',
    },
  };
  const output = generateEnv({config: config, platform: 'apps'});

  assert.match(output, /VITE_APPLE_BUNDLE_IDENTIFIER=/);
  assert.match(output, /VITE_APP_STORE_CONNECT_TEAM_ID=/);
  assert.match(output, /FASTLANE_APPLE_ID=/);
  assert.match(output, /ANDROID_RELEASE_STATUS=/);
});

test('generator supports api platform export selection', () => {
  const rawConfig = {
    endpoints: {},
    branding: {},
    support: {},
    notebookAndRecordUX: {},
    maps: {},
    sync: {},
    attachments: {},
    migration: {},
    auth: {
      profileName: 'dev-profile',
      keyFilePath: '.',
      keySource: 'FILE' as const,
      provisionSsoUsersPolicy: 'reject',
    },
    authProviders: {
      google: {
        id: 'google',
        type: 'google',
        displayName: 'Google',
        scope: ['profile', 'email'],
        clientID: 'google-client-id',
        clientSecret: 'google-client-secret',
      },
    },
    authTokens: {},
    limits: {},
    email: {
      emailServiceType: 'MOCK',
      emailFromAddress: 'notifications@example.com',
      emailFromName: 'FAIMS Notification',
      emailReplyTo: 'support@example.com',
      smtpHost: 'smtp.example.com',
      smtpPort: 587,
      smtpSecure: true,
      smtpUser: 'smtp-user',
      smtpPassword: 'smtp-password',
      testEmailAddress: 'test@example.com',
    },
    observability: {},
    teamAndRolePolicy: {},
    webDesignerLimits: {},
    android: {},
    ios: {},
    couchdb: {
      user: 'admin',
      password: 'secret',
    },
    dev: {},
    pouchdb: {},
  } as const;

  const config = parseBuildConfig(rawConfig);

  const output = generateEnv({config, platform: 'api'});

  assert.match(output, /PROFILE_NAME=dev-profile/);
  assert.match(output, /COUCHDB_USER=admin/);
  assert.match(output, /EMAIL_SERVICE_TYPE=MOCK/);
  assert.match(output, /AUTH_GOOGLE_TYPE=google/);
  assert.match(output, /AUTH_GOOGLE_CLIENT_ID=google-client-id/);
  assert.doesNotMatch(output, /VITE_APP_NAME=/);
});

test('auth provider env helpers roundtrip config for google provider', () => {
  const source = {
    google: {
      id: 'google',
      type: 'google' as const,
      displayName: 'Google',
      scope: ['profile', 'email'],
      callbackMethods: ['GET' as const],
      clientID: 'google-client-id',
      clientSecret: 'google-client-secret',
    },
  };

  const env = buildAuthProviderEnvMap(source);
  const parsed = readAuthProviderConfigFromEnv(env);

  assert.equal(parsed.google?.type, 'google');
  assert.equal(parsed.google?.displayName, 'Google');
  assert.deepEqual(parsed.google?.scope, ['profile', 'email']);
  assert.ok(parsed.google && isGoogleProvider(parsed.google));
  assert.equal(parsed.google.clientID, 'google-client-id');
});

test('core.sample.json matches current build config schema', () => {
  const base = JSON.parse(
    fs.readFileSync(
      new URL('../config/core.sample.json', import.meta.url),
      'utf8'
    )
  );

  const parsed = parseBuildConfig(base);
  assert.equal(parsed.auth.keySource, 'FILE');
  assert.equal(parsed.authProviders.google?.type, 'google');
});

test('mobile sample + secrets deep merge matches current build config schema', () => {
  const base = JSON.parse(
    fs.readFileSync(
      new URL('../config/core.sample.json', import.meta.url),
      'utf8'
    )
  );
  const secrets = JSON.parse(
    fs.readFileSync(
      new URL('../config/secrets.sample.json', import.meta.url),
      'utf8'
    )
  );

  const merged = deepMerge(base, secrets);
  const parsed = parseBuildConfig(merged);

  assert.equal(parsed.email.smtpPassword, '<SMTP_PASSWORD>');
  assert.equal(parsed.authProviders.google?.type, 'google');
});

test('generator emits Android base64 secrets when provided', () => {
  const config = {
    ...sampleConfig,
    android: {
      keystoreFileBase64: 'encoded-keystore',
      serviceAccountKeyJsonBase64: 'encoded-service-account',
    },
  };

  const output = generateEnv({config, platform: 'apps'});

  assert.match(output, /KEYSTORE_FILE=encoded-keystore/);
  assert.match(
    output,
    /GPLAY_SERVICE_ACCOUNT_KEY_JSON=encoded-service-account/
  );
});

test('generator falls back to iOS individual key values', () => {
  const config = {
    ...sampleConfig,
    ios: {
      appleIndividualKeyId: 'ind-key-id',
      appleIndividualKeyContent: 'ind-key-content',
    },
  };

  const output = generateEnv({config, platform: 'apps'});

  assert.match(output, /APPLE_KEY_ID=ind-key-id/);
  assert.match(output, /APPLE_KEY_CONTENT=ind-key-content/);
});

test('generator escapes multiline values for env-file compatibility', () => {
  const config = {
    ...sampleConfig,
    ios: {
      appleKeyContent:
        '\n-----BEGIN PRIVATE KEY-----\nABCDEF\n-----END PRIVATE KEY-----\n',
    },
  };

  const output = generateEnv({config, platform: 'apps'});

  assert.match(
    output,
    /APPLE_KEY_CONTENT=\\n-----BEGIN PRIVATE KEY-----\\nABCDEF\\n-----END PRIVATE KEY-----\\n/
  );
});

test('short/heading names fall back to the app name in generated env', () => {
  const output = generateEnv({config: sampleConfig, platform: 'apps'});

  assert.match(output, /VITE_APP_NAME=FAIMS/);
  assert.match(output, /VITE_APP_SHORT_NAME=FAIMS/);
  assert.match(output, /VITE_HEADING_APP_NAME=FAIMS/);
});

test('generated apps env includes canonical branding and endpoint keys', () => {
  const config: PartialBuildConfig = {
    ...sampleConfig,
    endpoints: {
      webUrl: 'https://web.example.org',
      apiUrl: 'https://api.example.org',
      appUrl: 'https://app.example.org',
      conductorUrls: ['https://api.example.org', 'https://api2.example.org'],
    },
    branding: {appName: 'Fieldmark', theme: 'fieldmark'},
    android: {appId: 'org.example.app'},
  };

  const env = generateEnv({config, platform: 'apps', includeEmpty: true});
  assert.match(env, /VITE_APP_NAME=Fieldmark/);
  assert.match(env, /VITE_THEME=fieldmark/);
  assert.match(env, /VITE_APP_ID=org.example.app/);
  assert.match(
    env,
    /VITE_CONDUCTOR_URL=https:\/\/api.example.org,https:\/\/api2.example.org/
  );
});

test('generated API env includes conductor, auth, and email contract values', () => {
  const config: PartialBuildConfig = {
    ...sampleConfig,
    endpoints: {
      apiUrl: 'https://api.example.org',
      webUrl: 'https://web.example.org',
      appUrl: 'https://app.example.org',
    },
    branding: {
      appName: 'Fieldmark',
      conductorInstanceName: 'Example Conductor',
      conductorDescription: 'An example',
      conductorShortCodePrefix: 'EXM',
    },
    auth: {
      profileName: 'prod',
      keySource: 'FILE',
      disableLocalLogin: true,
      provisionSsoUsersPolicy: 'own-team',
    },
    authProviders: {
      google: {
        id: 'google',
        type: 'google',
        displayName: 'Google',
        scope: ['profile', 'email'],
        callbackMethods: ['GET'],
        clientID: 'cid',
        clientSecret: 'cs',
      },
    },
    authTokens: {refreshTokenExpiryMinutes: 1440, accessTokenExpiryMinutes: 60},
    limits: {rateLimiterEnabled: false, jsonBodyLimit: '50mb'},
    email: {emailServiceType: 'MOCK'},
    couchdb: {
      user: 'admin',
      password: 'pw',
    },
    conductor: {
      internalPort: 8080,
    },
  };

  const env = generateEnv({config, platform: 'api', includeEmpty: true});
  const raw: Record<string, unknown> = {};
  for (const line of env.split('\n')) {
    if (!line.includes('=')) continue;
    const idx = line.indexOf('=');
    raw[line.slice(0, idx)] = line.slice(idx + 1);
  }

  // Assert the emitted API contract values. Client-specific parse
  // round-trips live in client-env.test.ts.
  assert.equal(raw.CONDUCTOR_PUBLIC_URL, 'https://api.example.org');
  assert.equal(raw.WEB_APP_PUBLIC_URL, 'https://app.example.org');
  assert.equal(raw.PROFILE_NAME, 'prod');
  assert.equal(raw.DISABLE_LOCAL_LOGIN, 'true');
  assert.equal(raw.PROVISION_SSO_USERS_POLICY, 'own-team');
  assert.equal(raw.AUTH_GOOGLE_CLIENT_ID, 'cid');
  assert.equal(raw.REFRESH_TOKEN_EXPIRY_MINUTES, '1440');
  assert.equal(raw.ACCESS_TOKEN_EXPIRY_MINUTES, '60');
  assert.equal(raw.RATE_LIMITER_ENABLED, 'false');
  assert.equal(raw.JSON_BODY_LIMIT, '50mb');
  assert.equal(raw.EMAIL_SERVICE_TYPE, 'MOCK');
  assert.equal(raw.CONDUCTOR_INTERNAL_PORT, '8080');
  assert.equal(raw.CONDUCTOR_SHORT_CODE_PREFIX, 'EXM');
});

// The mobile CI workflows pass --platform android / --platform ios.
test('generateBuildConfig accepts android and ios platform aliases', () => {
  const configPath = fs.mkdtempSync(path.join(os.tmpdir(), 'build-config-'));
  const configJson = path.join(configPath, 'config.json');
  fs.writeFileSync(configJson, JSON.stringify(sampleConfig), 'utf8');

  try {
    const android = generateBuildConfig(
      {config: configJson, platform: 'android'},
      process.cwd()
    );
    const ios = generateBuildConfig(
      {config: configJson, platform: 'ios'},
      process.cwd()
    );
    const apps = generateBuildConfig(
      {config: configJson, platform: 'apps'},
      process.cwd()
    );

    assert.match(android, /VITE_APP_NAME=/);
    assert.match(android, /ANDROID_RELEASE_STATUS/);
    assert.match(ios, /VITE_APPLE_BUNDLE_IDENTIFIER=/);
    assert.equal(android, apps);
    assert.equal(ios, apps);

    assert.throws(
      () =>
        generateBuildConfig(
          {config: configJson, platform: 'web'},
          process.cwd()
        ),
      /Unsupported platform: web/
    );
  } finally {
    fs.rmSync(configPath, {recursive: true, force: true});
  }
});

test('schema rejects unknown top-level keys', () => {
  assert.throws(
    () =>
      parseBuildConfig({
        ...sampleConfig,
        extraKey: true,
      }),
    /unrecognized key/i
  );
});

test('generator emits boolean and integer values as strings', () => {
  const env = generateEnv({
    config: {
      ...sampleConfig,
      dev: {debugApp: true},
      pouchdb: {pouchBatchSize: 25},
    },
    platform: 'apps',
  });
  assert.match(env, /VITE_DEBUG_APP=true/);
  assert.match(env, /VITE_POUCH_BATCH_SIZE=25/);
});

test('generator emits typed branding and map values', () => {
  const env = generateEnv({
    config: {
      ...sampleConfig,
      branding: {appName: 'Fieldmark', appShortName: 'FM'},
      endpoints: {
        webUrl: 'https://web.example.org',
        apiUrl: 'https://api.example.org',
        appUrl: 'https://app.example.org',
      },
      maps: {
        mapSource: 'maptiler',
        mapSourceKey: 'abc123',
        satelliteSource: 'esri',
        offlineMaps: true,
      },
    },
    platform: 'apps',
  });
  assert.match(env, /VITE_APP_NAME=Fieldmark/);
  assert.match(env, /VITE_APP_SHORT_NAME=FM/);
  assert.match(env, /VITE_MAP_SOURCE=maptiler/);
  assert.match(env, /VITE_SATELLITE_SOURCE=esri/);
});

// ---------------------------------------------------------------------------
// Phase 2: shared invariants apply in the schema transform, so
// they hold for JSON, apps env and api env alike.
// ---------------------------------------------------------------------------

test('D4: short/heading names fall back to app name', () => {
  const parsed = parseBuildConfig({branding: {appName: 'Fieldmark'}});
  assert.equal(parsed.branding.appShortName, 'Fieldmark');
  assert.equal(parsed.branding.headingAppName, 'Fieldmark');
});

test('D4: offline maps are forced off for OSM', () => {
  const parsed = parseBuildConfig({
    maps: {mapSource: 'osm', offlineMaps: true},
  });
  assert.equal(parsed.maps.offlineMaps, false);

  const parsedMaptiler = parseBuildConfig({
    maps: {mapSource: 'maptiler', offlineMaps: true},
  });
  assert.equal(parsedMaptiler.maps.offlineMaps, true);
});

// the migrate/lock invariant lives in the shared schema.
test('migration: lock cannot be enabled when migrate-on-startup is disabled', () => {
  assert.throws(() =>
    parseBuildConfig({
      migration: {
        disableMigrateOnStartup: true,
        startupMigrationLockEnabled: true,
      },
    })
  );
  // Omitted lock is fine; skip-migrate forces the lock off.
  const parsed = parseBuildConfig({migration: {disableMigrateOnStartup: true}});
  assert.equal(parsed.migration.startupMigrationLockEnabled, false);
  // Omit vs explicit false stay distinct when migrate-on-startup is on
  // (AWS defaults omit to on; local API defaults omit to off).
  assert.equal(
    parseBuildConfig({}).migration.startupMigrationLockEnabled,
    undefined
  );
  assert.equal(
    parseBuildConfig({migration: {startupMigrationLockEnabled: false}})
      .migration.startupMigrationLockEnabled,
    false
  );
});

// the autosuggest key rules live in the shared schema.
test('maps: mapbox autosuggest requires a mapbox key', () => {
  assert.throws(() => parseBuildConfig({maps: {autosuggestSource: 'mapbox'}}));
  assert.doesNotThrow(() =>
    parseBuildConfig({
      maps: {autosuggestSource: 'mapbox', autosuggestMapboxKey: 'pk'},
    })
  );
});

test('maps: maptiler autosuggest needs a tiler key or a maptiler map key', () => {
  assert.throws(() =>
    parseBuildConfig({maps: {autosuggestSource: 'maptiler'}})
  );
  assert.doesNotThrow(() =>
    parseBuildConfig({
      maps: {autosuggestSource: 'maptiler', autosuggestMapTilerKey: 'k'},
    })
  );
  assert.doesNotThrow(() =>
    parseBuildConfig({
      maps: {
        mapSource: 'maptiler',
        mapSourceKey: 'k',
        autosuggestSource: 'maptiler',
      },
    })
  );
});

test('D4: long-lived token hints are clamped, deduped and sorted', () => {
  const parsed = parseBuildConfig({
    authTokens: {
      maximumLongLivedDurationDays: 30,
      longLivedTokenDurationHints: [90, 10, 30, 10, 5],
    },
  });
  // 90 is dropped (above max 30); 10 deduped; sorted ascending.
  assert.deepEqual(parsed.authTokens.longLivedTokenDurationHints, [5, 10, 30]);

  // If all hints exceed the max, the max becomes the sole hint.
  const allExceed = parseBuildConfig({
    authTokens: {
      maximumLongLivedDurationDays: 7,
      longLivedTokenDurationHints: [30, 90],
    },
  });
  assert.deepEqual(allExceed.authTokens.longLivedTokenDurationHints, [7]);

  // Omitted hints use the shared default list, then clamp (max 90 drops 365).
  const omitted = parseBuildConfig({
    authTokens: {maximumLongLivedDurationDays: 90},
  });
  assert.deepEqual(
    omitted.authTokens.longLivedTokenDurationHints,
    [1, 5, 10, 30, 90]
  );

  // A tight cap still keeps the default chips that fit.
  const tight = parseBuildConfig({
    authTokens: {maximumLongLivedDurationDays: 7},
  });
  assert.deepEqual(tight.authTokens.longLivedTokenDurationHints, [1, 5]);

  // No cap: omitted hints stay the full default list.
  const unlimited = parseBuildConfig({
    authTokens: {maximumLongLivedDurationDays: 'unlimited'},
  });
  assert.deepEqual(unlimited.authTokens.longLivedTokenDurationHints, [
    ...DEFAULT_LONG_LIVED_TOKEN_DURATION_HINTS,
  ]);
});

test('D4: maximumLongLivedDurationDays accepts unlimited', () => {
  assert.equal(
    parseBuildConfig({authTokens: {maximumLongLivedDurationDays: 'unlimited'}})
      .authTokens.maximumLongLivedDurationDays,
    'unlimited'
  );
});

// the domain structure derives the concrete endpoints.
test('domains: production base+services derive concrete endpoints', () => {
  const parsed = parseBuildConfig({
    domains: {
      base: 'faims.example.com',
      services: {
        conductor: 'api',
        couch: 'couchdb',
        web: 'dashboard',
        app: 'app',
      },
    },
  });
  assert.equal(parsed.endpoints.apiUrl, 'https://api.faims.example.com');
  assert.equal(parsed.endpoints.webUrl, 'https://dashboard.faims.example.com');
  assert.equal(parsed.endpoints.appUrl, 'https://app.faims.example.com');
  assert.equal(
    parsed.endpoints.couchdbPublicUrl,
    'https://couchdb.faims.example.com'
  );
  assert.deepEqual(parsed.endpoints.conductorUrls, [
    'https://api.faims.example.com',
  ]);
});

test('domains: localOverride hosts are used verbatim with http', () => {
  const parsed = parseBuildConfig({
    domains: {
      base: 'faims.example.com',
      services: {
        conductor: 'api',
        couch: 'couchdb',
        web: 'dashboard',
        app: 'app',
      },
      localOverride: {conductor: 'localhost:8080', web: 'localhost:3001'},
    },
  });
  assert.equal(parsed.endpoints.apiUrl, 'http://localhost:8080');
  assert.equal(parsed.endpoints.webUrl, 'http://localhost:3001');
  // A non-overridden service keeps its derived (https) URL.
  assert.equal(parsed.endpoints.appUrl, 'https://app.faims.example.com');
});

test('domains: absent domains keeps concrete endpoints (backward compatible)', () => {
  const parsed = parseBuildConfig({
    endpoints: {apiUrl: 'https://api.legacy.com'},
  });
  assert.equal(parsed.domains, undefined);
  assert.equal(parsed.endpoints.apiUrl, 'https://api.legacy.com');
  // Empty conductorUrls falls back to apiUrl so the app has a server.
  assert.deepEqual(parsed.endpoints.conductorUrls, ['https://api.legacy.com']);
});

test('OptionalCsvSchema trims entries and drops empties', () => {
  assert.deepEqual(OptionalCsvSchema.parse(''), []);
  assert.deepEqual(OptionalCsvSchema.parse('   '), []);
  assert.deepEqual(OptionalCsvSchema.parse(', ,,  ,'), []);
  assert.deepEqual(OptionalCsvSchema.parse('value1,'), ['value1']);
  assert.deepEqual(OptionalCsvSchema.parse(' a , b , '), ['a', 'b']);
});

test('resolveInjectedAppVersion falls back to unknown', () => {
  const info: string[] = [];
  const warn: string[] = [];
  const originalInfo = console.info;
  const originalWarn = console.warn;
  console.info = (message?: unknown) => {
    info.push(String(message));
  };
  console.warn = (message?: unknown) => {
    warn.push(String(message));
  };
  try {
    assert.equal(resolveInjectedAppVersion('1.2.3'), '1.2.3');
    assert.equal(resolveInjectedAppVersion(''), 'unknown');
    assert.equal(resolveInjectedAppVersion(undefined), 'unknown');
    assert.match(info[0] ?? '', /1\.2\.3/);
    assert.match(warn[0] ?? '', /unknown/);
  } finally {
    console.info = originalInfo;
    console.warn = originalWarn;
  }
});

test('conductorUrls: omitted / empty list falls back to apiUrl', () => {
  const fromJson = parseBuildConfig({
    endpoints: {apiUrl: 'https://api.example.org', conductorUrls: []},
  });
  assert.deepEqual(fromJson.endpoints.conductorUrls, [
    'https://api.example.org',
  ]);

  // An explicit list is kept (not replaced by apiUrl).
  const explicit = parseBuildConfig({
    endpoints: {
      apiUrl: 'https://api.example.org',
      conductorUrls: ['https://api2.example.org'],
    },
  });
  assert.deepEqual(explicit.endpoints.conductorUrls, [
    'https://api2.example.org',
  ]);
});

test('domains: rejects unknown service names', () => {
  assert.throws(() =>
    parseBuildConfig({
      domains: {
        base: 'faims.example.com',
        services: {
          conductor: 'api',
          couch: 'couchdb',
          web: 'dashboard',
          app: 'app',
          bogus: 'x',
        },
      },
    })
  );
});

test('auth provider env: invalid provider is dropped with a warning (not silently)', () => {
  // A provider with a type that matches no known provider is invalid.
  const env = {
    AUTH_GOOGLE_TYPE: 'not-a-real-type',
    AUTH_GOOGLE_DISPLAY_NAME: 'Google',
    AUTH_GOOGLE_SCOPE: 'profile,email',
  };
  const before = console.warn;
  let warned = false;
  console.warn = (..._args) => {
    warned = true;
  };
  let result;
  try {
    result = readAuthProviderConfigFromEnv(env);
  } finally {
    console.warn = before;
  }
  assert.equal(warned, true);
  assert.deepEqual(result, {});
});

test('designer-only web keys emit in generated apps env', () => {
  const config: PartialBuildConfig = {
    ...sampleConfig,
    webDesignerLimits: {
      templateProtections: true,
      enablePlansInDesigner: false,
    },
  };
  const env = generateEnv({config, platform: 'apps'});
  assert.match(env, /VITE_TEMPLATE_PROTECTIONS=true/);
  assert.match(env, /VITE_ENABLE_PLANS_IN_DESIGNER=false/);
});

test('sanitizeCommitVersion keeps hashes and release stamps, drops the rest', () => {
  assert.equal(
    sanitizeCommitVersion('a1b2c3d4e5f6789012345678901234567890abcd'),
    'a1b2c3d4e5f6789012345678901234567890abcd'
  );
  assert.equal(sanitizeCommitVersion('abc1234'), 'abc1234');
  assert.equal(
    sanitizeCommitVersion('v1.7.2-android-#abc1234'),
    'v1.7.2-android-#abc1234'
  );
  assert.equal(
    sanitizeCommitVersion('v1.7.2-ios-#abc1234'),
    'v1.7.2-ios-#abc1234'
  );
  assert.equal(
    sanitizeCommitVersion('output of `git rev-parse HEAD`'),
    undefined
  );
  assert.equal(sanitizeCommitVersion('not a hash'), undefined);
  assert.equal(sanitizeCommitVersion('HEAD'), undefined);
  assert.equal(sanitizeCommitVersion(''), undefined);
  assert.equal(sanitizeCommitVersion(undefined), undefined);
});
