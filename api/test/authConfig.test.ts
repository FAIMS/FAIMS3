/*
 * Copyright 2025 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: authConfig.test.ts
 * Description:
 *   Tests for the auth provider configuration reading functionality
 */

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {readAuthProviderConfigFromEnv} from '../src/auth/strategies/applyStrategies';
import {
  GoogleAuthProviderConfig,
  OIDCAuthProviderConfig,
  SAMLAuthProviderConfig,
} from '../src/auth/strategies/strategyTypes';

describe('readAuthProviderConfigFromEnv', () => {
  const originalEnv = process.env;
  let env: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Create a clean environment for each test
    env = {...originalEnv};

    // Remove any existing AUTH_ variables
    Object.keys(env).forEach(key => {
      if (key.startsWith('AUTH_')) {
        delete env[key];
      }
    });

    // Replace process.env with our clean copy
    process.env = env;
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  it('should return {} when no AUTH_ environment variables are defined', () => {
    const result = readAuthProviderConfigFromEnv();
    expect(Object.getOwnPropertyNames(result).length).toBe(0);
  });

  it('should parse a valid Google provider configuration', () => {
    // Configure environment with Google provider
    process.env.AUTH_GOOGLE_TYPE = 'google';
    process.env.AUTH_GOOGLE_DISPLAY_NAME = 'Google';
    process.env.AUTH_GOOGLE_HELPER_TEXT = 'Log in with your Google account';
    process.env.AUTH_GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.AUTH_GOOGLE_CLIENT_SECRET = 'google-client-secret';
    process.env.AUTH_GOOGLE_SCOPE =
      'profile,email,https://www.googleapis.com/auth/plus.login';

    const result = readAuthProviderConfigFromEnv();

    expect(result).not.toBeNull();
    expect(result).toHaveProperty('google');
    expect(result?.google).toEqual({
      id: 'google',
      index: 100, // index should be defaulted to 100
      type: 'google',
      displayName: 'Google',
      helperText: 'Log in with your Google account',
      clientID: 'google-client-id',
      clientSecret: 'google-client-secret',
      scope: ['profile', 'email', 'https://www.googleapis.com/auth/plus.login'],
      callbackMethods: ['GET'],
    } satisfies GoogleAuthProviderConfig);
  });

  it('should parse a valid OIDC provider configuration', () => {
    // Configure environment with OIDC provider
    process.env.AUTH_AAF_TYPE = 'oidc';
    process.env.AUTH_AAF_DISPLAY_NAME = 'AAF';
    process.env.AUTH_AAF_INDEX = '50';
    process.env.AUTH_AAF_HELPER_TEXT =
      'Use your Australian University credentials';
    process.env.AUTH_AAF_ISSUER = 'https://central.test.aaf.edu.au';
    process.env.AUTH_AAF_AUTHORIZATION_URL =
      'https://central.test.aaf.edu.au/oidc/authorize';
    process.env.AUTH_AAF_TOKEN_URL =
      'https://central.test.aaf.edu.au/oidc/token';
    process.env.AUTH_AAF_USER_INFO_URL =
      'https://central.test.aaf.edu.au/oidc/userinfo';
    process.env.AUTH_AAF_CLIENT_ID = 'aaf-client-id';
    process.env.AUTH_AAF_CLIENT_SECRET = 'aaf-client-secret';
    process.env.AUTH_AAF_SCOPE = 'profile,email';

    const result = readAuthProviderConfigFromEnv();

    expect(result).not.toBeNull();
    expect(result).toHaveProperty('aaf');
    expect(result?.aaf).toEqual({
      id: 'aaf',
      type: 'oidc',
      index: 50, // supplied index
      displayName: 'AAF',
      helperText: 'Use your Australian University credentials',
      issuer: 'https://central.test.aaf.edu.au',
      authorizationURL: 'https://central.test.aaf.edu.au/oidc/authorize',
      tokenURL: 'https://central.test.aaf.edu.au/oidc/token',
      userInfoURL: 'https://central.test.aaf.edu.au/oidc/userinfo',
      clientID: 'aaf-client-id',
      clientSecret: 'aaf-client-secret',
      scope: ['profile', 'email'],
      callbackMethods: ['GET'],
    } satisfies OIDCAuthProviderConfig);
  });

  it('should handle multiple providers simultaneously', () => {
    // Configure Google provider
    process.env.AUTH_GOOGLE_TYPE = 'google';
    process.env.AUTH_GOOGLE_DISPLAY_NAME = 'Google';
    process.env.AUTH_GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.AUTH_GOOGLE_CLIENT_SECRET = 'google-client-secret';
    process.env.AUTH_GOOGLE_SCOPE = 'profile,email';

    // Configure OIDC provider
    process.env.AUTH_AAF_TYPE = 'oidc';
    process.env.AUTH_AAF_DISPLAY_NAME = 'AAF';
    process.env.AUTH_AAF_ISSUER = 'https://central.test.aaf.edu.au';
    process.env.AUTH_AAF_AUTHORIZATION_URL =
      'https://central.test.aaf.edu.au/oidc/authorize';
    process.env.AUTH_AAF_TOKEN_URL =
      'https://central.test.aaf.edu.au/oidc/token';
    process.env.AUTH_AAF_USER_INFO_URL =
      'https://central.test.aaf.edu.au/oidc/userinfo';
    process.env.AUTH_AAF_CLIENT_ID = 'aaf-client-id';
    process.env.AUTH_AAF_CLIENT_SECRET = 'aaf-client-secret';
    process.env.AUTH_AAF_SCOPE = 'profile,email';

    const result = readAuthProviderConfigFromEnv();

    expect(result).not.toBeNull();
    expect(result).toHaveProperty('google');
    expect(result).toHaveProperty('aaf');
    expect(Object.keys(result || {})).toHaveLength(2);
  });

  it('should properly parse array values', () => {
    process.env.AUTH_GOOG_TYPE = 'google';
    process.env.AUTH_GOOG_DISPLAY_NAME = 'Google';
    process.env.AUTH_GOOG_HELPER_TEXT = 'Log in with your Google account';
    process.env.AUTH_GOOG_CLIENT_ID = 'google-client-id';
    process.env.AUTH_GOOG_CLIENT_SECRET = 'google-client-secret';
    process.env.AUTH_GOOG_SCOPE = 'profile,        email         ,openid';

    const result = readAuthProviderConfigFromEnv();

    expect(result?.goog).toHaveProperty('scope');
    expect(result?.goog.scope).toEqual(['profile', 'email', 'openid']);
  });

  it('should ignore environment variables that do not match the pattern', () => {
    process.env.AUTH_GLE_TYPE = 'google';
    process.env.AUTH_GLE_DISPLAY_NAME = 'Google';
    process.env.AUTH_GLE_HELPER_TEXT = 'Log in with your Google account';
    process.env.AUTH_GLE_CLIENT_ID = 'google-client-id';
    process.env.AUTH_GLE_CLIENT_SECRET = 'google-client-secret';
    process.env.AUTH_GLE_SCOPE = 'profile,email';
    process.env.AUTH_INVALID = 'this should be ignored';

    // Mock console.warn to verify it's called
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {});

    const result = readAuthProviderConfigFromEnv();

    expect(result?.gle).toHaveProperty('type', 'google');
    expect(
      consoleWarnSpy.mock.calls.some(
        call =>
          typeof call[0] === 'string' &&
          /Ignoring unrecognized env var/.test(call[0])
      )
    ).toBe(true);

    consoleWarnSpy.mockRestore();
  });

  it('maps SAML *_URL env keys from CDK to schema ...Url camelCase fields', () => {
    process.env.AUTH_VG_TYPE = 'saml';
    process.env.AUTH_VG_DISPLAY_NAME = 'Vanguard';
    process.env.AUTH_VG_SCOPE = 'profile,email';
    process.env.AUTH_VG_ENTRY_POINT = 'https://idp.example/sso';
    process.env.AUTH_VG_ISSUER = 'https://sp.example/';
    process.env.AUTH_VG_IDP_PUBLIC_KEY = 'MIIB';
    process.env.AUTH_VG_METADATA_ERROR_URL =
      'https://conductor.example/auth/vg/sso-error';
    process.env.AUTH_VG_SSO_ERROR_PAGE_RETURN_URL = 'https://web.example/';

    const result = readAuthProviderConfigFromEnv();

    expect(result).not.toBeNull();
    const vg = result?.vg as SAMLAuthProviderConfig;
    expect(vg.type).toBe('saml');
    expect(vg.metadataErrorURL).toBe(
      'https://conductor.example/auth/vg/sso-error'
    );
    expect(vg.ssoErrorPageReturnURL).toBe('https://web.example/');
    // Default to HTTP-POST
    expect(vg.authnRequestBinding).toBe('HTTP-POST');
  });

  it('parses SAML authnRequestBinding HTTP-POST from env', () => {
    process.env.AUTH_VG_TYPE = 'saml';
    process.env.AUTH_VG_DISPLAY_NAME = 'Vanguard';
    process.env.AUTH_VG_SCOPE = 'profile,email';
    process.env.AUTH_VG_ENTRY_POINT = 'https://idp.example/sso';
    process.env.AUTH_VG_ISSUER = 'https://sp.example/';
    process.env.AUTH_VG_IDP_PUBLIC_KEY = 'MIIB';
    process.env.AUTH_VG_AUTHN_REQUEST_BINDING = 'HTTP-POST';

    const result = readAuthProviderConfigFromEnv();

    expect(result).not.toBeNull();
    const vg = result?.vg as SAMLAuthProviderConfig;
    expect(vg.authnRequestBinding).toBe('HTTP-POST');
  });

  it('parses SAML skipRequestCompression from env', () => {
    process.env.AUTH_VG_TYPE = 'saml';
    process.env.AUTH_VG_DISPLAY_NAME = 'Vanguard';
    process.env.AUTH_VG_SCOPE = 'profile,email';
    process.env.AUTH_VG_ENTRY_POINT = 'https://idp.example/sso';
    process.env.AUTH_VG_ISSUER = 'https://sp.example/';
    process.env.AUTH_VG_IDP_PUBLIC_KEY = 'MIIB';
    process.env.AUTH_VG_SKIP_REQUEST_COMPRESSION = 'true';

    const result = readAuthProviderConfigFromEnv();

    expect(result).not.toBeNull();
    const vg = result?.vg as SAMLAuthProviderConfig;
    expect(vg.skipRequestCompression).toBe(true);
  });

  it('should return null and log errors when validation fails', () => {
    // Missing required fields
    process.env.AUTH_TEST_TYPE = 'unknown-type'; // invalid type
    process.env.AUTH_TEST_DISPLAY_NAME = 'Test Provider';

    // Mock console.error to verify it's called
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const result = readAuthProviderConfigFromEnv();

    expect(result).toBeNull();
    expect(
      consoleErrorSpy.mock.calls.some(
        call =>
          typeof call[0] === 'string' &&
          /Error parsing auth provider config from env/.test(call[0])
      )
    ).toBe(true);

    consoleErrorSpy.mockRestore();
  });
});
