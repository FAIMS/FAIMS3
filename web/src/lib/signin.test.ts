// SPDX-License-Identifier: Apache-2.0
import {afterEach, describe, expect, it, vi} from 'vitest';

vi.mock('@/constants', () => ({
  config: {
    signinPath: 'http://localhost:8080/login?redirect=http://localhost:3001/',
  },
}));

import {
  buildSigninPath,
  clearReloginEmail,
  loginIdentifierFromUser,
  peekReloginEmail,
  signinPathForExpiredSession,
  stashReloginEmail,
} from './signin';

describe('loginIdentifierFromUser', () => {
  it('returns the email only for local-profile users', () => {
    expect(
      loginIdentifierFromUser({
        email: 'local@example.com',
        hasLocalProfile: true,
      })
    ).toBe('local@example.com');
  });

  it('omits SSO-only users even when an email is present', () => {
    expect(
      loginIdentifierFromUser({
        email: 'oidc@example.com',
        hasLocalProfile: false,
      })
    ).toBeUndefined();
  });

  it('omits users that predate the hasLocalProfile field', () => {
    expect(
      loginIdentifierFromUser({email: 'legacy@example.com'})
    ).toBeUndefined();
  });
});

describe('buildSigninPath', () => {
  it('leaves the base sign-in URL unchanged when no email is given', () => {
    expect(buildSigninPath()).toBe(
      'http://localhost:8080/login?redirect=http://localhost:3001/'
    );
  });

  it('appends a local-login email without dropping the redirect', () => {
    const url = new URL(buildSigninPath('local@example.com'));
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('redirect')).toBe('http://localhost:3001/');
    expect(url.searchParams.get('email')).toBe('local@example.com');
  });
});

describe('relogin email stash', () => {
  afterEach(() => {
    clearReloginEmail();
  });

  it('round-trips a stashed identifier and clears it', () => {
    stashReloginEmail('local@example.com');
    expect(peekReloginEmail()).toBe('local@example.com');
    clearReloginEmail();
    expect(peekReloginEmail()).toBeUndefined();
  });

  it('uses the stash when the stored user is already gone', () => {
    stashReloginEmail('stashed@example.com');
    expect(signinPathForExpiredSession(null)).toContain(
      'email=stashed%40example.com'
    );
  });
});
