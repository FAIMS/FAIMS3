// SPDX-License-Identifier: Apache-2.0
import PouchDB from 'pouchdb';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  DatabaseType,
  DB_TARGET_VERSIONS,
  type MigrationsDBDocument,
  type MigrationsDBFields,
} from '@faims3/data-model';
import {
  ADMIN_ACTOR_PREFIX,
  classifyLock,
  collectStatus,
  deleteLock,
  describeDbVersion,
  EXPECTED_GLOBAL_DBS,
  filterDbRows,
  forceClaim,
  forceUnlock,
  formatDuration,
  formatStatusHuman,
  isDirectExecution,
  loadMigrationsDb,
  matchMigrationDocs,
  parseArgs,
  resolveMigrationDoc,
  runCommand,
  setDbHealth,
  setDbVersion,
  statusIsStrictFailure,
  summarizeDatabases,
  toDbRow,
  unregisterDb,
  type DebuggerDb,
} from '../scripts/debugMigrationLock';
import {
  STARTUP_MIGRATION_LOCK_ID,
  type StartupMigrationLockDoc,
} from '../src/couchdb/startupMigrationLock';

function memoryDb(): PouchDB.Database {
  return new PouchDB(`debug-lock-${Math.random().toString(36).slice(2)}`, {
    adapter: 'memory',
  });
}

function asDebuggerDb(db: PouchDB.Database): DebuggerDb {
  return db as unknown as DebuggerDb;
}

async function seedLock(
  db: PouchDB.Database,
  fields: Partial<StartupMigrationLockDoc> &
    Pick<StartupMigrationLockDoc, 'status' | 'holderId' | 'startedAtMs'>
): Promise<StartupMigrationLockDoc> {
  const doc: StartupMigrationLockDoc = {
    _id: STARTUP_MIGRATION_LOCK_ID,
    kind: 'startup-migration-lock',
    updatedAtMs: fields.startedAtMs,
    attempt: 1,
    history: [],
    ...fields,
  };
  await db.put(doc);
  return db.get<StartupMigrationLockDoc>(STARTUP_MIGRATION_LOCK_ID);
}

async function seedMigrationDoc(
  db: PouchDB.Database,
  fields: MigrationsDBFields & {_id?: string}
): Promise<MigrationsDBDocument> {
  const response = fields._id
    ? await db.put({...fields, _id: fields._id})
    : await db.post(fields);
  return db.get<MigrationsDBDocument>(response.id);
}

function peopleDoc(version = 5): MigrationsDBFields {
  return {
    dbType: DatabaseType.PEOPLE,
    dbName: 'people',
    version,
    status: 'healthy',
    migrationLog: [
      {
        from: 0,
        to: version,
        startedAtTimestampMs: 1,
        completedAtTimestampMs: 2,
        launchedBy: 'system',
        status: 'success',
        notes: 'seed',
      },
    ],
  };
}

describe('debug-migration-lock parseArgs', () => {
  it('defaults to status', () => {
    expect(parseArgs([])).toEqual({
      name: 'status',
      json: false,
      strict: false,
    });
  });

  it('parses write commands and flags', () => {
    expect(
      parseArgs([
        'unlock',
        '--status=failed',
        '--reason',
        'stuck',
        '--yes',
        '--force',
      ])
    ).toEqual({
      name: 'unlock',
      status: 'failed',
      reason: 'stuck',
      force: true,
      yes: true,
    });
    expect(
      parseArgs(['set-version', 'people', '4', '--create', '--type=PEOPLE'])
    ).toEqual({
      name: 'set-version',
      db: 'people',
      version: 4,
      type: DatabaseType.PEOPLE,
      create: true,
      reason: undefined,
      yes: false,
    });
    expect(parseArgs(['set-health', 'auth', 'not-healthy'])).toEqual({
      name: 'set-health',
      db: 'auth',
      health: 'not-healthy',
      type: undefined,
      yes: false,
    });
  });

  it('parses dbs filters and watch timings', () => {
    expect(
      parseArgs(['dbs', '--behind', '--unhealthy', '--type', 'data'])
    ).toEqual({
      name: 'dbs',
      json: false,
      type: DatabaseType.DATA,
      behind: true,
      ahead: false,
      unhealthy: true,
    });
    expect(
      parseArgs(['watch', '--interval-ms=500', '--timeout-ms', '1000'])
    ).toEqual({
      name: 'watch',
      intervalMs: 500,
      timeoutMs: 1000,
    });
  });

  it('treats --help as help even with a command', () => {
    expect(parseArgs(['unlock', '--help'])).toEqual({name: 'help'});
    expect(parseArgs(['--', '--help'])).toEqual({name: 'help'});
    expect(parseArgs(['--', 'status', '--json'])).toEqual({
      name: 'status',
      json: true,
      strict: false,
    });
  });

  it('rejects unknown commands and bad values', () => {
    expect(() => parseArgs(['explode'])).toThrow(/Unknown command/);
    expect(() => parseArgs(['unlock', '--status=maybe'])).toThrow(
      /complete or failed/
    );
    expect(() => parseArgs(['set-version', 'people'])).toThrow(/requires/);
    expect(() => parseArgs(['set-health', 'people', 'ok'])).toThrow(/healthy/);
    expect(() => parseArgs(['show'])).toThrow(/requires a database name/);
    expect(() => parseArgs(['dbs', '--type=WIDGET'])).toThrow(
      /Unknown database type/
    );
  });
});

describe('debug-migration-lock formatters and classifiers', () => {
  it('formats durations', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(1_250)).toBe('1s');
    expect(formatDuration(65_000)).toBe('1m 5s');
    expect(formatDuration(3_600_000 + 120_000)).toBe('1h 2m');
    expect(formatDuration(-1_500)).toBe('-1s');
  });

  it('classifies lock states', () => {
    expect(classifyLock(null, 10_000, 1_000).present).toBe(false);
    expect(
      classifyLock(
        {
          _id: STARTUP_MIGRATION_LOCK_ID,
          kind: 'startup-migration-lock',
          status: 'complete',
          holderId: 'api-a',
          startedAtMs: 0,
          updatedAtMs: 10,
          attempt: 2,
          history: [],
        },
        10_000,
        1_000
      ).interpretation
    ).toMatch(/completed/);

    const live = classifyLock(
      {
        _id: STARTUP_MIGRATION_LOCK_ID,
        kind: 'startup-migration-lock',
        status: 'running',
        holderId: 'api-a',
        startedAtMs: 9_500,
        updatedAtMs: 9_500,
        attempt: 1,
        history: [],
      },
      10_000,
      1_000
    );
    expect(live.expired).toBe(false);
    expect(live.stealable).toBe(false);
    expect(live.remainingMs).toBe(500);

    const expired = classifyLock(
      {
        _id: STARTUP_MIGRATION_LOCK_ID,
        kind: 'startup-migration-lock',
        status: 'running',
        holderId: 'dead',
        startedAtMs: 0,
        updatedAtMs: 0,
        attempt: 1,
        history: [],
      },
      10_000,
      1_000
    );
    expect(expired.expired).toBe(true);
    expect(expired.stealable).toBe(true);
  });

  it('describes current, behind, ahead, and unknown versions', () => {
    const peopleTarget = DB_TARGET_VERSIONS[DatabaseType.PEOPLE].targetVersion;
    expect(
      describeDbVersion({dbType: DatabaseType.PEOPLE, version: peopleTarget})
        .relation
    ).toBe('current');

    const behind = describeDbVersion({
      dbType: DatabaseType.PEOPLE,
      version: peopleTarget - 1,
    });
    expect(behind.relation).toBe('behind');
    expect(behind.pending).toEqual([
      expect.objectContaining({
        from: peopleTarget - 1,
        to: peopleTarget,
      }),
    ]);

    expect(
      describeDbVersion({
        dbType: DatabaseType.PEOPLE,
        version: peopleTarget + 3,
      }).relation
    ).toBe('ahead');
    expect(describeDbVersion({dbType: 'WIDGET', version: 1}).relation).toBe(
      'unknown-type'
    );
  });

  it('matches database selectors and rejects ambiguity', () => {
    const people = {
      _id: 'a',
      _rev: '1-a',
      ...peopleDoc(),
    } as MigrationsDBDocument;
    const data = {
      _id: 'b',
      _rev: '1-b',
      dbType: DatabaseType.DATA,
      dbName: 'data-people',
      version: 2,
      status: 'healthy',
      migrationLog: [],
    } as MigrationsDBDocument;

    expect(matchMigrationDocs([people, data], {db: 'people'})).toEqual([
      people,
    ]);
    expect(matchMigrationDocs([people, data], {db: 'PEOPLE'})).toEqual([
      people,
    ]);
    expect(resolveMigrationDoc([people, data], {db: 'a'})._id).toBe('a');
    expect(() =>
      resolveMigrationDoc(
        [
          people,
          {
            ...people,
            _id: 'c',
            dbName: 'people-archive',
          } as MigrationsDBDocument,
        ],
        {db: 'missing'}
      )
    ).toThrow(/No migration document/);
  });

  it('summarises rows and strict status failures', () => {
    const rows = [
      toDbRow({
        _id: '1',
        _rev: '1-1',
        ...peopleDoc(DB_TARGET_VERSIONS[DatabaseType.PEOPLE].targetVersion),
      }),
      toDbRow({
        _id: '2',
        _rev: '1-2',
        dbType: DatabaseType.AUTH,
        dbName: 'auth',
        version: 1,
        status: 'not-healthy',
        migrationLog: [],
      } as MigrationsDBDocument),
    ];
    expect(summarizeDatabases(rows)).toMatchObject({
      total: 2,
      current: 1,
      behind: 1,
      unhealthy: 1,
    });
    expect(
      filterDbRows(rows, {
        behind: true,
        ahead: false,
        unhealthy: false,
      }).map(row => row.dbName)
    ).toEqual(['auth']);

    const snapshot = collectStatus({
      couchUrl: 'http://localhost:5984',
      lockEnabled: true,
      timeoutMs: 1_000,
      nowMs: 10_000,
      lock: {
        _id: STARTUP_MIGRATION_LOCK_ID,
        kind: 'startup-migration-lock',
        status: 'running',
        holderId: 'api-a',
        startedAtMs: 9_500,
        updatedAtMs: 9_500,
        attempt: 1,
        history: [],
      },
      databases: [
        {
          _id: '1',
          _rev: '1-1',
          ...peopleDoc(),
        } as MigrationsDBDocument,
      ],
      unrecognised: [],
    });
    expect(statusIsStrictFailure(snapshot)).toBe(true);
    expect(formatStatusHuman(snapshot)).toContain('Live running lock');
    expect(snapshot.missingExpected.length).toBeGreaterThan(0);
  });

  it('does not treat argv of the test runner as a direct CLI run', () => {
    expect(isDirectExecution('/path/to/vitest')).toBe(false);
    expect(
      isDirectExecution(
        '/home/bak208/FAIMS/FAIMS3/api/scripts/debugMigrationLock.ts'
      )
    ).toBe(true);
  });
});

describe('debug-migration-lock mutations', () => {
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

  it('lists migration docs and skips design + lock documents', async () => {
    const db = freshDb();
    await db.put({_id: '_design/index', views: {}});
    await seedLock(db, {
      status: 'complete',
      holderId: 'api-a',
      startedAtMs: 1,
    });
    await seedMigrationDoc(db, peopleDoc());
    await db.put({_id: 'junk', hello: 'world'});

    const loaded = await loadMigrationsDb(asDebuggerDb(db));
    expect(loaded.lock?.status).toBe('complete');
    expect(loaded.databases).toHaveLength(1);
    expect(loaded.databases[0]?.dbName).toBe('people');
    expect(loaded.unrecognised).toEqual([
      expect.objectContaining({id: 'junk'}),
    ]);
    expect(EXPECTED_GLOBAL_DBS.some(item => item.dbName === 'people')).toBe(
      true
    );
    expect(EXPECTED_GLOBAL_DBS).toContainEqual({
      dbType: DatabaseType.TEAMS,
      dbName: 'teams',
    });
  });

  it('force-settles a running lock and no-ops a settled one', async () => {
    const db = freshDb();
    await seedLock(db, {
      status: 'running',
      holderId: 'crashed',
      startedAtMs: 1_000,
      attempt: 3,
    });

    const unlocked = await forceUnlock({
      db: asDebuggerDb(db),
      nowMs: 5_000,
      status: 'failed',
      reason: 'stuck doer',
    });
    expect(unlocked.changed).toBe(true);
    expect(unlocked.after?.status).toBe('failed');
    expect(unlocked.after?.error).toBe('stuck doer');
    expect(unlocked.after?.history[0]).toMatchObject({
      holderId: 'crashed',
      status: 'failed',
      error: 'stuck doer',
    });

    const again = await forceUnlock({
      db: asDebuggerDb(db),
      nowMs: 6_000,
      status: 'complete',
    });
    expect(again.changed).toBe(false);
    expect(again.after?.status).toBe('failed');

    const forced = await forceUnlock({
      db: asDebuggerDb(db),
      nowMs: 7_000,
      status: 'complete',
      force: true,
    });
    expect(forced.changed).toBe(true);
    expect(forced.after?.status).toBe('complete');
  });

  it('refuses to unlock a missing lock', async () => {
    const db = freshDb();
    await expect(
      forceUnlock({
        db: asDebuggerDb(db),
        nowMs: 1,
        status: 'complete',
      })
    ).rejects.toThrow(/No lock document/);
  });

  it('deletes the lock document', async () => {
    const db = freshDb();
    await seedLock(db, {
      status: 'failed',
      holderId: 'api-a',
      startedAtMs: 1,
    });
    const result = await deleteLock({db: asDebuggerDb(db)});
    expect(result.removed).toBe(true);
    await expect(db.get(STARTUP_MIGRATION_LOCK_ID)).rejects.toMatchObject({
      status: 404,
    });
    expect((await deleteLock({db: asDebuggerDb(db)})).removed).toBe(false);
  });

  it('claims a missing lock and refuses a live one without --force', async () => {
    const db = freshDb();
    const first = await forceClaim({
      db: asDebuggerDb(db),
      nowMs: 1_000,
      instanceId: 'admin-1',
      timeoutMs: 5_000,
    });
    expect(first.after.status).toBe('running');
    expect(first.after.holderId).toBe('admin-1');
    expect(first.stolen).toBe(false);

    await expect(
      forceClaim({
        db: asDebuggerDb(db),
        nowMs: 2_000,
        instanceId: 'admin-2',
        timeoutMs: 5_000,
      })
    ).rejects.toThrow(/still live/);

    const stolen = await forceClaim({
      db: asDebuggerDb(db),
      nowMs: 2_000,
      instanceId: 'admin-2',
      timeoutMs: 5_000,
      force: true,
    });
    expect(stolen.stolen).toBe(true);
    expect(stolen.after.holderId).toBe('admin-2');
    expect(stolen.after.attempt).toBe(2);
    expect(stolen.after.history[0]?.status).toBe('timed_out');
  });

  it('steals an expired running lock without --force', async () => {
    const db = freshDb();
    await seedLock(db, {
      status: 'running',
      holderId: 'dead',
      startedAtMs: 0,
    });
    const claimed = await forceClaim({
      db: asDebuggerDb(db),
      nowMs: 10_000,
      instanceId: 'admin',
      timeoutMs: 1_000,
    });
    expect(claimed.stolen).toBe(true);
    expect(claimed.after.holderId).toBe('admin');
  });

  it('sets, creates, and unregisters version documents', async () => {
    const db = freshDb();
    const existing = await seedMigrationDoc(db, peopleDoc(5));
    const loaded = await loadMigrationsDb(asDebuggerDb(db));

    const updated = await setDbVersion({
      db: asDebuggerDb(db),
      docs: loaded.databases,
      selector: {db: 'people'},
      version: 4,
      reason: 're-run v4→v5',
      nowMs: 50,
    });
    expect(updated.created).toBe(false);
    expect(updated.after.version).toBe(4);
    expect(
      updated.after.migrationLog[updated.after.migrationLog.length - 1]
    ).toMatchObject({
      from: 5,
      to: 4,
      launchedBy: ADMIN_ACTOR_PREFIX,
      notes: 're-run v4→v5',
    });
    expect(existing._id).toBe(updated.after._id);

    const created = await setDbVersion({
      db: asDebuggerDb(db),
      docs: loaded.databases,
      selector: {db: 'teams', type: DatabaseType.TEAMS},
      version: 1,
      create: true,
      nowMs: 60,
    });
    expect(created.created).toBe(true);
    expect(created.after.dbType).toBe(DatabaseType.TEAMS);
    expect(created.after.version).toBe(1);

    const afterCreate = await loadMigrationsDb(asDebuggerDb(db));
    const removed = await unregisterDb({
      db: asDebuggerDb(db),
      docs: afterCreate.databases,
      selector: {db: 'teams', type: DatabaseType.TEAMS},
    });
    expect(removed.removed).toBe(true);
    const leftover = await loadMigrationsDb(asDebuggerDb(db));
    expect(leftover.databases.map(doc => doc.dbName)).toEqual(['people']);
  });

  it('requires --create --type when the version document is missing', async () => {
    const db = freshDb();
    await expect(
      setDbVersion({
        db: asDebuggerDb(db),
        docs: [],
        selector: {db: 'people'},
        version: 5,
        nowMs: 1,
      })
    ).rejects.toThrow(/--create/);
    await expect(
      setDbVersion({
        db: asDebuggerDb(db),
        docs: [],
        selector: {db: 'people'},
        version: 5,
        create: true,
        nowMs: 1,
      })
    ).rejects.toThrow(/--type/);
  });

  it('updates health and no-ops when unchanged', async () => {
    const db = freshDb();
    await seedMigrationDoc(db, peopleDoc());
    const loaded = await loadMigrationsDb(asDebuggerDb(db));
    const changed = await setDbHealth({
      db: asDebuggerDb(db),
      docs: loaded.databases,
      selector: {db: 'people'},
      health: 'not-healthy',
      nowMs: 9,
    });
    expect(changed.changed).toBe(true);
    expect(changed.after.status).toBe('not-healthy');
    expect(
      changed.after.migrationLog[changed.after.migrationLog.length - 1]?.notes
    ).toMatch(/set-health/);

    const again = await setDbHealth({
      db: asDebuggerDb(db),
      docs: [changed.after],
      selector: {db: 'people'},
      health: 'not-healthy',
      nowMs: 10,
    });
    expect(again.changed).toBe(false);
  });

  it('writes only JSON to stdout for status --json', async () => {
    const db = freshDb();
    await seedMigrationDoc(db, peopleDoc());
    const stdout: string[] = [];
    const stderr: string[] = [];
    const logSpy = vi
      .spyOn(console, 'log')
      .mockImplementation((message?: unknown) => {
        stdout.push(String(message ?? ''));
      });
    const errSpy = vi
      .spyOn(console, 'error')
      .mockImplementation((message?: unknown) => {
        stderr.push(String(message ?? ''));
      });
    try {
      const result = await runCommand(
        {name: 'status', json: true, strict: false},
        {
          db: asDebuggerDb(db),
          nowMs: 10,
          timeoutMs: 1_000,
          confirm: async () => undefined,
        }
      );
      expect(result.exitCode).toBe(0);
      expect(stdout).toHaveLength(1);
      const parsed = JSON.parse(stdout[0]);
      expect(parsed.databases[0].dbName).toBe('people');
      expect(stderr.join('')).not.toContain('{');
    } finally {
      logSpy.mockRestore();
      errSpy.mockRestore();
    }
  });

  it('runs status --strict through the command dispatcher', async () => {
    const db = freshDb();
    await seedLock(db, {
      status: 'running',
      holderId: 'api-a',
      startedAtMs: 0,
    });
    const result = await runCommand(
      {name: 'status', json: true, strict: true},
      {
        db: asDebuggerDb(db),
        nowMs: 10,
        timeoutMs: 1_000,
        confirm: async () => undefined,
      }
    );
    expect(result.exitCode).toBe(1);
  });

  it('unlock via runCommand requires confirm and writes the settlement', async () => {
    const db = freshDb();
    await seedLock(db, {
      status: 'running',
      holderId: 'api-a',
      startedAtMs: 0,
    });
    const prompts: string[] = [];
    const result = await runCommand(
      {
        name: 'unlock',
        status: 'complete',
        yes: false,
        force: false,
        reason: 'manual',
      },
      {
        db: asDebuggerDb(db),
        nowMs: 25,
        instanceId: 'admin',
        timeoutMs: 1_000,
        confirm: async message => {
          prompts.push(message);
        },
      }
    );
    expect(result.exitCode).toBe(0);
    expect(prompts[0]).toMatch(/Force-settle/);
    const lock = await db.get<StartupMigrationLockDoc>(
      STARTUP_MIGRATION_LOCK_ID
    );
    expect(lock.status).toBe('complete');
  });
});
