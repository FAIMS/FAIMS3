// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {googleStrategyGenerator} from '../src/auth/strategies/googleStrategy';
import {oidcStrategyGenerator} from '../src/auth/strategies/oidcStrategy';
import {samlStrategyGenerator} from '../src/auth/strategies/samlStrategy';

describe('auth strategy generators fail fast on missing credentials', () => {
  it('googleStrategyGenerator throws when clientID or clientSecret is empty', () => {
    expect(() =>
      googleStrategyGenerator({
        id: 'google',
        type: 'google',
        displayName: 'Google',
        scope: ['profile'],
        callbackMethods: ['GET'],
        clientID: '',
        clientSecret: 'secret',
      })
    ).toThrow(/missing required clientID or clientSecret/);
    expect(() =>
      googleStrategyGenerator({
        id: 'google',
        type: 'google',
        displayName: 'Google',
        scope: ['profile'],
        callbackMethods: ['GET'],
        clientID: 'id',
        clientSecret: '',
      })
    ).toThrow(/missing required clientID or clientSecret/);
  });

  it('oidcStrategyGenerator throws when clientID or clientSecret is empty', () => {
    const base = {
      id: 'aaf',
      type: 'oidc' as const,
      displayName: 'AAF',
      scope: ['profile'],
      callbackMethods: ['GET'] as ('GET' | 'POST')[],
      issuer: 'https://idp.example.com',
      authorizationURL: 'https://idp.example.com/auth',
      tokenURL: 'https://idp.example.com/token',
      userInfoURL: 'https://idp.example.com/userinfo',
    };
    expect(() =>
      oidcStrategyGenerator({...base, clientID: '', clientSecret: 'secret'})
    ).toThrow(/missing required clientID or clientSecret/);
    expect(() =>
      oidcStrategyGenerator({...base, clientID: 'id', clientSecret: ''})
    ).toThrow(/missing required clientID or clientSecret/);
  });

  it('samlStrategyGenerator throws when idpPublicKey is empty', () => {
    expect(() =>
      samlStrategyGenerator({
        id: 'saml',
        type: 'saml',
        displayName: 'SAML',
        scope: [],
        callbackMethods: ['POST'],
        entryPoint: 'https://idp.example.com/sso',
        issuer: 'https://sp.example.com',
        authnRequestBinding: 'HTTP-POST',
        signMetadata: false,
        digestAlgorithm: 'sha256',
        idpPublicKey: '',
      })
    ).toThrow(/missing required idpPublicKey/);
  });
});
