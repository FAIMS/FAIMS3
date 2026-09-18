// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: logging.test.ts
 * Description:
 *   Tests for invite-id audit fingerprints (no plaintext codes in logs).
 */

import crypto from 'crypto';
import {describe, expect, it} from 'vitest';
import {fingerprintInviteIdForAudit} from '../src/logging';

function sha256Hex8(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 8);
}

describe('fingerprintInviteIdForAudit', () => {
  it('masks the body as PREFIX-a..[hash]..z and is stable', () => {
    const inviteId = 'FAIMS-abcdefghijklmnop';
    const fingerprint = fingerprintInviteIdForAudit(inviteId);
    expect(fingerprint).toBe(`FAIMS-a..[${sha256Hex8(inviteId)}]..p`);
    expect(fingerprintInviteIdForAudit(inviteId)).toBe(fingerprint);
  });

  it('never includes the middle of the invite body', () => {
    const inviteId = 'FAIMS-abcdefghijklmnop';
    const fingerprint = fingerprintInviteIdForAudit(inviteId)!;
    expect(fingerprint).not.toContain('cdefghijklmn');
    expect(fingerprint).not.toBe(inviteId);
  });

  it('changes the hash when the body changes', () => {
    const a = fingerprintInviteIdForAudit('FAIMS-abcdefghijklmnop');
    const b = fingerprintInviteIdForAudit('FAIMS-abcdefghijklmnOQ');
    expect(a).not.toBe(b);
  });

  it('fingerprints ids with no prefix separator', () => {
    const inviteId = 'abcdefghijklmnop';
    expect(fingerprintInviteIdForAudit(inviteId)).toBe(
      `a..[${sha256Hex8(inviteId)}]..p`
    );
  });

  it('returns undefined when no invite id is provided', () => {
    expect(fingerprintInviteIdForAudit(undefined)).toBeUndefined();
  });
});
