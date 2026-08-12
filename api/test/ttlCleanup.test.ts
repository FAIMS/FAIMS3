import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(require('pouchdb-adapter-memory'));
PouchDB.plugin(PouchDBFind);

import {AUTH_RECORD_ID_PREFIXES, Resource, Role} from '@faims3/data-model';
import {beforeEach, describe, expect, it} from 'vitest';
import {getAuthDB, getInvitesDB, getUsersDB} from '../src/couchdb';
import {
  createNewEmailCode,
  EMAIL_CODE_COOLDOWN_MS,
  EMAIL_CODE_RATE_LIMIT_WINDOW_MS,
} from '../src/couchdb/emailReset';
import {createResourceInvite} from '../src/couchdb/invites';
import {createNewLongLivedToken} from '../src/couchdb/longLivedTokens';
import {createNewRefreshToken} from '../src/couchdb/refreshTokens';
import {
  DEFAULT_LONG_LIVED_AUDIT_RETENTION_MS,
  DEFAULT_RATE_LIMIT_GRACE_MS,
  DEFAULT_REFRESH_GRACE_MS,
  emailCodeRetentionMs,
  runTtlCleanup,
  shouldDeleteEmailCode,
  shouldDeleteInvite,
  shouldDeleteLongLivedToken,
  shouldDeleteRefreshToken,
  shouldDeleteVerificationChallenge,
  verificationRetentionMs,
} from '../src/couchdb/ttlCleanup';
import {
  createVerificationChallenge,
  VERIFICATION_COOLDOWN_MS,
  VERIFICATION_RATE_LIMIT_WINDOW_MS,
} from '../src/couchdb/verificationChallenges';
import {adminUserName, beforeApiTests, localUserName} from './utils';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

describe('TTL cleanup retention predicates', () => {
  const now = Date.UTC(2026, 7, 12, 0, 0, 0);

  describe('shouldDeleteRefreshToken', () => {
    it('deletes refresh tokens expired past grace', () => {
      expect(
        shouldDeleteRefreshToken(
          {
            _id: `${AUTH_RECORD_ID_PREFIXES.refresh}a`,
            documentType: 'refresh',
            enabled: true,
            expiryTimestampMs: now - DEFAULT_REFRESH_GRACE_MS - 1,
          },
          now
        )
      ).toBe(true);
    });

    it('keeps not-yet-expired refresh tokens', () => {
      expect(
        shouldDeleteRefreshToken(
          {
            _id: `${AUTH_RECORD_ID_PREFIXES.refresh}a`,
            documentType: 'refresh',
            enabled: true,
            expiryTimestampMs: now + HOUR_MS,
          },
          now
        )
      ).toBe(false);
    });

    it('keeps tokens inside the grace window after expiry', () => {
      expect(
        shouldDeleteRefreshToken(
          {
            _id: `${AUTH_RECORD_ID_PREFIXES.refresh}a`,
            documentType: 'refresh',
            enabled: true,
            expiryTimestampMs: now - DEFAULT_REFRESH_GRACE_MS + HOUR_MS,
          },
          now
        )
      ).toBe(false);
    });

    it('deletes disabled tokens once expiry is past grace', () => {
      expect(
        shouldDeleteRefreshToken(
          {
            _id: `${AUTH_RECORD_ID_PREFIXES.refresh}a`,
            documentType: 'refresh',
            enabled: false,
            expiryTimestampMs: now - DEFAULT_REFRESH_GRACE_MS - 1,
          },
          now
        )
      ).toBe(true);
    });

    it('rejects wrong documentType / id prefix', () => {
      expect(
        shouldDeleteRefreshToken(
          {
            _id: 'people_someone',
            documentType: 'refresh',
            enabled: true,
            expiryTimestampMs: now - DAY_MS * 10,
          },
          now
        )
      ).toBe(false);
      expect(
        shouldDeleteRefreshToken(
          {
            _id: `${AUTH_RECORD_ID_PREFIXES.refresh}a`,
            documentType: 'emailcode' as any,
            enabled: true,
            expiryTimestampMs: now - DAY_MS * 10,
          },
          now
        )
      ).toBe(false);
    });
  });

  describe('shouldDeleteEmailCode', () => {
    const retention = emailCodeRetentionMs();

    it('keeps codes still inside rate-limit retention (even if code expired/used)', () => {
      const created = now - EMAIL_CODE_RATE_LIMIT_WINDOW_MS;
      expect(
        shouldDeleteEmailCode(
          {
            _id: `${AUTH_RECORD_ID_PREFIXES.emailcode}a`,
            documentType: 'emailcode',
            createdTimestampMs: created,
            expiryTimestampMs: created + 30 * 60 * 1000,
            used: true,
          },
          now
        )
      ).toBe(false);
    });

    it('deletes codes older than window + cooldown + grace', () => {
      expect(
        shouldDeleteEmailCode(
          {
            _id: `${AUTH_RECORD_ID_PREFIXES.emailcode}a`,
            documentType: 'emailcode',
            createdTimestampMs: now - retention - 1,
            expiryTimestampMs: now - retention,
            used: false,
          },
          now
        )
      ).toBe(true);
    });

    it('falls back to expiryTimestampMs when created is missing', () => {
      expect(
        shouldDeleteEmailCode(
          {
            _id: `${AUTH_RECORD_ID_PREFIXES.emailcode}a`,
            documentType: 'emailcode',
            createdTimestampMs: undefined as any,
            expiryTimestampMs: now - retention - 1,
            used: false,
          },
          now
        )
      ).toBe(true);
    });

    it('retention equals window + cooldown + default grace', () => {
      expect(emailCodeRetentionMs()).toBe(
        EMAIL_CODE_RATE_LIMIT_WINDOW_MS +
          EMAIL_CODE_COOLDOWN_MS +
          DEFAULT_RATE_LIMIT_GRACE_MS
      );
    });
  });

  describe('shouldDeleteVerificationChallenge', () => {
    const retention = verificationRetentionMs();

    it('keeps challenges inside verification retention window', () => {
      expect(
        shouldDeleteVerificationChallenge(
          {
            _id: `${AUTH_RECORD_ID_PREFIXES.verification}a`,
            documentType: 'verification',
            createdTimestampMs: now - VERIFICATION_RATE_LIMIT_WINDOW_MS,
            expiryTimestampMs: now - HOUR_MS,
            used: true,
          },
          now
        )
      ).toBe(false);
    });

    it('deletes challenges older than window + cooldown + grace', () => {
      expect(
        shouldDeleteVerificationChallenge(
          {
            _id: `${AUTH_RECORD_ID_PREFIXES.verification}a`,
            documentType: 'verification',
            createdTimestampMs: now - retention - 1,
            expiryTimestampMs: now - retention,
            used: false,
          },
          now
        )
      ).toBe(true);
    });

    it('retention equals verification window + cooldown + grace', () => {
      expect(verificationRetentionMs()).toBe(
        VERIFICATION_RATE_LIMIT_WINDOW_MS +
          VERIFICATION_COOLDOWN_MS +
          DEFAULT_RATE_LIMIT_GRACE_MS
      );
    });
  });

  describe('shouldDeleteInvite', () => {
    it('deletes when expiry is in the past', () => {
      expect(
        shouldDeleteInvite({_id: 'inv1', expiry: now - 1, usesConsumed: 0}, now)
      ).toBe(true);
    });

    it('keeps future expiry', () => {
      expect(
        shouldDeleteInvite(
          {_id: 'inv1', expiry: now + DAY_MS, usesConsumed: 0},
          now
        )
      ).toBe(false);
    });

    it('keeps exhausted non-expired invites by default (uses may be raised later)', () => {
      expect(
        shouldDeleteInvite(
          {
            _id: 'inv1',
            expiry: now + DAY_MS,
            usesOriginal: 2,
            usesConsumed: 2,
          },
          now
        )
      ).toBe(false);
    });

    it('deletes exhausted capped uses when deleteExhausted is enabled', () => {
      expect(
        shouldDeleteInvite(
          {
            _id: 'inv1',
            expiry: now + DAY_MS,
            usesOriginal: 2,
            usesConsumed: 2,
          },
          now,
          {deleteExhausted: true}
        )
      ).toBe(true);
    });

    it('still deletes expired invites even when exhausted-delete is off', () => {
      expect(
        shouldDeleteInvite(
          {
            _id: 'inv1',
            expiry: now - 1,
            usesOriginal: 1,
            usesConsumed: 1,
          },
          now,
          {deleteExhausted: false}
        )
      ).toBe(true);
    });
  });

  describe('shouldDeleteLongLivedToken', () => {
    it('keeps active non-expired tokens', () => {
      expect(
        shouldDeleteLongLivedToken(
          {
            _id: `${AUTH_RECORD_ID_PREFIXES.longlived}a`,
            documentType: 'longlived',
            enabled: true,
            expiryTimestampMs: now + DAY_MS,
            updatedTimestampMs: now - DAY_MS * 60,
            createdTimestampMs: now - DAY_MS * 60,
          },
          now
        )
      ).toBe(false);
    });

    it('keeps never-expiring enabled tokens', () => {
      expect(
        shouldDeleteLongLivedToken(
          {
            _id: `${AUTH_RECORD_ID_PREFIXES.longlived}a`,
            documentType: 'longlived',
            enabled: true,
            expiryTimestampMs: undefined,
            updatedTimestampMs: now - DAY_MS * 60,
            createdTimestampMs: now - DAY_MS * 60,
          },
          now
        )
      ).toBe(false);
    });

    it('deletes expired tokens past audit retention', () => {
      const expiredAt = now - DEFAULT_LONG_LIVED_AUDIT_RETENTION_MS - 1;
      expect(
        shouldDeleteLongLivedToken(
          {
            _id: `${AUTH_RECORD_ID_PREFIXES.longlived}a`,
            documentType: 'longlived',
            enabled: true,
            expiryTimestampMs: expiredAt,
            updatedTimestampMs: expiredAt,
            createdTimestampMs: expiredAt - DAY_MS,
          },
          now
        )
      ).toBe(true);
    });

    it('deletes revoked tokens past audit retention', () => {
      const revokedAt = now - DEFAULT_LONG_LIVED_AUDIT_RETENTION_MS - 1;
      expect(
        shouldDeleteLongLivedToken(
          {
            _id: `${AUTH_RECORD_ID_PREFIXES.longlived}a`,
            documentType: 'longlived',
            enabled: false,
            expiryTimestampMs: now + DAY_MS,
            updatedTimestampMs: revokedAt,
            createdTimestampMs: revokedAt - DAY_MS,
          },
          now
        )
      ).toBe(true);
    });

    it('keeps recently revoked tokens inside audit window', () => {
      expect(
        shouldDeleteLongLivedToken(
          {
            _id: `${AUTH_RECORD_ID_PREFIXES.longlived}a`,
            documentType: 'longlived',
            enabled: false,
            expiryTimestampMs: now + DAY_MS,
            updatedTimestampMs: now - DAY_MS,
            createdTimestampMs: now - DAY_MS * 2,
          },
          now
        )
      ).toBe(false);
    });
  });
});

describe('TTL cleanup sweep integration', () => {
  beforeEach(beforeApiTests);

  it('deletes eligible docs, respects retention, dry-run mutates nothing, second run is idempotent', async () => {
    const authDB = getAuthDB();
    const invitesDB = getInvitesDB();
    const usersDB = getUsersDB();
    const admin = await usersDB.get(adminUserName);
    const local = await usersDB.get(localUserName);
    const now = Date.now();

    // --- Refresh: one deletable (expired past grace), one keep ---
    const {refresh: expiredRefresh} = await createNewRefreshToken({
      userId: local._id,
      refreshExpiryMs: 60_000,
    });
    await authDB.put({
      ...expiredRefresh,
      expiryTimestampMs: now - DEFAULT_REFRESH_GRACE_MS - HOUR_MS,
    });

    const {refresh: liveRefresh} = await createNewRefreshToken({
      userId: local._id,
      refreshExpiryMs: 60_000,
    });
    await authDB.put({
      ...liveRefresh,
      expiryTimestampMs: now + DAY_MS,
    });

    // --- Email code: inside retention (keep), outside (delete), used+old (delete) ---
    const {record: recentEmail} = await createNewEmailCode({
      userId: local._id,
    });
    // leave timestamps as-is → inside retention → keep

    const {record: oldEmail} = await createNewEmailCode({
      userId: admin._id,
    });
    const oldEmailAnchor = now - emailCodeRetentionMs() - HOUR_MS;
    await authDB.put({
      ...oldEmail,
      createdTimestampMs: oldEmailAnchor,
      expiryTimestampMs: oldEmailAnchor + 30 * 60 * 1000,
      used: true,
    });

    // --- Verification: recent keep, old delete ---
    const {record: recentVerify} = await createVerificationChallenge({
      userId: local._id,
      email: 'local@example.com',
    });

    const {record: oldVerify} = await createVerificationChallenge({
      userId: admin._id,
      email: 'admin@example.com',
    });
    const oldVerifyAnchor = now - verificationRetentionMs() - HOUR_MS;
    await authDB.put({
      ...oldVerify,
      createdTimestampMs: oldVerifyAnchor,
      expiryTimestampMs: oldVerifyAnchor + DAY_MS,
    });

    // --- Invites: expired delete; future + exhausted-but-unexpired keep ---
    const expiredInvite = await createResourceInvite({
      resourceType: Resource.PROJECT,
      resourceId: 'proj-ttl-1',
      role: Role.PROJECT_CONTRIBUTOR,
      name: 'expired',
      createdBy: admin._id,
      expiry: now - HOUR_MS,
    });
    const futureInvite = await createResourceInvite({
      resourceType: Resource.PROJECT,
      resourceId: 'proj-ttl-1',
      role: Role.PROJECT_ADMIN,
      name: 'future',
      createdBy: admin._id,
      expiry: now + DAY_MS * 10,
    });
    const exhaustedInvite = await createResourceInvite({
      resourceType: Resource.PROJECT,
      resourceId: 'proj-ttl-2',
      role: Role.PROJECT_CONTRIBUTOR,
      name: 'exhausted',
      createdBy: admin._id,
      expiry: now + DAY_MS * 10,
      usesOriginal: 1,
    });
    await invitesDB.put({
      ...exhaustedInvite,
      usesConsumed: 1,
    });

    // --- Long-lived: active keep; revoked+old delete when included ---
    const {record: activeLongLived} = await createNewLongLivedToken({
      userId: local._id,
      title: 'active',
      description: 'keep me',
      expiryTimestampMs: now + DAY_MS * 30,
    });
    const {record: revokedLongLived} = await createNewLongLivedToken({
      userId: local._id,
      title: 'revoked',
      description: 'delete me',
      expiryTimestampMs: now + DAY_MS * 30,
    });
    await authDB.put({
      ...revokedLongLived,
      enabled: false,
      updatedTimestampMs: now - DEFAULT_LONG_LIVED_AUDIT_RETENTION_MS - HOUR_MS,
    });

    // People doc must never be touched
    const peopleBefore = await usersDB.get(local._id);

    // Dry-run: no mutations
    const dry = await runTtlCleanup({
      dryRun: true,
      includeLongLived: true,
      nowMs: now,
      log: () => {},
    });
    expect(dry.success).toBe(true);
    expect(dry.stats.refresh.deleted).toBeGreaterThanOrEqual(1);
    expect(dry.stats.emailcode.deleted).toBeGreaterThanOrEqual(1);
    expect(dry.stats.verification.deleted).toBeGreaterThanOrEqual(1);
    expect(dry.stats.invite.deleted).toBeGreaterThanOrEqual(1);
    expect(dry.stats.longlived.deleted).toBeGreaterThanOrEqual(1);

    expect(await authDB.get(expiredRefresh._id)).toBeTruthy();
    expect(await authDB.get(oldEmail._id)).toBeTruthy();
    expect(await authDB.get(oldVerify._id)).toBeTruthy();
    expect(await invitesDB.get(expiredInvite._id)).toBeTruthy();
    expect(await authDB.get(revokedLongLived._id)).toBeTruthy();

    // Destructive run
    const first = await runTtlCleanup({
      dryRun: false,
      includeLongLived: true,
      nowMs: now,
      log: () => {},
    });
    expect(first.success).toBe(true);
    expect(first.stats.refresh.deleted).toBeGreaterThanOrEqual(1);
    expect(first.stats.emailcode.deleted).toBeGreaterThanOrEqual(1);
    expect(first.stats.verification.deleted).toBeGreaterThanOrEqual(1);
    expect(first.stats.invite.deleted).toBeGreaterThanOrEqual(1);
    expect(first.stats.longlived.deleted).toBeGreaterThanOrEqual(1);

    await expect(authDB.get(expiredRefresh._id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(authDB.get(oldEmail._id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(authDB.get(oldVerify._id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(invitesDB.get(expiredInvite._id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(authDB.get(revokedLongLived._id)).rejects.toMatchObject({
      status: 404,
    });

    // Kept docs (including exhausted-but-unexpired invites)
    expect((await authDB.get(liveRefresh._id))._id).toBe(liveRefresh._id);
    expect((await authDB.get(recentEmail._id))._id).toBe(recentEmail._id);
    expect((await authDB.get(recentVerify._id))._id).toBe(recentVerify._id);
    expect((await invitesDB.get(futureInvite._id))._id).toBe(futureInvite._id);
    expect((await invitesDB.get(exhaustedInvite._id))._id).toBe(
      exhaustedInvite._id
    );
    expect((await authDB.get(activeLongLived._id))._id).toBe(
      activeLongLived._id
    );

    // People untouched
    const peopleAfter = await usersDB.get(local._id);
    expect(peopleAfter._rev).toBe(peopleBefore._rev);

    // Idempotent second run: no further deletes of remaining candidates
    const second = await runTtlCleanup({
      dryRun: false,
      includeLongLived: true,
      nowMs: now,
      log: () => {},
    });
    expect(second.success).toBe(true);
    expect(second.stats.refresh.deleted).toBe(0);
    expect(second.stats.emailcode.deleted).toBe(0);
    expect(second.stats.verification.deleted).toBe(0);
    expect(second.stats.invite.deleted).toBe(0);
    expect(second.stats.longlived.deleted).toBe(0);
  });

  it('scans invite tail when over-fetch exceeds batchSize on a short page', async () => {
    // paginateInvitesAllDocs over-fetches by +10 then caps to batchSize. With
    // batchSize=10 a single short page can hold 15 filtered invites; the old
    // exit condition (rawRows.length < fetchLimit) dropped the last 5 forever.
    const admin = await getUsersDB().get(adminUserName);
    const invitesDB = getInvitesDB();
    const now = Date.now();
    const batchSize = 10;
    const total = 15;
    const ids: string[] = [];

    for (let i = 0; i < total; i++) {
      const invite = await createResourceInvite({
        resourceType: Resource.PROJECT,
        resourceId: 'proj-ttl-page',
        role: Role.PROJECT_CONTRIBUTOR,
        name: `expired-page-${i}`,
        createdBy: admin._id,
        expiry: now - HOUR_MS,
      });
      ids.push(invite._id);
    }

    const result = await runTtlCleanup({
      dryRun: false,
      nowMs: now,
      batchSize,
      log: () => {},
    });

    expect(result.success).toBe(true);
    expect(result.stats.invite.scanned).toBe(total);
    expect(result.stats.invite.deleted).toBe(total);

    for (const id of ids) {
      await expect(invitesDB.get(id)).rejects.toMatchObject({status: 404});
    }
  });

  it('auth pagination does not skip the next live doc after deleting a page anchor', async () => {
    const authDB = getAuthDB();
    const local = await getUsersDB().get(localUserName);
    const now = Date.now();
    const expiryTimestampMs = now - DEFAULT_REFRESH_GRACE_MS - HOUR_MS;

    // Five consecutive expired refresh docs; batchSize 2 forces page boundaries
    // on every even id. After page [a,b] deletes b, the next query with
    // startkey=b must still process c (not slice it away).
    const ids = ['a', 'b', 'c', 'd', 'e'].map(
      s => `${AUTH_RECORD_ID_PREFIXES.refresh}ttl-page-${s}`
    );
    for (const id of ids) {
      await authDB.put({
        _id: id,
        documentType: 'refresh',
        userId: local._id,
        expiryTimestampMs,
        token: `tok-${id}`,
        enabled: true,
        exchangeTokenHash: `hash-${id}`,
        exchangeTokenUsed: false,
        exchangeTokenExpiryTimestampMs: now - HOUR_MS,
      });
    }

    const result = await runTtlCleanup({
      dryRun: false,
      batchSize: 2,
      nowMs: now,
      log: () => {},
    });

    expect(result.success).toBe(true);
    expect(result.stats.refresh.deleted).toBe(5);
    for (const id of ids) {
      await expect(authDB.get(id)).rejects.toMatchObject({status: 404});
    }
  });

  it('does not delete long-lived tokens when flag is off', async () => {
    const authDB = getAuthDB();
    const local = await getUsersDB().get(localUserName);
    const now = Date.now();

    const {record} = await createNewLongLivedToken({
      userId: local._id,
      title: 'revoked',
      description: 'should remain when flag off',
      expiryTimestampMs: now + DAY_MS * 30,
    });
    await authDB.put({
      ...record,
      enabled: false,
      updatedTimestampMs: now - DEFAULT_LONG_LIVED_AUDIT_RETENTION_MS - HOUR_MS,
    });

    const result = await runTtlCleanup({
      dryRun: false,
      includeLongLived: false,
      nowMs: now,
      log: () => {},
    });
    expect(result.stats.longlived.scanned).toBe(0);
    expect(result.stats.longlived.deleted).toBe(0);
    expect((await authDB.get(record._id))._id).toBe(record._id);
  });

  it('negative: never selects people docs via auth predicates', () => {
    const now = Date.now();
    const peopleShaped = {
      _id: 'admin',
      documentType: 'refresh' as const,
      enabled: true,
      expiryTimestampMs: now - DAY_MS * 100,
    };
    expect(shouldDeleteRefreshToken(peopleShaped, now)).toBe(false);
  });
});
