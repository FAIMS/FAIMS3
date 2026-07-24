import {describe, expect, it} from 'vitest';
import {
  effectiveAclClientSchemaVersion,
  LOCAL_DATA_ACL_SCHEMA_VERSION,
  shouldRebuildLocalDataDbForAclCutover,
} from './localDataAclCutoverPolicy';

describe('effectiveAclClientSchemaVersion', () => {
  it('uses the app-bundled version when server omits a generation', () => {
    expect(effectiveAclClientSchemaVersion()).toBe(
      LOCAL_DATA_ACL_SCHEMA_VERSION
    );
    expect(effectiveAclClientSchemaVersion(1)).toBe(
      LOCAL_DATA_ACL_SCHEMA_VERSION
    );
  });

  it('uses a higher server-advertised generation (same-hostname flip)', () => {
    expect(
      effectiveAclClientSchemaVersion(LOCAL_DATA_ACL_SCHEMA_VERSION + 3)
    ).toBe(LOCAL_DATA_ACL_SCHEMA_VERSION + 3);
  });
});

describe('shouldRebuildLocalDataDbForAclCutover', () => {
  it('keeps empty DBs without a marker (fresh activate)', () => {
    expect(shouldRebuildLocalDataDbForAclCutover({docCount: 0})).toBe(false);
  });

  it('rebuilds non-empty DBs missing a marker (pre-ACL leak)', () => {
    expect(shouldRebuildLocalDataDbForAclCutover({docCount: 12})).toBe(true);
  });

  it('keeps DBs with the current marker version and matching remote URL', () => {
    expect(
      shouldRebuildLocalDataDbForAclCutover({
        markerVersion: LOCAL_DATA_ACL_SCHEMA_VERSION,
        markerRemoteBaseUrl: 'http://localhost:5985',
        currentRemoteBaseUrl: 'http://localhost:5985',
        docCount: 50,
      })
    ).toBe(false);
  });

  it('rebuilds when marker version is behind the app-bundled constant', () => {
    expect(
      shouldRebuildLocalDataDbForAclCutover({
        markerVersion: LOCAL_DATA_ACL_SCHEMA_VERSION - 1,
        docCount: 50,
      })
    ).toBe(true);
  });

  it('rebuilds when public URL flips after marker was sealed (Couch → proxy)', () => {
    expect(
      shouldRebuildLocalDataDbForAclCutover({
        markerVersion: LOCAL_DATA_ACL_SCHEMA_VERSION,
        markerRemoteBaseUrl: 'http://localhost:5984',
        currentRemoteBaseUrl: 'http://localhost:5985',
        docCount: 50,
      })
    ).toBe(true);
  });

  it('rebuilds markers that never recorded a remote URL once URL is known', () => {
    expect(
      shouldRebuildLocalDataDbForAclCutover({
        markerVersion: LOCAL_DATA_ACL_SCHEMA_VERSION,
        currentRemoteBaseUrl: 'http://localhost:5985',
        docCount: 50,
      })
    ).toBe(true);
  });

  it('rebuilds on same-hostname AWS cutover when server bumps generation', () => {
    const hostname = 'https://couch.example.com';
    expect(
      shouldRebuildLocalDataDbForAclCutover({
        markerVersion: LOCAL_DATA_ACL_SCHEMA_VERSION,
        markerRemoteBaseUrl: hostname,
        currentRemoteBaseUrl: hostname,
        serverAdvertisedVersion: LOCAL_DATA_ACL_SCHEMA_VERSION + 1,
        docCount: 50,
      })
    ).toBe(true);
  });

  it('keeps DBs when server generation matches the sealed marker', () => {
    const hostname = 'https://couch.example.com';
    const generation = LOCAL_DATA_ACL_SCHEMA_VERSION + 1;
    expect(
      shouldRebuildLocalDataDbForAclCutover({
        markerVersion: generation,
        markerRemoteBaseUrl: hostname,
        currentRemoteBaseUrl: hostname,
        serverAdvertisedVersion: generation,
        docCount: 50,
      })
    ).toBe(false);
  });
});
