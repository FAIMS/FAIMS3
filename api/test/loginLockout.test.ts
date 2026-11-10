// SPDX-License-Identifier: Apache-2.0
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(require('pouchdb-adapter-memory'));
PouchDB.plugin(PouchDBFind);

import {AUTH_RECORD_ID_PREFIXES, PostLoginInput} from '@faims3/data-model';
import request from 'supertest';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {config} from '../src/buildconfig';
import {getAuthDB} from '../src/couchdb';
import {
  claimLoginAttemptForIdentifier,
  claimLoginAttemptForUserId,
  getAccountLockoutDelayMs,
  getLoginLockoutForUserId,
  incrementLoginLockoutForIdentifier,
  incrementLoginLockoutForUserId,
  LOCKOUT_PERIOD_LONG_MS,
  LOCKOUT_PERIOD_MAX_MS,
  LOCKOUT_PERIOD_MEDIUM_MS,
  LOCKOUT_PERIOD_SHORT_MS,
  loginLockoutDocumentId,
  resetLoginLockoutForUserId,
} from '../src/couchdb/loginLockout';
import {app} from '../src/expressSetup';
import {
  adminUserName,
  beforeApiTests,
  localEmail,
  localUserName,
  localUserPassword,
} from './utils';

const adminPassword = config.localCouchdbAuth
  ? config.localCouchdbAuth.password
  : '';

const loginBody = (
  overrides: Partial<PostLoginInput> = {}
): PostLoginInput => ({
  email: adminUserName,
  password: 'not-the-admin-password',
  action: 'login',
  redirect: 'http://localhost:8080/',
  ...overrides,
});

describe('getAccountLockoutDelayMs', () => {
  const now = Date.UTC(2026, 10, 8, 12, 0, 0);

  it('returns no delay for counts 0–4', () => {
    for (const count of [0, 1, 2, 3, 4]) {
      expect(getAccountLockoutDelayMs({count, lastAttemptMs: now, now})).toBe(
        0
      );
    }
  });

  it('returns the full period when last attempt is now', () => {
    expect(getAccountLockoutDelayMs({count: 5, lastAttemptMs: now, now})).toBe(
      LOCKOUT_PERIOD_SHORT_MS
    );
    expect(getAccountLockoutDelayMs({count: 7, lastAttemptMs: now, now})).toBe(
      LOCKOUT_PERIOD_MEDIUM_MS
    );
    expect(getAccountLockoutDelayMs({count: 10, lastAttemptMs: now, now})).toBe(
      LOCKOUT_PERIOD_LONG_MS
    );
    expect(getAccountLockoutDelayMs({count: 15, lastAttemptMs: now, now})).toBe(
      LOCKOUT_PERIOD_MAX_MS
    );
  });

  it('returns remaining time, not the full period, after half the window', () => {
    const halfShort = LOCKOUT_PERIOD_SHORT_MS / 2;
    expect(
      getAccountLockoutDelayMs({
        count: 5,
        lastAttemptMs: now - halfShort,
        now,
      })
    ).toBe(halfShort);

    const halfMedium = LOCKOUT_PERIOD_MEDIUM_MS / 2;
    expect(
      getAccountLockoutDelayMs({
        count: 7,
        lastAttemptMs: now - halfMedium,
        now,
      })
    ).toBe(halfMedium);
  });

  it('returns 0 once the period has elapsed', () => {
    expect(
      getAccountLockoutDelayMs({
        count: 5,
        lastAttemptMs: now - LOCKOUT_PERIOD_SHORT_MS,
        now,
      })
    ).toBe(0);
    expect(
      getAccountLockoutDelayMs({
        count: 15,
        lastAttemptMs: now - LOCKOUT_PERIOD_MAX_MS - 1,
        now,
      })
    ).toBe(0);
  });

  it('decreases remaining delay as time advances with fake timers', () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    expect(getAccountLockoutDelayMs({count: 5, lastAttemptMs: now})).toBe(
      LOCKOUT_PERIOD_SHORT_MS
    );
    vi.advanceTimersByTime(4000);
    expect(getAccountLockoutDelayMs({count: 5, lastAttemptMs: now})).toBe(
      LOCKOUT_PERIOD_SHORT_MS - 4000
    );
    vi.useRealTimers();
  });
});

describe('login lockout store', () => {
  beforeEach(beforeApiTests);

  it('creates a deterministic id on first increment and updates the same doc', async () => {
    const first = await incrementLoginLockoutForUserId(adminUserName);
    expect(first._id).toBe(loginLockoutDocumentId(adminUserName));
    expect(first._id).toBe(
      `${AUTH_RECORD_ID_PREFIXES.loginlockout}${adminUserName}`
    );
    expect(first.count).toBe(1);
    expect(first.documentType).toBe('loginlockout');
    expect(first.userId).toBe(adminUserName);

    const second = await incrementLoginLockoutForUserId(adminUserName);
    expect(second._id).toBe(first._id);
    expect(second.count).toBe(2);

    const stored = await getLoginLockoutForUserId(adminUserName);
    expect(stored?.count).toBe(2);
  });

  it('shares one document across identifiers that resolve to the same person', async () => {
    await incrementLoginLockoutForIdentifier(localUserName);
    await incrementLoginLockoutForIdentifier(localEmail);
    const stored = await getLoginLockoutForUserId(localUserName);
    expect(stored?.count).toBe(2);
    expect(stored?._id).toBe(loginLockoutDocumentId(localUserName));
  });

  it('writes nothing for an unknown identifier', async () => {
    const result = await incrementLoginLockoutForIdentifier(
      'nobody-at-all@example.test'
    );
    expect(result).toBeNull();
    const authDB = getAuthDB();
    const all = await authDB.allDocs({include_docs: true});
    const lockouts = all.rows.filter(row =>
      row.id.startsWith(AUTH_RECORD_ID_PREFIXES.loginlockout)
    );
    expect(lockouts).toHaveLength(0);
  });

  it('deletes the document on reset so the next increment starts at 1', async () => {
    await incrementLoginLockoutForUserId(adminUserName);
    await incrementLoginLockoutForUserId(adminUserName);
    await resetLoginLockoutForUserId(adminUserName);
    expect(await getLoginLockoutForUserId(adminUserName)).toBeNull();
    const next = await incrementLoginLockoutForUserId(adminUserName);
    expect(next.count).toBe(1);
  });

  it('applies overlapping increments without losing a write', async () => {
    const [a, b] = await Promise.all([
      incrementLoginLockoutForUserId(adminUserName),
      incrementLoginLockoutForUserId(adminUserName),
    ]);
    const stored = await getLoginLockoutForUserId(adminUserName);
    expect(stored?.count).toBe(2);
    expect(new Set([a.count, b.count])).toEqual(new Set([1, 2]));
  });

  it('serializes parallel claims so only the first five are allowed', async () => {
    const results = await Promise.all(
      Array.from({length: 15}, () => claimLoginAttemptForUserId(adminUserName))
    );
    expect(results.filter(result => result.status === 'allowed')).toHaveLength(
      5
    );
    expect(results.filter(result => result.status === 'delayed')).toHaveLength(
      10
    );
    const stored = await getLoginLockoutForUserId(adminUserName);
    expect(stored?.count).toBe(5);
  });

  it('does not increment when a claim is already delayed', async () => {
    for (let i = 0; i < 5; i++) {
      await incrementLoginLockoutForUserId(adminUserName);
    }
    const before = await getLoginLockoutForUserId(adminUserName);
    const claim = await claimLoginAttemptForUserId(adminUserName);
    expect(claim.status).toBe('delayed');
    if (claim.status === 'delayed') {
      expect(claim.delayMs).toBeGreaterThan(0);
    }
    const after = await getLoginLockoutForUserId(adminUserName);
    expect(after?.count).toBe(5);
    expect(after?.lastAttemptMs).toBe(before?.lastAttemptMs);
  });

  it('allows a claim and writes nothing for an unknown identifier', async () => {
    const claim = await claimLoginAttemptForIdentifier(
      'nobody-at-all@example.test'
    );
    expect(claim).toEqual({status: 'allowed'});
    const authDB = getAuthDB();
    const all = await authDB.allDocs({include_docs: true});
    const lockouts = all.rows.filter(row =>
      row.id.startsWith(AUTH_RECORD_ID_PREFIXES.loginlockout)
    );
    expect(lockouts).toHaveLength(0);
  });
});

describe('POST /auth/local login lockout', () => {
  beforeEach(async () => {
    await beforeApiTests();
    config.loginLockoutEnabled = true;
  });

  afterEach(() => {
    config.loginLockoutEnabled = false;
    vi.useRealTimers();
  });

  it('blocks a sixth attempt before the 10s delay and succeeds after it elapses', async () => {
    vi.useFakeTimers({toFake: ['Date']});
    const started = Date.now();
    vi.setSystemTime(started);

    for (let i = 0; i < 5; i++) {
      const failed = await request(app).post('/auth/local').send(loginBody());
      expect(failed.status).toBe(302);
      expect(failed.header.location).not.toMatch(/exchangeToken/);
    }

    const storedAfterFive = await getLoginLockoutForUserId(adminUserName);
    expect(storedAfterFive?.count).toBe(5);

    const blocked = await request(app)
      .post('/auth/local')
      .send(loginBody({password: adminPassword}));
    expect(blocked.status).toBe(302);
    const blockedLocation = new URL(
      blocked.header.location,
      'http://localhost'
    );
    expect(blockedLocation.pathname).toBe('/login');
    expect(blocked.header.location).not.toMatch(/exchangeToken/);

    vi.setSystemTime(started + LOCKOUT_PERIOD_SHORT_MS + 1);

    const success = await request(app)
      .post('/auth/local')
      .send(loginBody({password: adminPassword}));
    expect(success.status).toBe(302);
    expect(success.header.location).toMatch(/exchangeToken/);
    expect(await getLoginLockoutForUserId(adminUserName)).toBeNull();
  });

  it('does not authenticate the correct password while delayed', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).post('/auth/local').send(loginBody());
    }
    const blocked = await request(app)
      .post('/auth/local')
      .send(loginBody({password: adminPassword}));
    expect(blocked.status).toBe(302);
    expect(blocked.header.location).not.toMatch(/exchangeToken/);
  });

  it('does not bump count or restart the delay on blocked retries', async () => {
    vi.useFakeTimers({toFake: ['Date']});
    const started = Date.now();
    vi.setSystemTime(started);

    for (let i = 0; i < 5; i++) {
      await request(app).post('/auth/local').send(loginBody());
    }

    const afterFive = await getLoginLockoutForUserId(adminUserName);
    expect(afterFive?.count).toBe(5);
    const lastAttemptMs = afterFive!.lastAttemptMs;

    vi.setSystemTime(started + 3000);
    for (let i = 0; i < 3; i++) {
      const blocked = await request(app)
        .post('/auth/local')
        .send(loginBody({password: adminPassword}));
      expect(blocked.header.location).not.toMatch(/exchangeToken/);
    }

    const duringDelay = await getLoginLockoutForUserId(adminUserName);
    expect(duringDelay?.count).toBe(5);
    expect(duringDelay?.lastAttemptMs).toBe(lastAttemptMs);

    vi.setSystemTime(started + LOCKOUT_PERIOD_SHORT_MS + 1);
    await request(app).post('/auth/local').send(loginBody());
    const afterRealFailure = await getLoginLockoutForUserId(adminUserName);
    expect(afterRealFailure?.count).toBe(6);
  });

  it('clears lockout on success so the next failure starts at 1', async () => {
    vi.useFakeTimers({toFake: ['Date']});
    const started = Date.now();
    vi.setSystemTime(started);

    for (let i = 0; i < 5; i++) {
      await request(app).post('/auth/local').send(loginBody());
    }

    vi.setSystemTime(started + LOCKOUT_PERIOD_SHORT_MS + 1);

    const success = await request(app)
      .post('/auth/local')
      .send(loginBody({password: adminPassword}));
    expect(success.header.location).toMatch(/exchangeToken/);
    expect(await getLoginLockoutForUserId(adminUserName)).toBeNull();

    await request(app).post('/auth/local').send(loginBody());
    const stored = await getLoginLockoutForUserId(adminUserName);
    expect(stored?.count).toBe(1);
  });

  it('does not persist a lockout document when the flag is off', async () => {
    config.loginLockoutEnabled = false;
    for (let i = 0; i < 5; i++) {
      await request(app).post('/auth/local').send(loginBody());
    }
    expect(await getLoginLockoutForUserId(adminUserName)).toBeNull();

    const success = await request(app)
      .post('/auth/local')
      .send(loginBody({password: adminPassword}));
    expect(success.status).toBe(302);
    expect(success.header.location).toMatch(/exchangeToken/);
  });

  it('shares one lockout document across username and email HTTP logins', async () => {
    await request(app)
      .post('/auth/local')
      .send(loginBody({email: localUserName, password: 'wrong'}));
    await request(app)
      .post('/auth/local')
      .send(loginBody({email: localEmail, password: 'wrong'}));
    const stored = await getLoginLockoutForUserId(localUserName);
    expect(stored?.count).toBe(2);
  });

  it('creates no lockout document for an unknown identifier', async () => {
    await request(app)
      .post('/auth/local')
      .send(loginBody({email: 'ghost@example.test', password: 'wrong'}));
    const authDB = getAuthDB();
    const all = await authDB.allDocs({include_docs: true});
    const lockouts = all.rows.filter(row =>
      row.id.startsWith(AUTH_RECORD_ID_PREFIXES.loginlockout)
    );
    expect(lockouts).toHaveLength(0);
  });

  it('does not let a parallel burst exceed five guesses before lockout', async () => {
    const burst = await Promise.all(
      Array.from({length: 15}, () =>
        request(app).post('/auth/local').send(loginBody())
      )
    );
    for (const response of burst) {
      expect(response.status).toBe(302);
      expect(response.header.location).not.toMatch(/exchangeToken/);
    }

    const stored = await getLoginLockoutForUserId(adminUserName);
    expect(stored?.count).toBe(5);

    const blocked = await request(app)
      .post('/auth/local')
      .send(loginBody({password: adminPassword}));
    expect(blocked.header.location).not.toMatch(/exchangeToken/);
  });
});

describe('POST /auth/local with lockout left off (test default)', () => {
  beforeEach(beforeApiTests);

  it('authenticates admin immediately after five failures', async () => {
    expect(config.loginLockoutEnabled).toBe(false);
    for (let i = 0; i < 5; i++) {
      await request(app).post('/auth/local').send(loginBody());
    }
    expect(await getLoginLockoutForUserId(adminUserName)).toBeNull();
    const success = await request(app)
      .post('/auth/local')
      .send(loginBody({password: adminPassword}));
    expect(success.header.location).toMatch(/exchangeToken/);
  });
});

describe('correct-password fixture still works', () => {
  beforeEach(beforeApiTests);

  it('can log in as the local user', async () => {
    const success = await request(app)
      .post('/auth/local')
      .send(
        loginBody({
          email: localUserName,
          password: localUserPassword,
        })
      );
    expect(success.header.location).toMatch(/exchangeToken/);
  });
});
