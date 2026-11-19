// SPDX-License-Identifier: Apache-2.0
import PouchDB from 'pouchdb';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  DB_SETUP_DOC_KIND,
  dbSetupDocId,
  NOTEBOOK_UI_SCHEMA_MARKER_ID,
  STARTUP_MIGRATION_FINGERPRINT_LENGTH,
} from '@faims3/data-model';
import {getMigrationDb} from '../src/couchdb';
import {
  writeNotebookSchemaMarker,
  type NotebookSchemaMarkerStore,
} from '../src/couchdb/notebookSchemaMarker';
import {isStartupMigrationClusterAhead} from '../src/couchdb/startupMigrationAhead';
import {
  createStartupInstanceId,
  STARTUP_MIGRATION_LOCK_ID,
  STARTUP_MIGRATION_LOCK_IO_BACKOFF_MAX_MS,
  STARTUP_MIGRATION_LOCK_IO_BACKOFF_MS,
  STARTUP_MIGRATION_LOCK_IO_RETRIES,
  STARTUP_MIGRATION_LOG,
  STARTUP_MIGRATION_LOCK_TIMEOUT_MS,
  startupMigrationIoBackoffMs,
  withStartupMigrationLock,
  type StartupMigrationLockDoc,
  type StartupMigrationLockStore,
} from '../src/couchdb/startupMigrationLock';
import {
  newerNotebookSchemaVersion,
  resetAheadCheckDbs,
  seedFutureStampedNotebooks,
} from './futureNotebooks';

function memoryDb(): PouchDB.Database {
  return new PouchDB(`startup-lock-${Math.random().toString(36).slice(2)}`, {
    adapter: 'memory',
  });
}

function asStore(db: PouchDB.Database): StartupMigrationLockStore {
  return db as unknown as StartupMigrationLockStore;
}

async function readLock(
  db: PouchDB.Database
): Promise<StartupMigrationLockDoc> {
  return db.get<StartupMigrationLockDoc>(STARTUP_MIGRATION_LOCK_ID);
}

async function seedLock(
  db: PouchDB.Database,
  fields: Partial<StartupMigrationLockDoc> &
    Pick<StartupMigrationLockDoc, 'status' | 'holderId' | 'startedAtMs'>
): Promise<void> {
  await db.put({
    _id: STARTUP_MIGRATION_LOCK_ID,
    kind: 'startup-migration-lock',
    updatedAtMs: fields.startedAtMs,
    attempt: 1,
    history: [],
    ...fields,
  });
}

function couchBlip(): Error & {status: number} {
  return Object.assign(new Error('couch blip'), {status: 500});
}

function storeWithGetErrors(
  db: PouchDB.Database,
  shouldFail: () => boolean
): StartupMigrationLockStore {
  const store = asStore(db);
  return {
    get: async id => {
      if (shouldFail()) {
        throw couchBlip();
      }
      return store.get(id);
    },
    put: doc => store.put(doc),
  };
}

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(res => {
    resolve = res;
  });
  return {promise, resolve};
}

describe('startup migration lock', () => {
  const dbs: PouchDB.Database[] = [];

  const freshDb = () => {
    const db = memoryDb();
    dbs.push(db);
    return db;
  };

  afterEach(async () => {
    await Promise.all(
      dbs.splice(0).map(async db => {
        try {
          await db.destroy();
        } catch {
          // already destroyed
        }
      })
    );
  });

  it('createStartupInstanceId includes pid', () => {
    const id = createStartupInstanceId();
    expect(id).toContain(`:${process.pid}:`);
    expect(id.length).toBeGreaterThan(process.pid.toString().length);
  });

  it('default steal timeout is 30 minutes', () => {
    expect(STARTUP_MIGRATION_LOCK_TIMEOUT_MS).toBe(30 * 60 * 1000);
  });

  it('I/O backoff doubles from 1s and caps at 16s', () => {
    expect(STARTUP_MIGRATION_LOCK_IO_RETRIES).toBe(5);
    expect(STARTUP_MIGRATION_LOCK_IO_BACKOFF_MS).toBe(1_000);
    expect(STARTUP_MIGRATION_LOCK_IO_BACKOFF_MAX_MS).toBe(16_000);
    expect(startupMigrationIoBackoffMs(1)).toBe(1_000);
    expect(startupMigrationIoBackoffMs(2)).toBe(2_000);
    expect(startupMigrationIoBackoffMs(3)).toBe(4_000);
    expect(startupMigrationIoBackoffMs(4)).toBe(8_000);
    expect(startupMigrationIoBackoffMs(5)).toBe(16_000);
    expect(startupMigrationIoBackoffMs(6)).toBe(16_000);
  });

  it('first instance claims and runs', async () => {
    const db = freshDb();
    const run = vi.fn();

    const result = await withStartupMigrationLock({
      db: asStore(db),
      instanceId: 'api-a',
      run,
      pollIntervalMs: 10,
    });

    expect(result).toEqual({role: 'doer', status: 'complete'});
    expect(run).toHaveBeenCalledOnce();
    const lock = await readLock(db);
    expect(lock.status).toBe('complete');
    expect(lock.holderId).toBe('api-a');
    expect(lock.fingerprint).toMatch(
      new RegExp(`^[0-9a-f]{${STARTUP_MIGRATION_FINGERPRINT_LENGTH}}$`)
    );
    expect(lock.apiVersion).toEqual(expect.any(String));
    expect(lock.apiVersion?.length).toBeGreaterThan(0);
    expect(lock.history).toHaveLength(1);
    expect(lock.history[0]?.status).toBe('complete');
    expect(lock.history[0]?.fingerprint).toBe(lock.fingerprint);
    expect(lock.history[0]?.apiVersion).toBe(lock.apiVersion);
  });

  it('waiter proceeds after the doer completes and does not re-run', async () => {
    const db = freshDb();
    const started = deferred();
    const finish = deferred();
    const runA = vi.fn(async () => {
      started.resolve();
      await finish.promise;
    });
    const runB = vi.fn();

    const doer = withStartupMigrationLock({
      db: asStore(db),
      instanceId: 'api-a',
      run: runA,
      pollIntervalMs: 15,
    });
    await started.promise;

    const waiter = withStartupMigrationLock({
      db: asStore(db),
      instanceId: 'api-b',
      run: runB,
      pollIntervalMs: 15,
    });

    await new Promise(resolve => setTimeout(resolve, 40));
    expect(runB).not.toHaveBeenCalled();

    finish.resolve();
    const [doerResult, waiterResult] = await Promise.all([doer, waiter]);

    expect(doerResult).toEqual({role: 'doer', status: 'complete'});
    expect(waiterResult).toEqual({role: 'waiter', status: 'complete'});
    expect(runB).not.toHaveBeenCalled();
  });

  it('waiter respects a reported doer failure and does not retry', async () => {
    const db = freshDb();
    const started = deferred();
    const finish = deferred();
    const runA = vi.fn(async () => {
      started.resolve();
      await finish.promise;
      throw new Error('migrate exploded');
    });
    const runB = vi.fn();

    const doer = withStartupMigrationLock({
      db: asStore(db),
      instanceId: 'api-a',
      run: runA,
      pollIntervalMs: 15,
    });
    await started.promise;

    const waiter = withStartupMigrationLock({
      db: asStore(db),
      instanceId: 'api-b',
      run: runB,
      pollIntervalMs: 15,
    });

    finish.resolve();
    const [doerResult, waiterResult] = await Promise.all([doer, waiter]);

    expect(doerResult).toEqual({
      role: 'doer',
      status: 'failed',
      error: 'migrate exploded',
    });
    expect(waiterResult).toEqual({
      role: 'waiter',
      status: 'failed',
      error: 'migrate exploded',
    });
    expect(runB).not.toHaveBeenCalled();

    const lock = await readLock(db);
    expect(lock.status).toBe('failed');
    expect(lock.error).toBe('migrate exploded');
  });

  it('steals an expired running lock and re-attempts', async () => {
    const db = freshDb();
    await seedLock(db, {
      status: 'running',
      holderId: 'crashed-api',
      startedAtMs: 0,
    });
    const run = vi.fn();

    const result = await withStartupMigrationLock({
      db: asStore(db),
      instanceId: 'api-b',
      run,
      timeoutMs: 1_000,
      now: () => 10_000,
      pollIntervalMs: 5,
    });

    expect(result).toEqual({role: 'doer', status: 'complete'});
    expect(run).toHaveBeenCalledOnce();

    const lock = await readLock(db);
    expect(lock.holderId).toBe('api-b');
    expect(lock.status).toBe('complete');
    expect(lock.history[0]).toMatchObject({
      holderId: 'crashed-api',
      status: 'timed_out',
    });
    expect(lock.history[1]).toMatchObject({
      holderId: 'api-b',
      status: 'complete',
    });
  });

  it('a waiter times out, steals, and re-attempts', async () => {
    const db = freshDb();
    await seedLock(db, {
      status: 'running',
      holderId: 'crashed-api',
      startedAtMs: 1_000,
    });

    let nowMs = 1_000;
    const run = vi.fn();

    const result = await withStartupMigrationLock({
      db: asStore(db),
      instanceId: 'api-b',
      run,
      timeoutMs: 80,
      pollIntervalMs: 10,
      now: () => nowMs,
      sleep: async () => {
        nowMs += 30;
      },
    });

    expect(result).toEqual({role: 'doer', status: 'complete'});
    expect(run).toHaveBeenCalledOnce();
    expect(nowMs).toBeGreaterThanOrEqual(1_080);
    const lock = await readLock(db);
    expect(lock.holderId).toBe('api-b');
    expect(lock.history[0]?.status).toBe('timed_out');
  });

  it('only one waiter wins a steal race after timeout', async () => {
    const db = freshDb();
    await seedLock(db, {
      status: 'running',
      holderId: 'crashed-api',
      startedAtMs: 0,
    });

    const runA = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 40));
    });
    const runB = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 40));
    });

    const [first, second] = await Promise.all([
      withStartupMigrationLock({
        db: asStore(db),
        instanceId: 'watcher-a',
        run: runA,
        timeoutMs: 1,
        now: () => 10_000,
        pollIntervalMs: 10,
      }),
      withStartupMigrationLock({
        db: asStore(db),
        instanceId: 'watcher-b',
        run: runB,
        timeoutMs: 1,
        now: () => 10_000,
        pollIntervalMs: 10,
      }),
    ]);

    expect(runA.mock.calls.length + runB.mock.calls.length).toBe(1);
    expect([first.role, second.role].sort()).toEqual(['doer', 'waiter']);
    expect(first.status).toBe('complete');
    expect(second.status).toBe('complete');
  });

  it('a later startup wave re-claims a settled lock and runs again', async () => {
    const db = freshDb();
    const runA = vi.fn();
    const runB = vi.fn();

    await withStartupMigrationLock({
      db: asStore(db),
      instanceId: 'wave-1',
      run: runA,
      pollIntervalMs: 10,
    });
    await withStartupMigrationLock({
      db: asStore(db),
      instanceId: 'wave-2',
      run: runB,
      pollIntervalMs: 10,
    });

    expect(runA).toHaveBeenCalledOnce();
    expect(runB).toHaveBeenCalledOnce();
    const lock = await readLock(db);
    expect(lock.holderId).toBe('wave-2');
    expect(lock.attempt).toBe(2);
  });

  it('does not overwrite the lock if it was stolen during the run', async () => {
    const db = freshDb();

    const result = await withStartupMigrationLock({
      db: asStore(db),
      instanceId: 'slow-doer',
      pollIntervalMs: 10,
      run: async () => {
        const doc = await readLock(db);
        await db.put({
          ...doc,
          holderId: 'thief',
          startedAtMs: Date.now(),
          updatedAtMs: Date.now(),
          attempt: doc.attempt + 1,
          status: 'running',
        });
      },
    });

    expect(result).toEqual({role: 'doer', status: 'complete'});
    const lock = await readLock(db);
    expect(lock.holderId).toBe('thief');
    expect(lock.status).toBe('running');
  });

  it('two simultaneous first claims produce one doer and one waiter', async () => {
    const db = freshDb();
    const started = deferred();
    const finish = deferred();
    const runA = vi.fn(async () => {
      started.resolve();
      await finish.promise;
    });
    const runB = vi.fn(async () => {
      started.resolve();
      await finish.promise;
    });

    const first = withStartupMigrationLock({
      db: asStore(db),
      instanceId: 'api-a',
      run: runA,
      pollIntervalMs: 15,
    });
    const second = withStartupMigrationLock({
      db: asStore(db),
      instanceId: 'api-b',
      run: runB,
      pollIntervalMs: 15,
    });

    await started.promise;
    expect(runA.mock.calls.length + runB.mock.calls.length).toBe(1);

    finish.resolve();
    const results = await Promise.all([first, second]);
    expect(results.map(r => r.role).sort()).toEqual(['doer', 'waiter']);
    expect(runA.mock.calls.length + runB.mock.calls.length).toBe(1);
  });

  it('retries transient claim I/O then becomes the doer', async () => {
    const db = freshDb();
    let gets = 0;
    const run = vi.fn();

    const result = await withStartupMigrationLock({
      db: storeWithGetErrors(db, () => {
        gets += 1;
        return gets <= 2;
      }),
      instanceId: 'api-a',
      run,
      pollIntervalMs: 5,
      maxIoErrors: 5,
      ioBackoffMs: () => 1,
    });

    expect(result).toEqual({role: 'doer', status: 'complete'});
    expect(run).toHaveBeenCalledOnce();
    expect(gets).toBeGreaterThan(2);
  });

  it('waiter retries transient poll I/O then proceeds without running', async () => {
    const db = freshDb();
    const started = deferred();
    const finish = deferred();
    const runA = vi.fn(async () => {
      started.resolve();
      await finish.promise;
    });
    const runB = vi.fn();
    let waiterGets = 0;

    const doer = withStartupMigrationLock({
      db: asStore(db),
      instanceId: 'api-a',
      run: runA,
      pollIntervalMs: 15,
    });
    await started.promise;

    const waiter = withStartupMigrationLock({
      db: storeWithGetErrors(db, () => {
        waiterGets += 1;
        return waiterGets > 1 && waiterGets <= 3;
      }),
      instanceId: 'api-b',
      run: runB,
      pollIntervalMs: 15,
      maxIoErrors: 5,
      ioBackoffMs: () => 1,
    });

    await new Promise(resolve => setTimeout(resolve, 80));
    finish.resolve();
    const [doerResult, waiterResult] = await Promise.all([doer, waiter]);

    expect(doerResult).toEqual({role: 'doer', status: 'complete'});
    expect(waiterResult).toEqual({role: 'waiter', status: 'complete'});
    expect(runB).not.toHaveBeenCalled();
    expect(waiterGets).toBeGreaterThan(3);
  });

  it('a success resets the consecutive I/O error streak', async () => {
    const db = freshDb();
    const run = vi.fn();
    let gets = 0;

    const result = await withStartupMigrationLock({
      db: storeWithGetErrors(db, () => {
        gets += 1;
        return gets % 2 === 1;
      }),
      instanceId: 'api-a',
      run,
      pollIntervalMs: 5,
      maxIoErrors: 2,
      ioBackoffMs: () => 1,
    });

    expect(result).toEqual({role: 'doer', status: 'complete'});
    expect(run).toHaveBeenCalledOnce();
  });

  it('gives up after a consecutive I/O error streak', async () => {
    const db = freshDb();
    const run = vi.fn();
    const sleeps: number[] = [];

    await expect(
      withStartupMigrationLock({
        db: storeWithGetErrors(db, () => true),
        instanceId: 'api-a',
        run,
        pollIntervalMs: 5,
        maxIoErrors: 3,
        ioBackoffMs: n => n * 10,
        sleep: async ms => {
          sleeps.push(ms);
        },
      })
    ).rejects.toThrow('couch blip');

    expect(run).not.toHaveBeenCalled();
    expect(sleeps).toEqual([10, 20]);
  });

  it('stores fingerprint and apiVersion on claim, settle, and steal', async () => {
    const db = freshDb();
    await seedLock(db, {
      status: 'running',
      holderId: 'crashed-api',
      startedAtMs: 0,
      fingerprint: 'oldoldoldold',
      apiVersion: '1.10.0',
    });
    const run = vi.fn();

    await withStartupMigrationLock({
      db: asStore(db),
      instanceId: 'api-b',
      run,
      fingerprint: 'newnewnewnew',
      apiVersion: '1.11.0',
      timeoutMs: 1_000,
      now: () => 10_000,
      pollIntervalMs: 5,
    });

    const lock = await readLock(db);
    expect(lock.fingerprint).toBe('newnewnewnew');
    expect(lock.apiVersion).toBe('1.11.0');
    expect(lock.history[0]).toMatchObject({
      holderId: 'crashed-api',
      status: 'timed_out',
      fingerprint: 'oldoldoldold',
      apiVersion: '1.10.0',
    });
    expect(lock.history[1]).toMatchObject({
      holderId: 'api-b',
      status: 'complete',
      fingerprint: 'newnewnewnew',
      apiVersion: '1.11.0',
    });
  });

  it('matching waiter proceeds after complete and does not invoke run', async () => {
    const db = freshDb();
    const started = deferred();
    const finish = deferred();
    const runA = vi.fn(async () => {
      started.resolve();
      await finish.promise;
    });
    const runB = vi.fn();

    const doer = withStartupMigrationLock({
      db: asStore(db),
      instanceId: 'api-a',
      run: runA,
      fingerprint: 'same-fingerprint',
      apiVersion: '1.11.0',
      pollIntervalMs: 15,
    });
    await started.promise;

    const waiter = withStartupMigrationLock({
      db: asStore(db),
      instanceId: 'api-b',
      run: runB,
      fingerprint: 'same-fingerprint',
      apiVersion: '1.11.0',
      pollIntervalMs: 15,
    });

    finish.resolve();
    const [doerResult, waiterResult] = await Promise.all([doer, waiter]);

    expect(doerResult).toEqual({role: 'doer', status: 'complete'});
    expect(waiterResult).toEqual({role: 'waiter', status: 'complete'});
    expect(runB).not.toHaveBeenCalled();
  });

  it('mismatched fingerprint re-claims and runs after a foreign complete', async () => {
    const db = freshDb();
    const started = deferred();
    const finish = deferred();
    const runOld = vi.fn(async () => {
      started.resolve();
      await finish.promise;
    });
    const runNew = vi.fn();
    const logs: string[] = [];
    const logSpy = vi
      .spyOn(console, 'log')
      .mockImplementation((message?: unknown) => {
        logs.push(String(message ?? ''));
      });

    try {
      const doer = withStartupMigrationLock({
        db: asStore(db),
        instanceId: 'old-api',
        run: runOld,
        fingerprint: 'old-fingerprint',
        apiVersion: '1.10.0',
        pollIntervalMs: 15,
      });
      await started.promise;

      const waiter = withStartupMigrationLock({
        db: asStore(db),
        instanceId: 'new-api',
        run: runNew,
        fingerprint: 'new-fingerprint',
        apiVersion: '1.11.0',
        pollIntervalMs: 15,
      });

      finish.resolve();
      const [doerResult, waiterResult] = await Promise.all([doer, waiter]);

      expect(doerResult).toEqual({role: 'doer', status: 'complete'});
      expect(waiterResult).toEqual({role: 'doer', status: 'complete'});
      expect(runNew).toHaveBeenCalledOnce();
      expect(
        logs.some(line => line.includes('doer_settled_foreign_fingerprint'))
      ).toBe(true);
    } finally {
      logSpy.mockRestore();
    }

    const lock = await readLock(db);
    expect(lock.holderId).toBe('new-api');
    expect(lock.fingerprint).toBe('new-fingerprint');
    expect(lock.status).toBe('complete');
  });

  it('legacy settled lock with no fingerprint re-claims and runs', async () => {
    const db = freshDb();
    await seedLock(db, {
      status: 'complete',
      holderId: 'legacy-api',
      startedAtMs: 1,
    });
    const run = vi.fn();

    const result = await withStartupMigrationLock({
      db: asStore(db),
      instanceId: 'new-api',
      run,
      fingerprint: 'new-fingerprint',
      apiVersion: '1.11.0',
      pollIntervalMs: 10,
    });

    expect(result).toEqual({role: 'doer', status: 'complete'});
    expect(run).toHaveBeenCalledOnce();
    const lock = await readLock(db);
    expect(lock.holderId).toBe('new-api');
    expect(lock.fingerprint).toBe('new-fingerprint');
    expect(lock.history.some(row => row.holderId === 'legacy-api')).toBe(false);
  });

  it('waiter observing a legacy complete (no fingerprint) logs foreign and re-claims', async () => {
    const db = freshDb();
    await seedLock(db, {
      status: 'running',
      holderId: 'legacy-api',
      startedAtMs: Date.now(),
    });
    const run = vi.fn();
    const logs: string[] = [];
    const logSpy = vi
      .spyOn(console, 'log')
      .mockImplementation((message?: unknown) => {
        logs.push(String(message ?? ''));
      });

    try {
      const waiter = withStartupMigrationLock({
        db: asStore(db),
        instanceId: 'new-api',
        run,
        fingerprint: 'new-fingerprint',
        apiVersion: '1.11.0',
        pollIntervalMs: 15,
        timeoutMs: 30_000,
      });

      await new Promise(resolve => setTimeout(resolve, 30));
      const running = await readLock(db);
      expect(running.status).toBe('running');
      const {_rev, ...rest} = running;
      await db.put({
        ...rest,
        _rev,
        status: 'complete',
      });

      const result = await waiter;
      expect(result).toEqual({role: 'doer', status: 'complete'});
      expect(run).toHaveBeenCalledOnce();
      expect(
        logs.some(line => line.includes('doer_settled_foreign_fingerprint'))
      ).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('does not steal a live running lock just because the fingerprint differs', async () => {
    const db = freshDb();
    const started = deferred();
    const finish = deferred();
    const runOld = vi.fn(async () => {
      started.resolve();
      await finish.promise;
    });
    const runNew = vi.fn();

    const doer = withStartupMigrationLock({
      db: asStore(db),
      instanceId: 'old-api',
      run: runOld,
      fingerprint: 'old-fingerprint',
      apiVersion: '1.10.0',
      pollIntervalMs: 15,
    });
    await started.promise;

    const waiter = withStartupMigrationLock({
      db: asStore(db),
      instanceId: 'new-api',
      run: runNew,
      fingerprint: 'new-fingerprint',
      apiVersion: '1.11.0',
      pollIntervalMs: 15,
      timeoutMs: 30_000,
    });

    await new Promise(resolve => setTimeout(resolve, 40));
    expect(runNew).not.toHaveBeenCalled();

    finish.resolve();
    const [doerResult, waiterResult] = await Promise.all([doer, waiter]);

    expect(doerResult).toEqual({role: 'doer', status: 'complete'});
    expect(waiterResult).toEqual({role: 'doer', status: 'complete'});
    expect(runNew).toHaveBeenCalledOnce();
  });

  it('old-after-new downgrade throw settles failed without rejecting', async () => {
    const db = freshDb();
    await withStartupMigrationLock({
      db: asStore(db),
      instanceId: 'new-api',
      run: vi.fn(),
      fingerprint: 'new-fingerprint',
      apiVersion: '1.11.0',
      pollIntervalMs: 10,
    });

    const result = await withStartupMigrationLock({
      db: asStore(db),
      instanceId: 'old-api',
      run: async () => {
        throw new Error(
          'Cannot downgrade databases. The DB is at version 6 and the target version is 5.'
        );
      },
      fingerprint: 'old-fingerprint',
      apiVersion: '1.10.0',
      pollIntervalMs: 10,
    });

    expect(result).toEqual({
      role: 'doer',
      status: 'failed',
      error:
        'Cannot downgrade databases. The DB is at version 6 and the target version is 5.',
    });
    const lock = await readLock(db);
    expect(lock.status).toBe('failed');
    expect(lock._id).toBe(STARTUP_MIGRATION_LOCK_ID);
    expect(lock._rev).toEqual(expect.any(String));
    expect(lock.fingerprint).toBe('old-fingerprint');
    expect(lock.history[lock.history.length - 1]).toMatchObject({
      holderId: 'old-api',
      status: 'failed',
      fingerprint: 'old-fingerprint',
      apiVersion: '1.10.0',
    });
    expect(lock.history.length).toBeLessThanOrEqual(10);
  });

  it('skips becoming doer when a foreign complete lock is already ahead', async () => {
    const db = freshDb();
    await withStartupMigrationLock({
      db: asStore(db),
      instanceId: 'new-api',
      run: vi.fn(),
      fingerprint: 'new-fingerprint',
      apiVersion: '1.11.0',
      pollIntervalMs: 10,
    });
    const before = await readLock(db);
    const run = vi.fn();
    const isClusterAhead = vi.fn(async () => true);
    const logs: string[] = [];
    const logSpy = vi
      .spyOn(console, 'log')
      .mockImplementation((message?: unknown) => {
        logs.push(String(message ?? ''));
      });

    try {
      const result = await withStartupMigrationLock({
        db: asStore(db),
        instanceId: 'old-api',
        run,
        fingerprint: 'old-fingerprint',
        apiVersion: '1.10.0',
        pollIntervalMs: 10,
        isClusterAhead,
      });

      expect(result).toEqual({role: 'waiter', status: 'complete'});
      expect(run).not.toHaveBeenCalled();
      expect(isClusterAhead).toHaveBeenCalled();
      expect(logs.some(line => line.includes('skip_doer_cluster_ahead'))).toBe(
        true
      );
    } finally {
      logSpy.mockRestore();
    }

    const after = await readLock(db);
    expect(after.fingerprint).toBe('new-fingerprint');
    expect(after.status).toBe('complete');
    expect(after._rev).toBe(before._rev);
    expect(after.holderId).toBe('new-api');
  });

  it('waiter observing a foreign complete skips claim when the cluster is ahead', async () => {
    const db = freshDb();
    const started = deferred();
    const finish = deferred();
    const runNew = vi.fn(async () => {
      started.resolve();
      await finish.promise;
    });
    const runOld = vi.fn();
    const isClusterAhead = vi.fn(async () => true);

    const doer = withStartupMigrationLock({
      db: asStore(db),
      instanceId: 'new-api',
      run: runNew,
      fingerprint: 'new-fingerprint',
      apiVersion: '1.11.0',
      pollIntervalMs: 15,
    });
    await started.promise;

    const waiter = withStartupMigrationLock({
      db: asStore(db),
      instanceId: 'old-api',
      run: runOld,
      fingerprint: 'old-fingerprint',
      apiVersion: '1.10.0',
      pollIntervalMs: 15,
      isClusterAhead,
    });

    finish.resolve();
    const [doerResult, waiterResult] = await Promise.all([doer, waiter]);

    expect(doerResult).toEqual({role: 'doer', status: 'complete'});
    expect(waiterResult).toEqual({role: 'waiter', status: 'complete'});
    expect(runOld).not.toHaveBeenCalled();
    expect(isClusterAhead).toHaveBeenCalled();
    const lock = await readLock(db);
    expect(lock.fingerprint).toBe('new-fingerprint');
    expect(lock.status).toBe('complete');
    expect(lock.holderId).toBe('new-api');
  });

  it('still re-claims a foreign complete when the cluster is not ahead', async () => {
    const db = freshDb();
    await withStartupMigrationLock({
      db: asStore(db),
      instanceId: 'old-api',
      run: vi.fn(),
      fingerprint: 'old-fingerprint',
      apiVersion: '1.10.0',
      pollIntervalMs: 10,
    });
    const run = vi.fn();

    const result = await withStartupMigrationLock({
      db: asStore(db),
      instanceId: 'new-api',
      run,
      fingerprint: 'new-fingerprint',
      apiVersion: '1.11.0',
      pollIntervalMs: 10,
      isClusterAhead: async () => false,
    });

    expect(result).toEqual({role: 'doer', status: 'complete'});
    expect(run).toHaveBeenCalledOnce();
    const lock = await readLock(db);
    expect(lock.fingerprint).toBe('new-fingerprint');
    expect(lock.holderId).toBe('new-api');
  });

  it('re-claims a foreign complete when isClusterAhead throws', async () => {
    const db = freshDb();
    await withStartupMigrationLock({
      db: asStore(db),
      instanceId: 'new-api',
      run: vi.fn(),
      fingerprint: 'new-fingerprint',
      apiVersion: '1.11.0',
      pollIntervalMs: 10,
    });
    const run = vi.fn();
    const logs: string[] = [];
    const logSpy = vi
      .spyOn(console, 'log')
      .mockImplementation((message?: unknown) => {
        logs.push(String(message ?? ''));
      });

    try {
      const result = await withStartupMigrationLock({
        db: asStore(db),
        instanceId: 'old-api',
        run,
        fingerprint: 'old-fingerprint',
        apiVersion: '1.10.0',
        pollIntervalMs: 10,
        isClusterAhead: async () => {
          throw new Error('listing failed');
        },
      });

      expect(result).toEqual({role: 'doer', status: 'complete'});
      expect(run).toHaveBeenCalledOnce();
      expect(
        logs.some(line => line.includes('cluster_ahead_check_failed'))
      ).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('matching fingerprint still re-claims even when isClusterAhead is true', async () => {
    const db = freshDb();
    await withStartupMigrationLock({
      db: asStore(db),
      instanceId: 'api-a',
      run: vi.fn(),
      fingerprint: 'same-fingerprint',
      apiVersion: '1.11.0',
      pollIntervalMs: 10,
    });
    const run = vi.fn();
    const isClusterAhead = vi.fn(async () => true);

    const result = await withStartupMigrationLock({
      db: asStore(db),
      instanceId: 'api-b',
      run,
      fingerprint: 'same-fingerprint',
      apiVersion: '1.11.0',
      pollIntervalMs: 10,
      isClusterAhead,
    });

    expect(result).toEqual({role: 'doer', status: 'complete'});
    expect(run).toHaveBeenCalledOnce();
    expect(isClusterAhead).not.toHaveBeenCalled();
  });

  it('named lock events include fingerprint=', async () => {
    const db = freshDb();
    const started = deferred();
    const finish = deferred();
    const logs: string[] = [];
    const logSpy = vi
      .spyOn(console, 'log')
      .mockImplementation((message?: unknown) => {
        logs.push(String(message ?? ''));
      });

    try {
      const doer = withStartupMigrationLock({
        db: asStore(db),
        instanceId: 'api-a',
        fingerprint: 'log-fingerprint',
        apiVersion: '1.11.0',
        pollIntervalMs: 15,
        run: async () => {
          started.resolve();
          await finish.promise;
        },
      });
      await started.promise;

      const waiter = withStartupMigrationLock({
        db: asStore(db),
        instanceId: 'api-b',
        fingerprint: 'log-fingerprint',
        apiVersion: '1.11.0',
        pollIntervalMs: 15,
        run: vi.fn(),
      });

      await new Promise(resolve => setTimeout(resolve, 40));
      finish.resolve();
      await Promise.all([doer, waiter]);

      const required = [
        'begin',
        'claimed',
        'wait_for_doer',
        'still_waiting',
        'doer_settled',
        'settled',
        'finish',
      ];
      for (const event of required) {
        const line = logs.find(entry =>
          entry.startsWith(`${STARTUP_MIGRATION_LOG} ${event} `)
        );
        expect(line, `missing ${event}`).toBeDefined();
        expect(line).toContain('fingerprint=log-fingerprint');
      }
    } finally {
      logSpy.mockRestore();
    }
  });
});

describe('startup migration lock with the live ahead check', () => {
  const migrationsDb = () => getMigrationDb() as unknown as PouchDB.Database;

  beforeEach(async () => {
    await resetAheadCheckDbs();
    await seedLock(migrationsDb(), {
      status: 'complete',
      holderId: 'previous-api',
      startedAtMs: 1,
      fingerprint: 'previous-fingerprint',
      apiVersion: '1.10.0',
    });
  });

  it('claims and runs after a foreign settlement despite future-stamped notebooks', async () => {
    await seedFutureStampedNotebooks();
    const run = vi.fn(async () => {
      await writeNotebookSchemaMarker({
        db: getMigrationDb() as unknown as NotebookSchemaMarkerStore,
      });
    });

    const result = await withStartupMigrationLock({
      db: asStore(migrationsDb()),
      instanceId: 'upgraded-api',
      run,
      fingerprint: 'upgraded-fingerprint',
      apiVersion: '1.11.0',
      pollIntervalMs: 10,
      isClusterAhead: isStartupMigrationClusterAhead,
    });

    expect(result).toEqual({role: 'doer', status: 'complete'});
    expect(run).toHaveBeenCalledOnce();
    const lock = await readLock(migrationsDb());
    expect(lock.fingerprint).toBe('upgraded-fingerprint');
    expect(lock.holderId).toBe('upgraded-api');
    const marker = await migrationsDb().get<{schemaVersion: string}>(
      NOTEBOOK_UI_SCHEMA_MARKER_ID
    );
    expect(marker.schemaVersion).toBe(CURRENT_NOTEBOOK_UI_SCHEMA_VERSION);
  });

  it('skips becoming doer after a foreign settlement when the marker is newer', async () => {
    await writeNotebookSchemaMarker({
      db: getMigrationDb() as unknown as NotebookSchemaMarkerStore,
      schemaVersion: newerNotebookSchemaVersion(),
    });
    const before = await readLock(migrationsDb());
    const run = vi.fn();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      const result = await withStartupMigrationLock({
        db: asStore(migrationsDb()),
        instanceId: 'older-api',
        run,
        fingerprint: 'older-fingerprint',
        apiVersion: '1.9.0',
        pollIntervalMs: 10,
        isClusterAhead: isStartupMigrationClusterAhead,
      });

      expect(result).toEqual({role: 'waiter', status: 'complete'});
    } finally {
      logSpy.mockRestore();
    }
    expect(run).not.toHaveBeenCalled();
    const after = await readLock(migrationsDb());
    expect(after._rev).toBe(before._rev);
    expect(after.fingerprint).toBe('previous-fingerprint');
  });

  it('skips becoming doer after a foreign settlement when a setup version is newer', async () => {
    const setupId = dbSetupDocId('PEOPLE', 'people');
    const existing = await migrationsDb().get(setupId);
    await migrationsDb().put({
      _id: setupId,
      _rev: existing._rev,
      kind: DB_SETUP_DOC_KIND,
      dbType: 'PEOPLE',
      dbName: 'people',
      design: {version: 99, hash: 'ahead', updatedAtMs: 1},
    });
    const before = await readLock(migrationsDb());
    const run = vi.fn();

    const result = await withStartupMigrationLock({
      db: asStore(migrationsDb()),
      instanceId: 'older-api',
      run,
      fingerprint: 'older-fingerprint',
      apiVersion: '1.9.0',
      pollIntervalMs: 10,
      isClusterAhead: isStartupMigrationClusterAhead,
    });

    expect(result).toEqual({role: 'waiter', status: 'complete'});
    expect(run).not.toHaveBeenCalled();
    const after = await readLock(migrationsDb());
    expect(after._rev).toBe(before._rev);
  });
});
