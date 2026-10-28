import {parseBuildConfig} from '@faims3/build-config';
import {
  buildFaimsAppBundlingEnv,
  overlayPublicServiceUrls,
} from '../lib/components/front-end';

describe('buildFaimsAppBundlingEnv', () => {
  const env = buildFaimsAppBundlingEnv({
    coreConfig: parseBuildConfig({}),
    conductorUrl: 'https://api.example.com',
    webUrl: 'https://web.example.com',
    appUrl: 'https://app.example.com',
    debugMode: false,
  });

  it('emits contract defaults instead of a second hardcoded mapping', () => {
    expect(env.VITE_CLUSTER_ADMIN_GROUP_NAME).toBe('cluster-admin');
    expect(env.VITE_SHOW_NEW_NOTEBOOK).toBe('true');
    expect(env.VITE_SHOW_RECORD_SUMMARY_COUNTS).toBe('true');
    expect(env.VITE_SHOW_WIPE).toBe('true');
    expect(env.VITE_SHOW_POUCHDB_BROWSER).toBe('true');
  });

  it('overlays CDK-resolved URLs, platform flags, and debug mode', () => {
    expect(env.VITE_CONDUCTOR_URL).toBe('https://api.example.com');
    expect(env.VITE_API_URL).toBe('https://api.example.com');
    expect(env.VITE_WEB_URL).toBe('https://web.example.com');
    expect(env.VITE_APP_URL).toBe('https://app.example.com');
    expect(env.platform).toBe('web');
    expect(env.serverprefix).toBe('fieldmark');
    expect(env.VITE_DEBUG_APP).toBe('false');
    expect(env.VITE_DEBUG_POUCHDB).toBe('false');
  });
});

describe('overlayPublicServiceUrls', () => {
  it('writes the three public service URLs onto an existing env map', () => {
    const env = overlayPublicServiceUrls(
      {VITE_THEME: 'default'},
      {
        webUrl: 'https://web.example.com',
        apiUrl: 'https://api.example.com',
        appUrl: 'https://app.example.com',
      }
    );
    expect(env.VITE_WEB_URL).toBe('https://web.example.com');
    expect(env.VITE_API_URL).toBe('https://api.example.com');
    expect(env.VITE_APP_URL).toBe('https://app.example.com');
    expect(env.VITE_THEME).toBe('default');
  });
});
