import {describe, expect, it} from 'vitest';
import {
  LOCAL_DATA_ACL_SCHEMA_VERSION,
  shouldRebuildLocalDataDbForAclCutover,
} from './localDataAclCutoverPolicy';

describe('shouldRebuildLocalDataDbForAclCutover', () => {
  it('keeps empty DBs without a marker (fresh activate)', () => {
    expect(shouldRebuildLocalDataDbForAclCutover({docCount: 0})).toBe(false);
  });

  it('rebuilds non-empty DBs missing a marker (pre-ACL leak)', () => {
    expect(shouldRebuildLocalDataDbForAclCutover({docCount: 12})).toBe(true);
  });

  it('keeps DBs with the current marker version', () => {
    expect(
      shouldRebuildLocalDataDbForAclCutover({
        markerVersion: LOCAL_DATA_ACL_SCHEMA_VERSION,
        docCount: 50,
      })
    ).toBe(false);
  });

  it('rebuilds when marker version is behind', () => {
    expect(
      shouldRebuildLocalDataDbForAclCutover({
        markerVersion: LOCAL_DATA_ACL_SCHEMA_VERSION - 1,
        docCount: 50,
      })
    ).toBe(true);
  });
});
