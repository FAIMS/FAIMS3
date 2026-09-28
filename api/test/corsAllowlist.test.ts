import {describe, expect, it} from 'vitest';
import {buildCorsAllowlist, isCorsOriginAllowed} from '../src/corsAllowlist';

const WEB_SOURCES = {
  conductorPublicUrl: 'https://conductor.example.com',
  webAppPublicUrl: 'https://app.example.com/path',
  newConductorUrl: 'https://web.example.com',
  redirectWhitelist: [
    'https://conductor.example.com',
    'https://app.example.com',
    'https://web.example.com',
  ],
};

describe('buildCorsAllowlist', () => {
  it('keeps Conductor and web http(s) origins', () => {
    const list = buildCorsAllowlist(WEB_SOURCES);
    expect(list).toEqual(
      expect.arrayContaining([
        'https://conductor.example.com',
        'https://app.example.com',
        'https://web.example.com',
      ])
    );
  });

  it('always allows the Capacitor Android WebView origin', () => {
    const list = buildCorsAllowlist(WEB_SOURCES);
    expect(list).toContain('https://localhost');
  });

  it('defaults the iOS Capacitor origin when no app scheme is configured', () => {
    const list = buildCorsAllowlist(WEB_SOURCES);
    expect(list).toContain('org.fedarch.faims3://localhost');
  });

  it('derives the iOS Capacitor origin from a redirect-whitelist app scheme', () => {
    const list = buildCorsAllowlist({
      ...WEB_SOURCES,
      redirectWhitelist: [
        ...WEB_SOURCES.redirectWhitelist,
        'com.example.field://auth-return',
      ],
    });
    expect(list).toContain('com.example.field://localhost');
    expect(list).not.toContain('org.fedarch.faims3://localhost');
  });

  it('derives the iOS Capacitor origin from a custom-scheme app URL', () => {
    const list = buildCorsAllowlist({
      ...WEB_SOURCES,
      iosAppUrl: 'au.edu.faims.fieldmark://',
    });
    expect(list).toContain('au.edu.faims.fieldmark://localhost');
  });

  it('does not treat store links as CORS origins', () => {
    const list = buildCorsAllowlist({
      ...WEB_SOURCES,
      androidAppUrl:
        'https://play.google.com/store/apps/details?id=org.fedarch.faims3',
      iosAppUrl: 'https://apps.apple.com/au/app/fieldmark/id1592632372',
    });
    expect(list).not.toContain('https://play.google.com');
    expect(list).not.toContain('https://apps.apple.com');
    expect(list).toContain('https://localhost');
    expect(list).toContain('org.fedarch.faims3://localhost');
  });

  it('drops custom schemes from the http(s) origin list', () => {
    const list = buildCorsAllowlist({
      ...WEB_SOURCES,
      redirectWhitelist: ['org.fedarch.faims3://'],
    });
    expect(list).not.toContain('null');
    expect(list).toContain('org.fedarch.faims3://localhost');
  });
});

describe('isCorsOriginAllowed', () => {
  const allowlist = [
    'https://conductor.example.com',
    'https://localhost',
    'org.fedarch.faims3://localhost',
  ];

  it('allows a missing Origin (curl / scripts)', () => {
    expect(isCorsOriginAllowed(undefined, allowlist)).toBe(true);
  });

  it('allows Capacitor Android and iOS origins', () => {
    expect(isCorsOriginAllowed('https://localhost', allowlist)).toBe(true);
    expect(
      isCorsOriginAllowed('org.fedarch.faims3://localhost', allowlist)
    ).toBe(true);
  });

  it('allows listed web origins and rejects unknown browser origins', () => {
    expect(
      isCorsOriginAllowed('https://conductor.example.com', allowlist)
    ).toBe(true);
    expect(isCorsOriginAllowed('https://evil.example', allowlist)).toBe(false);
  });
});
