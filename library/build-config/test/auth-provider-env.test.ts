import test from 'node:test';
import assert from 'node:assert/strict';
import {readAuthProviderConfigFromEnv} from '../src/build-config';

/**
 * Tests for readAuthProviderConfigFromEnv - the env -> typed auth provider map
 * parser that lives in build-config (the single source of truth for these
 * config types). Ported from the former api package's authConfig.test.ts,
 * adapted to the (env object) signature and to build-config's coercion
 * semantics (native array/boolean shapes, D3 boolean vocabulary, and the
 * "Warning: dropping auth provider" diagnostic).
 */

function withNoConsoleWarn<T>(fn: () => T): {result: T; warned: boolean} {
  const before = console.warn;
  let warned = false;
  console.warn = (..._args) => {
    warned = true;
  };
  let result: T;
  try {
    result = fn();
  } finally {
    console.warn = before;
  }
  return {result, warned};
}

test('returns {} when there are no AUTH_ env vars', () => {
  assert.deepEqual(readAuthProviderConfigFromEnv({}), {});
});

test('parses a google provider, defaulting index and callbackMethods', () => {
  const env = {
    AUTH_GOOGLE_TYPE: 'google',
    AUTH_GOOGLE_DISPLAY_NAME: 'Google',
    AUTH_GOOGLE_HELPER_TEXT: 'Log in with your Google account',
    AUTH_GOOGLE_CLIENT_ID: 'google-client-id',
    AUTH_GOOGLE_CLIENT_SECRET: 'google-client-secret',
    AUTH_GOOGLE_SCOPE: 'profile,email',
  };
  const result = readAuthProviderConfigFromEnv(env);
  assert.deepEqual(result.google, {
    id: 'google',
    index: 100, // index defaults to 100 when not supplied
    type: 'google',
    displayName: 'Google',
    helperText: 'Log in with your Google account',
    clientID: 'google-client-id',
    clientSecret: 'google-client-secret',
    scope: ['profile', 'email'],
    callbackMethods: ['GET'], // schema default
  });
});

test('parses an oidc provider with a supplied index', () => {
  const env = {
    AUTH_AAF_TYPE: 'oidc',
    AUTH_AAF_DISPLAY_NAME: 'AAF',
    AUTH_AAF_INDEX: '50',
    AUTH_AAF_ISSUER: 'https://central.test.aaf.edu.au',
    AUTH_AAF_AUTHORIZATION_URL: 'https://central.test.aaf.edu.au/oidc/authorize',
    AUTH_AAF_TOKEN_URL: 'https://central.test.aaf.edu.au/oidc/token',
    AUTH_AAF_USER_INFO_URL: 'https://central.test.aaf.edu.au/oidc/userinfo',
    AUTH_AAF_CLIENT_ID: 'aaf-client-id',
    AUTH_AAF_CLIENT_SECRET: 'aaf-client-secret',
    AUTH_AAF_SCOPE: 'profile,email',
  };
  const result = readAuthProviderConfigFromEnv(env);
  assert.deepEqual(result.aaf, {
    id: 'aaf',
    index: 50,
    type: 'oidc',
    displayName: 'AAF',
    issuer: 'https://central.test.aaf.edu.au',
    authorizationURL: 'https://central.test.aaf.edu.au/oidc/authorize',
    tokenURL: 'https://central.test.aaf.edu.au/oidc/token',
    userInfoURL: 'https://central.test.aaf.edu.au/oidc/userinfo',
    clientID: 'aaf-client-id',
    clientSecret: 'aaf-client-secret',
    scope: ['profile', 'email'],
    callbackMethods: ['GET'],
  });
});

test('parses multiple providers at once', () => {
  const env = {
    AUTH_GOOGLE_TYPE: 'google',
    AUTH_GOOGLE_DISPLAY_NAME: 'Google',
    AUTH_GOOGLE_CLIENT_ID: 'google-client-id',
    AUTH_GOOGLE_CLIENT_SECRET: 'google-client-secret',
    AUTH_GOOGLE_SCOPE: 'profile,email',
    AUTH_AAF_TYPE: 'oidc',
    AUTH_AAF_DISPLAY_NAME: 'AAF',
    AUTH_AAF_ISSUER: 'https://central.test.aaf.edu.au',
    AUTH_AAF_AUTHORIZATION_URL: 'https://central.test.aaf.edu.au/oidc/authorize',
    AUTH_AAF_TOKEN_URL: 'https://central.test.aaf.edu.au/oidc/token',
    AUTH_AAF_USER_INFO_URL: 'https://central.test.aaf.edu.au/oidc/userinfo',
    AUTH_AAF_CLIENT_ID: 'aaf-client-id',
    AUTH_AAF_CLIENT_SECRET: 'aaf-client-secret',
    AUTH_AAF_SCOPE: 'profile,email',
  };
  const result = readAuthProviderConfigFromEnv(env);
  assert.deepEqual(Object.keys(result).sort(), ['aaf', 'google']);
});

test('splits CSV array values and trims whitespace', () => {
  const env = {
    AUTH_GOOG_TYPE: 'google',
    AUTH_GOOG_DISPLAY_NAME: 'Google',
    AUTH_GOOG_CLIENT_ID: 'google-client-id',
    AUTH_GOOG_CLIENT_SECRET: 'google-client-secret',
    AUTH_GOOG_SCOPE: 'profile,        email         ,openid',
  };
  const result = readAuthProviderConfigFromEnv(env);
  assert.deepEqual(result.goog?.scope, ['profile', 'email', 'openid']);
});

test('maps SAML *_URL env keys to camelCase fields and applies SAML defaults', () => {
  const env = {
    AUTH_VG_TYPE: 'saml',
    AUTH_VG_DISPLAY_NAME: 'Vanguard',
    AUTH_VG_SCOPE: 'profile,email',
    AUTH_VG_ENTRY_POINT: 'https://idp.example/sso',
    AUTH_VG_ISSUER: 'https://sp.example/',
    AUTH_VG_IDP_PUBLIC_KEY: 'MIIB',
    AUTH_VG_METADATA_ERROR_URL: 'https://conductor.example/auth/vg/sso-error',
    AUTH_VG_SSO_ERROR_PAGE_RETURN_URL: 'https://web.example/',
  };
  const result = readAuthProviderConfigFromEnv(env);
  const vg = result.vg;
  assert.equal(vg?.type, 'saml');
  assert.equal(vg?.metadataErrorURL, 'https://conductor.example/auth/vg/sso-error');
  assert.equal(vg?.ssoErrorPageReturnURL, 'https://web.example/');
  // SAML-specific defaults
  assert.deepEqual(vg?.callbackMethods, ['POST']);
  assert.equal(vg?.authnRequestBinding, 'HTTP-POST');
  assert.equal(vg?.signMetadata, false);
});

test('drops an invalid provider with a warning but keeps a valid sibling', () => {
  const env = {
    AUTH_GOOGLE_TYPE: 'google',
    AUTH_GOOGLE_DISPLAY_NAME: 'Google',
    AUTH_GOOGLE_CLIENT_ID: 'google-client-id',
    AUTH_GOOGLE_CLIENT_SECRET: 'google-client-secret',
    AUTH_GOOGLE_SCOPE: 'profile,email',
    // A provider whose type matches no known provider -> invalid.
    AUTH_TEST_TYPE: 'unknown-type',
    AUTH_TEST_DISPLAY_NAME: 'Test Provider',
  };
  const {result, warned} = withNoConsoleWarn(() =>
    readAuthProviderConfigFromEnv(env)
  );
  assert.equal(warned, true);
  assert.ok(result.google);
  assert.equal('test' in result, false);
});

test('a leftover non-provider AUTH_ var does not wipe valid providers', () => {
  const env = {
    AUTH_GOOGLE_TYPE: 'google',
    AUTH_GOOGLE_DISPLAY_NAME: 'Google',
    AUTH_GOOGLE_CLIENT_ID: 'google-client-id',
    AUTH_GOOGLE_CLIENT_SECRET: 'google-client-secret',
    AUTH_GOOGLE_SCOPE: 'profile,email',
    // Old env name still matches AUTH_{PROVIDER}_{PROPERTY}; a leftover local
    // .env must not cause the configured providers to be dropped.
    AUTH_ATTEMPT_LIMITER_ENABLED: 'false',
  };
  const {result, warned} = withNoConsoleWarn(() =>
    readAuthProviderConfigFromEnv(env)
  );
  assert.equal(warned, true);
  assert.ok(result.google);
  assert.equal('attempt' in result, false);
});
