// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from 'vitest';
import {
  authReturnRedirect,
  conductorLoginUrl,
  localReauthIdentifier,
} from './conductorLoginUrl';

describe('conductorLoginUrl', () => {
  it('builds a login URL with redirect only', () => {
    expect(
      conductorLoginUrl({
        conductorUrl: 'https://conductor.example/',
        redirect: 'org.example://auth-return',
      })
    ).toBe(
      'https://conductor.example/login?redirect=org.example%3A%2F%2Fauth-return'
    );
  });

  it('includes a local-login email when provided', () => {
    const url = new URL(
      conductorLoginUrl({
        conductorUrl: 'https://conductor.example',
        redirect: 'https://app.example/auth-return',
        email: 'local@example.com',
      })
    );
    expect(url.searchParams.get('redirect')).toBe(
      'https://app.example/auth-return'
    );
    expect(url.searchParams.get('email')).toBe('local@example.com');
  });

  it('builds the web and native auth-return redirects', () => {
    expect(
      authReturnRedirect({
        isWebPlatform: true,
        location: {protocol: 'https:', host: 'app.example'},
      })
    ).toBe('https://app.example/auth-return');
    expect(
      authReturnRedirect({
        isWebPlatform: false,
        appId: 'org.example',
      })
    ).toBe('org.example://auth-return');
  });

  it('includes a local username that is not an email address', () => {
    const url = new URL(
      conductorLoginUrl({
        conductorUrl: 'https://conductor.example',
        redirect: 'https://app.example/auth-return',
        email: 'admin',
      })
    );
    expect(url.searchParams.get('email')).toBe('admin');
  });

  it('omits a blank email so SSO re-login stays identifier-free', () => {
    const url = new URL(
      conductorLoginUrl({
        conductorUrl: 'https://conductor.example',
        redirect: 'https://app.example/auth-return',
        email: '  ',
      })
    );
    expect(url.searchParams.has('email')).toBe(false);
  });
});

describe('localReauthIdentifier', () => {
  it('prefills a local username that is not an email address', () => {
    expect(
      localReauthIdentifier({username: 'admin', hasLocalProfile: true})
    ).toBe('admin');
  });
});
