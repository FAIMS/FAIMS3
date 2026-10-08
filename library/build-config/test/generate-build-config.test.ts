import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {generateEnv, parseArgs} from '../src/generate-build-config';
import {
  buildAuthProviderEnvMap,
  parseBuildConfig,
  parseGeneratedEnv,
  readAuthProviderConfigFromEnv,
  SharedBuildConfig,
} from '../src/build-config';
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
  secrets: {},
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
    secrets: {},
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
