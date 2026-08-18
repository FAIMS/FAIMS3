import test from 'node:test';
import assert from 'node:assert/strict';
import {generateEnv, parseArgs} from '../src/generate-build-config.ts';
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
