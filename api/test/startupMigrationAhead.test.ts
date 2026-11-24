// SPDX-License-Identifier: Apache-2.0
import {beforeEach, describe, expect, it} from 'vitest';
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  DatabaseType,
  DB_SETUP_DOC_KIND,
  DB_SETUP_VERSIONS,
  dbSetupDocId,
  DB_TARGET_VERSIONS,
  NOTEBOOK_UI_SCHEMA_MARKER_ID,
  NOTEBOOK_UI_SCHEMA_MARKER_KIND,
} from '@faims3/data-model';
import {getMigrationDb} from '../src/couchdb';
import {
  isStartupMigrationClusterAhead,
  readStartupMigrationAheadReasons,
} from '../src/couchdb/startupMigrationAhead';
import {STARTUP_MIGRATION_LOCK_ID} from '../src/couchdb/startupMigrationLock';
import {
  newerNotebookSchemaVersion,
  resetAheadCheckDbs,
  seedFutureStampedNotebooks,
} from './futureNotebooks';

type MigrationsDbDocs = {
  put: (doc: Record<string, unknown>) => Promise<unknown>;
  get: (id: string) => Promise<Record<string, unknown> & {_rev: string}>;
  allDocs: (opts: {include_docs: boolean}) => Promise<{
    rows: Array<{id: string; doc?: Record<string, unknown>}>;
  }>;
};

const migrations = () => getMigrationDb() as unknown as MigrationsDbDocs;

/** Insert or replace a migrations-DB document. */
async function upsert(doc: {_id: string} & Record<string, unknown>) {
  try {
    const existing = await migrations().get(doc._id);
    await migrations().put({...doc, _rev: existing._rev});
  } catch {
    await migrations().put(doc);
  }
}

async function putMarker(schemaVersion: string): Promise<void> {
  await upsert({
    _id: NOTEBOOK_UI_SCHEMA_MARKER_ID,
    kind: NOTEBOOK_UI_SCHEMA_MARKER_KIND,
    schemaVersion,
    updatedAtMs: 1,
  });
}

describe('startupMigrationAhead', () => {
  beforeEach(async () => {
    await resetAheadCheckDbs();
  });

  it('is not ahead for future-stamped notebooks when there is no marker', async () => {
    await seedFutureStampedNotebooks();

    await expect(readStartupMigrationAheadReasons()).resolves.toEqual([]);
    await expect(isStartupMigrationClusterAhead()).resolves.toBe(false);
  });

  it('is not ahead for future-stamped notebooks when the marker is current', async () => {
    await seedFutureStampedNotebooks();
    await putMarker(CURRENT_NOTEBOOK_UI_SCHEMA_VERSION);

    await expect(isStartupMigrationClusterAhead()).resolves.toBe(false);
  });

  it('is ahead when the notebook marker is newer than this process', async () => {
    const future = newerNotebookSchemaVersion();
    await putMarker(future);

    await expect(readStartupMigrationAheadReasons()).resolves.toEqual([
      {
        kind: 'notebook',
        liveVersion: future,
        targetVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
      },
    ]);
    await expect(isStartupMigrationClusterAhead()).resolves.toBe(true);
  });

  it('does not treat the marker, lock, or design docs as DB version docs', async () => {
    const authTarget = DB_TARGET_VERSIONS[DatabaseType.AUTH].targetVersion;
    const dbVersionFields = {
      dbType: DatabaseType.AUTH,
      dbName: 'auth',
      version: 99,
    };
    await upsert({_id: '_design/ahead-test', ...dbVersionFields});
    await upsert({
      _id: STARTUP_MIGRATION_LOCK_ID,
      kind: 'startup-migration-lock',
      ...dbVersionFields,
    });
    await upsert({
      _id: NOTEBOOK_UI_SCHEMA_MARKER_ID,
      kind: NOTEBOOK_UI_SCHEMA_MARKER_KIND,
      schemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
      updatedAtMs: 1,
      ...dbVersionFields,
    });
    await upsert({
      _id: 'mig-auth',
      kind: 'db-version',
      dbType: DatabaseType.AUTH,
      dbName: 'auth',
      version: authTarget,
      status: 'healthy',
      migrationLog: [],
    });

    await expect(readStartupMigrationAheadReasons()).resolves.toEqual([]);
  });

  it('still reports a DB version past this process', async () => {
    const authTarget = DB_TARGET_VERSIONS[DatabaseType.AUTH].targetVersion;
    await upsert({
      _id: 'mig-auth',
      kind: 'db-version',
      dbType: DatabaseType.AUTH,
      dbName: 'auth',
      version: authTarget + 1,
      status: 'healthy',
      migrationLog: [],
    });

    await expect(readStartupMigrationAheadReasons()).resolves.toEqual([
      {
        kind: 'db',
        dbType: DatabaseType.AUTH,
        dbName: 'auth',
        liveVersion: authTarget + 1,
        targetVersion: authTarget,
      },
    ]);
  });

  it('is ahead when a db-setup version is past this process', async () => {
    await upsert({
      _id: dbSetupDocId('PEOPLE', 'people'),
      kind: DB_SETUP_DOC_KIND,
      dbType: 'PEOPLE',
      dbName: 'people',
      design: {version: 99, hash: 'abc', updatedAtMs: 1},
    });

    await expect(readStartupMigrationAheadReasons()).resolves.toEqual([
      {
        kind: 'setup',
        part: 'design',
        setupType: 'PEOPLE',
        dbName: 'people',
        liveVersion: 99,
        targetVersion: DB_SETUP_VERSIONS.PEOPLE.design,
      },
    ]);
  });

  it('does not treat a db-setup document as a DB version record', async () => {
    await upsert({
      _id: dbSetupDocId('AUTH', 'auth'),
      kind: DB_SETUP_DOC_KIND,
      dbType: 'AUTH',
      dbName: 'auth',
      version: 99,
      status: 'healthy',
      migrationLog: [],
      design: {version: 1, hash: 'abc', updatedAtMs: 1},
    });

    await expect(readStartupMigrationAheadReasons()).resolves.toEqual([]);
  });
});
