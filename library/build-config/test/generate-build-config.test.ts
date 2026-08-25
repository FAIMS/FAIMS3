import test from 'node:test';
import assert from 'node:assert/strict';
import {generateEnv, parseArgs} from '../src/generate-build-config.js';
import {SharedBuildConfig} from '../src/build-config.js';
import {validateGeneratedEnv} from '../src/validate-generated-env.js';

const sampleConfig: SharedBuildConfig = {
  urls: {},
  app: {},
  web: {},
  mobile: {
    android: {},
    ios: {},
  },
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
