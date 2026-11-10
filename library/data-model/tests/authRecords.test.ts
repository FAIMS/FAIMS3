// SPDX-License-Identifier: Apache-2.0
import {
  AUTH_RECORD_ID_PREFIXES,
  AuthRecordExistingDocumentSchema,
  LoginLockoutExistingDocumentSchema,
} from '../src';

const now = Date.UTC(2026, 10, 8);

describe('AuthRecord Zod schemas', () => {
  it('parses a loginlockout document with the deterministic prefix', () => {
    const doc = {
      _id: `${AUTH_RECORD_ID_PREFIXES.loginlockout}admin`,
      _rev: '1-abc',
      documentType: 'loginlockout' as const,
      userId: 'admin',
      count: 2,
      lastAttemptMs: now,
    };
    expect(AUTH_RECORD_ID_PREFIXES.loginlockout).toBe('loginlockout_');
    expect(LoginLockoutExistingDocumentSchema.parse(doc)).toEqual(doc);
    expect(AuthRecordExistingDocumentSchema.parse(doc)).toEqual(doc);
  });

  it('still parses existing refresh / emailcode / verification / longlived / downloadgrant fixtures', () => {
    const fixtures = [
      {
        _id: `${AUTH_RECORD_ID_PREFIXES.refresh}a`,
        _rev: '1-a',
        documentType: 'refresh' as const,
        userId: 'user-a',
        token: 'token-a',
        enabled: true,
        expiryTimestampMs: now + 3600000,
        exchangeTokenHash: 'hash-a',
        exchangeTokenUsed: false,
        exchangeTokenExpiryTimestampMs: now + 1800000,
      },
      {
        _id: `${AUTH_RECORD_ID_PREFIXES.emailcode}b`,
        _rev: '1-b',
        documentType: 'emailcode' as const,
        userId: 'user-b',
        code: 'hashed-b',
        used: false,
        expiryTimestampMs: now + 1800000,
        createdTimestampMs: now,
      },
      {
        _id: `${AUTH_RECORD_ID_PREFIXES.verification}c`,
        _rev: '1-c',
        documentType: 'verification' as const,
        userId: 'user-c',
        email: 'c@example.com',
        code: 'hashed-c',
        used: false,
        createdTimestampMs: now,
        expiryTimestampMs: now + 86400000,
      },
      {
        _id: `${AUTH_RECORD_ID_PREFIXES.longlived}d`,
        _rev: '1-d',
        documentType: 'longlived' as const,
        userId: 'user-d',
        tokenHash: 'hash-d',
        title: 'CI',
        description: 'fixture',
        enabled: true,
        createdTimestampMs: now,
        updatedTimestampMs: now,
      },
      {
        _id: `${AUTH_RECORD_ID_PREFIXES.downloadgrant}e`,
        _rev: '1-e',
        documentType: 'downloadgrant' as const,
        userId: 'user-e',
        projectID: 'project-e',
        format: 'csv' as const,
        secretHash: 'hash-e',
        used: false,
        expiryTimestampMs: now + 3600000,
        createdTimestampMs: now,
      },
    ];

    for (const fixture of fixtures) {
      expect(AuthRecordExistingDocumentSchema.parse(fixture)).toEqual(fixture);
    }
  });
});
