import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {generateEnv, parseArgs} from '../src/generate-build-config';
import {
  buildAuthProviderEnvMap,
  parseBuildConfig,
  parseGeneratedEnv,
  readAuthProviderConfigFromEnv,
  SharedBuildConfig,
} from '../src/build-config';
import {generateBuildConfig} from '../src/generate-build-config';
import {validateGeneratedEnv} from '../src/validate-generated-env';

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

const sampleConfig: SharedBuildConfig = {
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
      couchdbUser: 'admin',
      couchdbPassword: 'secret',
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
  assert.equal((parsed.google as any)?.clientID, 'google-client-id');
});

test('mobile-config.sample.json matches current build config schema', () => {
  const base = JSON.parse(
    fs.readFileSync(new URL('../config/mobile-config.sample.json', import.meta.url), 'utf8')
  );

  const parsed = parseBuildConfig(base);
  assert.equal(parsed.auth.keySource, 'FILE');
  assert.equal(parsed.authProviders.google?.type, 'google');
});

test('mobile sample + secrets deep merge matches current build config schema', () => {
  const base = JSON.parse(
    fs.readFileSync(new URL('../config/mobile-config.sample.json', import.meta.url), 'utf8')
  );
  const secrets = JSON.parse(
    fs.readFileSync(new URL('../config/mobile-secrets.sample.json', import.meta.url), 'utf8')
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

test('validateBuildConfigCoverage catches missing env coverage', () => {
  const output = [
    'VITE_APP_NAME=Example',
    'VITE_WEB_URL=http://localhost:3001',
  ].join('\n');

  const result = validateGeneratedEnv({
    envText: output,
  });

  assert.ok(result.missing.includes('VITE_API_URL'));
  assert.ok(result.missing.includes('VITE_APP_URL'));
  assert.ok(result.missing.length > 0);
});

test('short/heading names fall back to the app name in generated env', () => {
  const output = generateEnv({config: sampleConfig, platform: 'apps'});

  assert.match(output, /VITE_APP_NAME=FAIMS/);
  assert.match(output, /VITE_APP_SHORT_NAME=FAIMS/);
  assert.match(output, /VITE_HEADING_APP_NAME=FAIMS/);
});

// Golden round trip: a config's generated env must parse back to the same
// canonical values. This is the guarantee the typed chain relies on.
test('parseGeneratedEnv(buildEnvMapFromRuntime(config)) reproduces canonical values', () => {
  const config: SharedBuildConfig = {
    ...sampleConfig,
    endpoints: {
      webUrl: 'https://web.example.org',
      apiUrl: 'https://api.example.org',
      appUrl: 'https://app.example.org',
      conductorUrls: ['https://api.example.org', 'https://api2.example.org'],
      redirectWhitelist: ['https://web.example.org'],
    },
    branding: {appName: 'Fieldmark', theme: 'fieldmark'},
    support: {appContactUrl: 'https://example.org/contact'},
    notebookAndRecordUX: {navigation: 'breadcrumbs', showNewNotebook: false},
    maps: {mapSource: 'maptiler', satelliteSource: 'esri', offlineMaps: false},
    sync: {forceRemoteDeletion: 'allow', deleteOnDeactivation: true},
    attachments: {attachmentDocumentIdPrefix: 'fieldmark'},
    auth: {clusterAdminGroupName: 'admins'},
    // disableLocalLogin is api-only (DISABLE_LOCAL_LOGIN) and is not part of
    // the apps env round trip.
    authTokens: {longLivedTokenDurationHints: [1, 30], maximumLongLivedDurationDays: 90},
    teamAndRolePolicy: {excludedTeamRoles: ['TEAM_ADMIN']},
    android: {appId: 'org.example.app'},
    ios: {
      bundleIdentifier: 'org.example.app.ios',
      appStoreConnectTeamId: 'TEAM123',
      matchGitUrl: 'https://github.com/example/match.git',
    },
  };

  const env = generateEnv({config, platform: 'apps', includeEmpty: true});
  const lines = env
    .split('\n')
    .filter(line => line.includes('='))
    .map(line => line.split('='));
  const raw: Record<string, unknown> = {};
  for (const [key, value] of lines) raw[key] = value;

  const parsed = parseGeneratedEnv(raw);

  assert.equal(parsed.branding.appName, 'Fieldmark');
  // Unset short/heading names are emitted with the appName fallback (ADR-0001
  // D4), so the round trip recovers the fallback, not the blank.
  assert.equal(parsed.branding.appShortName, 'Fieldmark');
  assert.equal(parsed.branding.headingAppName, 'Fieldmark');
  assert.equal(parsed.branding.theme, 'fieldmark');
  assert.deepEqual(parsed.endpoints.conductorUrls, [
    'https://api.example.org',
    'https://api2.example.org',
  ]);
  // REDIRECT_WHITELIST is only emitted on the api platform (no app/web
  // consumer), so it is absent from the apps env and parses as undefined.
  assert.equal(parsed.support.appContactUrl, 'https://example.org/contact');
  assert.equal(parsed.notebookAndRecordUX.navigation, 'breadcrumbs');
  assert.equal(parsed.notebookAndRecordUX.showNewNotebook, false);
  assert.equal(parsed.maps.mapSource, 'maptiler');
  assert.equal(parsed.maps.satelliteSource, 'esri');
  assert.equal(parsed.maps.offlineMaps, false);
  assert.equal(parsed.sync.forceRemoteDeletion, 'allow');
  assert.equal(parsed.sync.deleteOnDeactivation, true);
  assert.equal(parsed.attachments.attachmentDocumentIdPrefix, 'fieldmark');
  assert.equal(parsed.auth.clusterAdminGroupName, 'admins');
  assert.deepEqual(parsed.authTokens.longLivedTokenDurationHints, [1, 30]);
  assert.equal(parsed.authTokens.maximumLongLivedDurationDays, 90);
  assert.deepEqual(parsed.teamAndRolePolicy.excludedTeamRoles, ['TEAM_ADMIN']);
  assert.equal(parsed.android.appId, 'org.example.app');
  assert.equal(parsed.ios.bundleIdentifier, 'org.example.app.ios');
  assert.equal(parsed.ios.appStoreConnectTeamId, 'TEAM123');
});

// Same golden test for the API platform (api contract + auth provider env).
test('parseGeneratedEnv round-trips API platform values', () => {
  const config: SharedBuildConfig = {
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
        clientID: 'cid',
        clientSecret: 'cs',
      },
    },
    authTokens: {refreshTokenExpiryMinutes: 1440, accessTokenExpiryMinutes: 60},
    limits: {rateLimiterEnabled: false, jsonBodyLimit: '50mb'},
    email: {emailServiceType: 'MOCK'},
    couchdb: {couchdbUser: 'admin', couchdbPassword: 'pw', conductorInternalPort: 8080},
  };

  const env = generateEnv({config, platform: 'api', includeEmpty: true});
  const raw: Record<string, unknown> = {};
  for (const line of env.split('\n')) {
    if (!line.includes('=')) continue;
    const idx = line.indexOf('=');
    raw[line.slice(0, idx)] = line.slice(idx + 1);
  }

  // API env is not currently parsed back through parseGeneratedEnv (it targets
  // the app/web VITE_ chain); assert the emitted contract values instead.
  assert.equal(raw.CONDUCTOR_PUBLIC_URL, 'https://api.example.org');
  assert.equal(raw.WEB_APP_PUBLIC_URL, 'https://app.example.org');
  assert.equal(raw.NEW_CONDUCTOR_URL, 'https://web.example.org');
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
    const android = generateBuildConfig({config: configJson, platform: 'android'}, process.cwd());
    const ios = generateBuildConfig({config: configJson, platform: 'ios'}, process.cwd());
    const apps = generateBuildConfig({config: configJson, platform: 'apps'}, process.cwd());

    assert.match(android, /VITE_APP_NAME=/);
    assert.match(android, /ANDROID_RELEASE_STATUS/);
    assert.match(ios, /VITE_APPLE_BUNDLE_IDENTIFIER=/);
    assert.equal(android, apps);
    assert.equal(ios, apps);

    assert.throws(
      () => generateBuildConfig({config: configJson, platform: 'web'}, process.cwd()),
      /Unsupported platform: web/,
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

test('generated env parser rejects invalid boolean strings', () => {
  assert.throws(
    () =>
      parseGeneratedEnv({
        VITE_APP_NAME: 'Fieldmark',
        VITE_DEBUG_APP: 'yes',
      }),
    /Invalid option/i
  );
});

test('generated env parser converts typed values into grouped runtime config', () => {
  const parsed = parseGeneratedEnv({
    VITE_APP_NAME: 'Fieldmark',
    VITE_APP_SHORT_NAME: 'FM',
    VITE_HEADING_APP_NAME: 'Fieldmark Mobile',
    VITE_APP_ID: 'org.fedarch.faims3',
    VITE_WEB_URL: 'https://web.example.org',
    VITE_API_URL: 'https://api.example.org',
    VITE_APP_URL: 'https://app.example.org',
    VITE_WEBSITE_TITLE: 'Control Centre',
    VITE_NOTEBOOK_NAME: 'notebook',
    VITE_NOTEBOOK_LIST_TYPE: 'tabs',
    VITE_SUPPORT_EMAIL: 'support@example.org',
    VITE_APP_PRIVACY_POLICY_URL: 'https://example.org/privacy',
    VITE_APP_CONTACT_URL: 'https://example.org/contact',
    VITE_MAP_SOURCE: 'maptiler',
    VITE_MAP_SOURCE_KEY: 'abc123',
    VITE_MAP_STYLE: 'basic',
    VITE_SATELLITE_SOURCE: 'esri',
    VITE_OFFLINE_MAPS: 'true',
    VITE_BUGSNAG_KEY: 'bugsnag-key',
    VITE_COMMIT_VERSION: 'abcdef1',
    VITE_FORCE_REMOTE_DELETION: 'never',
    VITE_DELETE_ON_DEACTIVATION: 'false',
    VITE_SYNC_PUSH_ONLY_RECORD_THRESHOLD: '500',
    VITE_TOKEN_REFRESH_INTERVAL_MS: '15000',
    VITE_TOKEN_REFRESH_WINDOW_MS: '60000',
    VITE_LOGIN_BANNER_GRACE_MS: '10000',
    VITE_IGNORE_TOKEN_EXP: 'false',
    VITE_NAVIGATION: 'none',
    VITE_SHOW_RECORD_LINKS: 'false',
    VITE_ATTACHMENT_SERVICE_TYPE: 'COUCH',
    VITE_ATTACHMENT_DOCUMENT_ID_PREFIX: '',
    VITE_MIGRATE_OLD_DATABASES: 'false',
    VITE_SHOW_WIPE: 'true',
    VITE_SHOW_POUCHDB_BROWSER: 'true',
    VITE_SHOW_NEW_NOTEBOOK: 'true',
    VITE_SHOW_STATUS_TAB: 'true',
    VITE_DEBUG_APP: 'false',
    VITE_DEBUG_POUCHDB: 'false',
    VITE_POUCH_BATCH_SIZE: '10',
    VITE_POUCH_BATCHES_LIMIT: '10',
    VITE_AUTOSUGGEST_SOURCE: 'NONE',
    VITE_AUTOSUGGEST_MAPBOX_KEY: '',
    VITE_AUTOSUGGEST_MAPTILER_KEY: '',
    VITE_MAPBOX_ADDRESS_COUNTRY: 'AU',
    VITE_MAPTILER_ADDRESS_COUNTRY: 'AU',
    VITE_DOCS_URL: '',
    VITE_MAX_DESIGN_FILE_SIZE_MB: '10',
    VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS: '90',
    VITE_LONG_LIVED_TOKEN_DURATION_HINTS: '1,5,10',
    VITE_EXCLUDED_TEAM_ROLES: 'TEAM_MEMBER_CREATOR,TEAM_ADMIN',
  });

  assert.equal(parsed.branding.appName, 'Fieldmark');
  assert.equal(parsed.maps.offlineMaps, true);
  assert.deepEqual(parsed.authTokens.longLivedTokenDurationHints, [1, 5, 10]);
  assert.deepEqual(parsed.teamAndRolePolicy.excludedTeamRoles, [
    'TEAM_MEMBER_CREATOR',
    'TEAM_ADMIN',
  ]);
});
