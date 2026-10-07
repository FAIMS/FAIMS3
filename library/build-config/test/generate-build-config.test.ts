import test from 'node:test';
import assert from 'node:assert/strict';
import {generateEnv, parseArgs} from '../src/generate-build-config.js';
import {
  buildAuthProviderEnvMap,
  parseBuildConfig,
  parseGeneratedEnv,
  readAuthProviderConfigFromEnv,
  SharedBuildConfig,
} from '../src/build-config.js';
import {validateGeneratedEnv} from '../src/validate-generated-env.js';

const sampleConfig: SharedBuildConfig = {
  urls: {},
  app: {},
  web: {},
  mobile: {
    android: {},
    ios: {},
  },
  api: {},
  secrets: {},
};

test('parseArgs accepts config and platform arguments', () => {
  assert.deepEqual(parseArgs(['--config', 'demo.json', '--platform', 'ios']), {
    config: 'demo.json',
    platform: 'ios',
  });
});

test('generator emits shared app and web env values', () => {
  const output = generateEnv({config: sampleConfig, platform: 'all'});

  assert.match(output, /VITE_APP_NAME=/);
  assert.match(output, /VITE_THEME=/);
  assert.match(output, /VITE_CONDUCTOR_URL=/);
  assert.match(output, /VITE_WEB_URL=/);
  assert.match(output, /VITE_APP_ID=/);
});

test('generator resolves git commit version automatically', () => {
  const output = generateEnv({config: sampleConfig, platform: 'all'});

  assert.match(output, /VITE_COMMIT_VERSION=/);
  assert.doesNotMatch(
    output,
    /VITE_COMMIT_VERSION=output of `git rev-parse HEAD`/
  );
});

test('generator supports platform-specific export selection', () => {
  const config = {
    ...sampleConfig,
    mobile: {
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
    },
  };
  const output = generateEnv({config: config, platform: 'ios'});

  assert.match(output, /VITE_APPLE_BUNDLE_IDENTIFIER=/);
  assert.match(output, /VITE_APP_STORE_CONNECT_TEAM_ID=/);
  assert.match(output, /FASTLANE_APPLE_ID=/);
  assert.doesNotMatch(output, /ANDROID_RELEASE_STATUS=/);
});

test('generator supports api platform export selection', () => {
  const config = {
    ...sampleConfig,
    api: {
      profileName: 'dev-profile',
      keyFilePath: '.',
      conductorInstanceName: 'Development FAIMS Server',
      conductorDescription: 'Development server on localhost',
      conductorShortCodePrefix: 'DEV',
      couchdbUser: 'admin',
      couchdbPassword: 'secret',
      keySource: 'FILE',
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
      provisionSsoUsersPolicy: 'reject',
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
    },
  };

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

test('generator emits Android base64 secrets when provided', () => {
  const config = {
    ...sampleConfig,
    mobile: {
      ...sampleConfig.mobile,
      android: {
        keystoreFileBase64: 'encoded-keystore',
        serviceAccountKeyJsonBase64: 'encoded-service-account',
      },
    },
  };

  const output = generateEnv({config, platform: 'android'});

  assert.match(output, /KEYSTORE_FILE=encoded-keystore/);
  assert.match(
    output,
    /GPLAY_SERVICE_ACCOUNT_KEY_JSON=encoded-service-account/
  );
});

test('generator falls back to iOS individual key values', () => {
  const config = {
    ...sampleConfig,
    mobile: {
      ...sampleConfig.mobile,
      ios: {
        appleIndividualKeyId: 'ind-key-id',
        appleIndividualKeyContent: 'ind-key-content',
      },
    },
  };

  const output = generateEnv({config, platform: 'ios'});

  assert.match(output, /APPLE_KEY_ID=ind-key-id/);
  assert.match(output, /APPLE_KEY_CONTENT=ind-key-content/);
});

test('generator escapes multiline values for env-file compatibility', () => {
  const config = {
    ...sampleConfig,
    mobile: {
      ...sampleConfig.mobile,
      ios: {
        appleKeyContent:
          '\n-----BEGIN PRIVATE KEY-----\nABCDEF\n-----END PRIVATE KEY-----\n',
      },
    },
  };

  const output = generateEnv({config, platform: 'ios'});

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

test('generated env parser converts typed values into runtime config', () => {
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

  assert.equal(parsed.shared.branding.appName, 'Fieldmark');
  assert.equal(parsed.shared.maps.offlineMaps, true);
  assert.deepEqual(parsed.web.longLivedTokenDurationHints, [1, 5, 10]);
  assert.deepEqual(parsed.web.excludedTeamRoles, [
    'TEAM_MEMBER_CREATOR',
    'TEAM_ADMIN',
  ]);
});
