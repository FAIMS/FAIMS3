// SPDX-License-Identifier: Apache-2.0
import PouchDB from 'pouchdb';
import PouchDBMemoryAdapter from 'pouchdb-adapter-memory';
import {
  DatabaseType,
  MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX,
  MIGRATION_VERSION_RECORD_KIND,
  buildCurrentVersionMigrationDoc,
  couchInitialiser,
  dbSetupDocId,
  findMigrationDoc,
  initMigrationsDB,
  isMigrationVersionRecord,
  type MigrationsDB,
} from '../src/data_storage';
import {DatabaseInterface} from '../src';

PouchDB.plugin(PouchDBMemoryAdapter);

const VERSION_FIELDS = {
  dbType: DatabaseType.PEOPLE,
  dbName: 'people',
  version: 5,
  status: 'healthy' as const,
  migrationLog: [
    {
      from: 0,
      to: 5,
      startedAtTimestampMs: 1,
      completedAtTimestampMs: 2,
      launchedBy: 'system',
      status: 'success' as const,
    },
  ],
};

describe('isMigrationVersionRecord', () => {
  it('accepts legacy records without kind and new records with db-version', () => {
    expect(isMigrationVersionRecord({_id: 'legacy', ...VERSION_FIELDS})).toBe(
      true
    );
    expect(
      isMigrationVersionRecord({
        _id: 'new',
        kind: MIGRATION_VERSION_RECORD_KIND,
        ...VERSION_FIELDS,
      })
    ).toBe(true);
  });

  it('rejects lock, marker, db-setup, and incomplete documents', () => {
    expect(
      isMigrationVersionRecord({
        _id: 'lock',
        kind: 'startup-migration-lock',
        ...VERSION_FIELDS,
      })
    ).toBe(false);
    expect(
      isMigrationVersionRecord({
        _id: 'notebook-ui-schema-state',
        kind: 'notebook-ui-schema',
        ...VERSION_FIELDS,
      })
    ).toBe(false);
    expect(
      isMigrationVersionRecord({
        _id: dbSetupDocId('PEOPLE', 'people'),
        kind: 'db-setup',
        dbType: 'PEOPLE',
        dbName: 'people',
      })
    ).toBe(false);
    expect(
      isMigrationVersionRecord({
        _id: 'no-log',
        dbType: DatabaseType.PEOPLE,
        dbName: 'people',
        version: 5,
      })
    ).toBe(false);
    expect(isMigrationVersionRecord(null)).toBe(false);
  });
});

describe('migrations DB views vs isMigrationVersionRecord', () => {
  let db: DatabaseInterface;
  let dbCounter = 0;

  beforeEach(async () => {
    dbCounter += 1;
    db = new PouchDB(`migration-view-parity-${dbCounter}`, {
      adapter: 'memory',
    }) as DatabaseInterface;
    await couchInitialiser({
      db,
      content: initMigrationsDB({}),
      config: {applyPermissions: false, forceWrite: true},
    });
  });

  afterEach(async () => {
    await db.destroy();
  });

  it('indexes only version records, matching the TypeScript predicate', async () => {
    const fixtures: Array<{_id: string} & Record<string, unknown>> = [
      {_id: 'legacy-people', ...VERSION_FIELDS},
      {
        _id: 'new-auth',
        kind: MIGRATION_VERSION_RECORD_KIND,
        dbType: DatabaseType.AUTH,
        dbName: 'auth',
        version: 1,
        status: 'healthy',
        migrationLog: VERSION_FIELDS.migrationLog,
      },
      {
        _id: 'startup-migration-lock',
        kind: 'startup-migration-lock',
        ...VERSION_FIELDS,
      },
      {
        _id: 'notebook-ui-schema-state',
        kind: 'notebook-ui-schema',
        schemaVersion: '1.0.1',
        ...VERSION_FIELDS,
      },
      {
        _id: dbSetupDocId('PEOPLE', 'people'),
        kind: 'db-setup',
        dbType: 'PEOPLE',
        dbName: 'people',
        version: 99,
        status: 'healthy',
        migrationLog: VERSION_FIELDS.migrationLog,
      },
      {_id: 'junk', hello: 'world'},
    ];
    for (const doc of fixtures) {
      await db.put(doc);
    }

    const all = await db.allDocs({include_docs: true});
    const byPredicate = all.rows
      .map(row => row.doc)
      .filter(doc => isMigrationVersionRecord(doc))
      .map(doc => doc!._id)
      .sort();

    const view = await db.query(MIGRATIONS_BY_DB_TYPE_AND_NAME_INDEX, {
      include_docs: true,
    });
    const byView = view.rows.map(row => row.id).sort();

    expect(byPredicate).toEqual(['legacy-people', 'new-auth']);
    expect(byView).toEqual(byPredicate);
  });

  it('findMigrationDoc ignores a db-setup doc for the same dbType and dbName', async () => {
    const setupId = dbSetupDocId('PEOPLE', 'people');
    await db.put({
      _id: setupId,
      kind: 'db-setup',
      dbType: DatabaseType.PEOPLE,
      dbName: 'people',
      version: 99,
      status: 'healthy',
      migrationLog: VERSION_FIELDS.migrationLog,
    });

    const missing = await findMigrationDoc({
      dbType: DatabaseType.PEOPLE,
      dbName: 'people',
      migrationDb: db as unknown as MigrationsDB,
    });
    expect(missing).toBeUndefined();

    const fields = buildCurrentVersionMigrationDoc({
      dbType: DatabaseType.PEOPLE,
      dbName: 'people',
    });
    const created = await db.post(fields);
    const found = await findMigrationDoc({
      dbType: DatabaseType.PEOPLE,
      dbName: 'people',
      migrationDb: db as unknown as MigrationsDB,
    });
    expect(found?._id).toBe(created.id);
    expect(found?.kind).toBe(MIGRATION_VERSION_RECORD_KIND);
  });
});
