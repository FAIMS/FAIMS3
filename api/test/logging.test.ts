/*
 * Copyright 2021, 2022 Macquarie University
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
