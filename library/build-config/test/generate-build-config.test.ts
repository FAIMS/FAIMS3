import test from 'node:test';
import assert from 'node:assert/strict';
import {generateEnv, parseArgs} from '../src/generate-build-config.ts';
import {
  getExpectedKeys,
  validateGeneratedEnv,
} from '../src/validate-generated-env.ts';
import {SharedBuildConfig} from '../src/build-config.ts';

const sampleConfig: SharedBuildConfig = {
  app: {},
  web: {},
  mobile: {
    android: {},
    ios: {},
  },
  build: {},
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

test('generator can emit a maximal env inventory including blank values', () => {
  const output = generateEnv({
    config: sampleConfig,
    platform: 'all',
    includeEmpty: true,
  });

  assert.match(output, /VITE_APP_CONTACT_URL=/);
  assert.match(output, /VITE_AUTOSUGGEST_MAPBOX_KEY=/);
});

test('generator supports platform-specific export selection', () => {
  const config = {
    ...sampleConfig,
    mobile: {
      ios: {
        bundleIdentifier: 'au.edu.faims.electronicfieldnotebook',
        developerPortalTeamId: 'ABCDE12345',
        appleId: 'developer@apple.com',
      },
      android: {
        appId: 'org.fedarch.faims3',
        releaseStatus: 'draft',
        deployTrack: 'production',
      },
    },
  };
  const output = generateEnv({config: config, platform: 'ios'});

  assert.match(output, /VITE_APPLE_BUNDLE_IDENTIFIER=/);
  assert.match(output, /VITE_APP_STORE_CONNECT_TEAM_ID=/);
  assert.match(output, /FASTLANE_APPLE_ID=/);
  assert.doesNotMatch(output, /ANDROID_RELEASE_STATUS=/);
});

test('generator emits app and web runtime config keys used by the runtime', () => {
  const output = generateEnv({
    config: {
      ...sampleConfig,
      app: {
        directoryUsername: 'demo-user',
        directoryPassword: 'demo-pass',
        syncPushOnlyRecordThreshold: 900,
        tokenRefreshIntervalMs: 20000,
        tokenRefreshWindowMs: 45000,
        loginBannerGraceMs: 12000,
        ignoreTokenExp: true,
        navigation: 'breadcrumbs',
        showRecordLinks: true,
        attachmentServiceType: 'COUCH',
        attachmentDocumentIdPrefix: 'fieldmark',
      },
      web: {
        docsUrl: 'https://docs.example.com',
        bugsnagApiKey: 'demo-bugsnag-key',
        maxDesignFileSizeMb: 25,
        maximumLongLivedDurationDays: 180,
        longLivedTokenDurationHints: [1, 7, 30, 90, 180],
      },
    },
    platform: 'all',
    includeEmpty: true,
  });

  assert.match(output, /VITE_DIRECTORY_USERNAME=demo-user/);
  assert.match(output, /VITE_DIRECTORY_PASSWORD=demo-pass/);
  assert.match(output, /VITE_SYNC_PUSH_ONLY_RECORD_THRESHOLD=900/);
  assert.match(output, /VITE_TOKEN_REFRESH_INTERVAL_MS=20000/);
  assert.match(output, /VITE_TOKEN_REFRESH_WINDOW_MS=45000/);
  assert.match(output, /VITE_LOGIN_BANNER_GRACE_MS=12000/);
  assert.match(output, /VITE_IGNORE_TOKEN_EXP=true/);
  assert.match(output, /VITE_NAVIGATION=breadcrumbs/);
  assert.match(output, /VITE_SHOW_RECORD_LINKS=true/);
  assert.match(output, /VITE_ATTACHMENT_SERVICE_TYPE=COUCH/);
  assert.match(output, /VITE_ATTACHMENT_DOCUMENT_ID_PREFIX=fieldmark/);
  assert.match(output, /VITE_DOCS_URL=https:\/\/docs.example.com/);
  assert.match(output, /VITE_BUGSNAG_API_KEY=demo-bugsnag-key/);
  assert.match(output, /VITE_MAX_DESIGN_FILE_SIZE_MB=25/);
  assert.match(output, /VITE_MAXIMUM_LONG_LIVED_DURATION_DAYS=180/);
  assert.match(output, /VITE_LONG_LIVED_TOKEN_DURATION_HINTS=1,7,30,90,180/);
});

test('validator catches missing and stale generated keys', () => {
  const generated = [
    'VITE_APP_NAME=Fieldmark',
    'VITE_WEB_URL=http://localhost:3001',
    'VITE_APP_URL=http://localhost:3000',
    'VITE_OLD_FLAG=something-stale',
  ].join('\n');

  const result = validateGeneratedEnv({
    envText: generated,
  });

  assert.equal(result.ok, false);
  assert.ok(result.missing.length > 0);
  assert.ok(result.unexpected.includes('VITE_OLD_FLAG'));
});

test('validator derives platform env keys from fastlane files', () => {
  const expected = getExpectedKeys();

  assert.ok(expected.has('FASTLANE_APPLE_ID'));
  assert.ok(expected.has('APPLE_KEY_ID'));
  assert.ok(expected.has('DEVELOPER_APP_ID'));
  assert.ok(expected.has('VITE_APPLE_BUNDLE_IDENTIFIER'));
  assert.ok(expected.has('MATCH_GIT_URL'));
});
