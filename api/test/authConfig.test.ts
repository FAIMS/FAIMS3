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

import {expect} from 'chai';
import sinon from 'sinon';
import {readAuthProviderConfigFromEnv} from '../src/auth/strategies/applyStrategies';

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
    expect(Object.getOwnPropertyNames(result).length).to.equal(0);
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

    expect(result).to.not.be.null;
    expect(result).to.have.property('google');
    expect(result?.google).to.deep.equal({
      id: 'google',
      type: 'google',
      displayName: 'Google',
      helperText: 'Log in with your Google account',
      clientID: 'google-client-id',
      clientSecret: 'google-client-secret',
      scope: ['profile', 'email', 'https://www.googleapis.com/auth/plus.login'],
    });
  });

  it('should parse a valid OIDC provider configuration', () => {
    // Configure environment with OIDC provider
    process.env.AUTH_AAF_TYPE = 'oidc';
    process.env.AUTH_AAF_DISPLAY_NAME = 'AAF';
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

    expect(result).to.not.be.null;
    expect(result).to.have.property('aaf');
    expect(result?.aaf).to.deep.equal({
      id: 'aaf',
      type: 'oidc',
      displayName: 'AAF',
      helperText: 'Use your Australian University credentials',
      issuer: 'https://central.test.aaf.edu.au',
      authorizationURL: 'https://central.test.aaf.edu.au/oidc/authorize',
      tokenURL: 'https://central.test.aaf.edu.au/oidc/token',
      userInfoURL: 'https://central.test.aaf.edu.au/oidc/userinfo',
      clientID: 'aaf-client-id',
      clientSecret: 'aaf-client-secret',
      scope: ['profile', 'email'],
    });
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

    expect(result).to.not.be.null;
    expect(result).to.have.property('google');
    expect(result).to.have.property('aaf');
    expect(Object.keys(result || {})).to.have.lengthOf(2);
  });

  it('should properly parse array values', () => {
    process.env.AUTH_GOOG_TYPE = 'google';
    process.env.AUTH_GOOG_DISPLAY_NAME = 'Google';
    process.env.AUTH_GOOG_HELPER_TEXT = 'Log in with your Google account';
    process.env.AUTH_GOOG_CLIENT_ID = 'google-client-id';
    process.env.AUTH_GOOG_CLIENT_SECRET = 'google-client-secret';
    process.env.AUTH_GOOG_SCOPE = 'profile,        email         ,openid';

    const result = readAuthProviderConfigFromEnv();

    expect(result?.goog).to.have.property('scope');
    expect(result?.goog.scope).to.deep.equal(['profile', 'email', 'openid']);
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
    const consoleWarnStub = sinon.stub(console, 'warn');

    const result = readAuthProviderConfigFromEnv();

    expect(result?.gle).to.have.property('type', 'google');
    expect(
      consoleWarnStub.calledWith(sinon.match(/Ignoring unrecognized env var/))
    ).to.be.true;

    consoleWarnStub.restore();
  });

  it('should return null and log errors when validation fails', () => {
    // Missing required fields
    process.env.AUTH_TEST_TYPE = 'unknown-type'; // invalid type
    process.env.AUTH_TEST_DISPLAY_NAME = 'Test Provider';

    // Mock console.error to verify it's called
    const consoleErrorStub = sinon.stub(console, 'error');

    const result = readAuthProviderConfigFromEnv();

    expect(result).to.be.null;
    expect(
      consoleErrorStub.calledWith(
        sinon.match(/Error parsing auth provider config from env/),
        sinon.match.any
      )
    ).to.be.true;

    consoleErrorStub.restore();
  });
});
