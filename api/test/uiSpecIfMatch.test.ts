// SPDX-License-Identifier: Apache-2.0

import {describe, expect, it} from 'vitest';
import {
  assertUiSpecIfMatch,
  parseIfMatchUiSpecHash,
} from '../src/utils/uiSpecIfMatch';
import {ConflictException, InvalidRequestException} from '../src/exceptions';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

describe('parseIfMatchUiSpecHash', () => {
  it('treats a missing or blank header as unconditional', () => {
    expect(parseIfMatchUiSpecHash(undefined)).toBeUndefined();
    expect(parseIfMatchUiSpecHash('')).toBeUndefined();
    expect(parseIfMatchUiSpecHash('   ')).toBeUndefined();
  });

  it('accepts quoted and unquoted 64-character hashes', () => {
    expect(parseIfMatchUiSpecHash(`"${HASH_A}"`)).toBe(HASH_A);
    expect(parseIfMatchUiSpecHash(HASH_B.toUpperCase())).toBe(HASH_B);
  });

  it('rejects a malformed If-Match', () => {
    expect(() => parseIfMatchUiSpecHash('not-a-hash')).toThrow(
      InvalidRequestException
    );
  });
});

describe('assertUiSpecIfMatch', () => {
  it('no-ops when If-Match is omitted', () => {
    expect(() => assertUiSpecIfMatch(HASH_A, undefined)).not.toThrow();
  });

  it('allows a matching hash', () => {
    expect(() => assertUiSpecIfMatch(HASH_A, `"${HASH_A}"`)).not.toThrow();
  });

  it('conflicts when the live hash has moved', () => {
    expect(() => assertUiSpecIfMatch(HASH_A, HASH_B)).toThrow(ConflictException);
  });
});
