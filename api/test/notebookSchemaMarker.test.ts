// SPDX-License-Identifier: Apache-2.0
import PouchDB from 'pouchdb';
import {afterEach, describe, expect, it} from 'vitest';
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  NOTEBOOK_UI_SCHEMA_MARKER_ID,
  NOTEBOOK_UI_SCHEMA_MARKER_KIND,
  type NotebookUiSchemaMarkerDoc,
} from '@faims3/data-model';
import {
  readNotebookSchemaMarker,
  writeNotebookSchemaMarker,
  type NotebookSchemaMarkerStore,
} from '../src/couchdb/notebookSchemaMarker';

function memoryDb(): PouchDB.Database {
  return new PouchDB(`marker-${Math.random().toString(36).slice(2)}`, {
    adapter: 'memory',
  });
}

function asStore(db: PouchDB.Database): NotebookSchemaMarkerStore {
  return db as unknown as NotebookSchemaMarkerStore;
}

async function seedMarker(
  db: PouchDB.Database,
  schemaVersion: unknown,
  extra: Record<string, unknown> = {}
): Promise<void> {
  await db.put({
    _id: NOTEBOOK_UI_SCHEMA_MARKER_ID,
    kind: NOTEBOOK_UI_SCHEMA_MARKER_KIND,
    schemaVersion,
    updatedAtMs: 1,
    ...extra,
  });
}

function getMarker(db: PouchDB.Database) {
  return db.get<NotebookUiSchemaMarkerDoc>(NOTEBOOK_UI_SCHEMA_MARKER_ID);
}

describe('notebook UI-schema marker writer', () => {
  const dbs: PouchDB.Database[] = [];
  const freshDb = () => {
    const db = memoryDb();
    dbs.push(db);
    return db;
  };

  afterEach(async () => {
    await Promise.all(dbs.splice(0).map(db => db.destroy()));
  });

  it('creates the marker at this build target with diagnostics', async () => {
    const db = freshDb();
    const result = await writeNotebookSchemaMarker({
      db: asStore(db),
      fingerprint: 'aabbccddeeff',
      apiVersion: '1.11.0',
      writerId: 'api-a',
      now: () => 42,
    });

    expect(result).toEqual({
      written: true,
      schemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
    });
    const marker = await getMarker(db);
    expect(marker).toMatchObject({
      kind: NOTEBOOK_UI_SCHEMA_MARKER_KIND,
      schemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
      updatedAtMs: 42,
      fingerprint: 'aabbccddeeff',
      apiVersion: '1.11.0',
      writerId: 'api-a',
    });
    expect(marker).not.toHaveProperty('dbType');
    expect((await readNotebookSchemaMarker(asStore(db)))?.schemaVersion).toBe(
      CURRENT_NOTEBOOK_UI_SCHEMA_VERSION
    );
  });

  it('never lowers an existing higher version', async () => {
    const db = freshDb();
    await seedMarker(db, '2.0.0', {apiVersion: '2.0.0'});
    const before = await getMarker(db);

    const result = await writeNotebookSchemaMarker({
      db: asStore(db),
      schemaVersion: '1.0.1',
      apiVersion: '1.11.0',
    });

    expect(result).toEqual({written: false, schemaVersion: '2.0.0'});
    const after = await getMarker(db);
    expect(after._rev).toBe(before._rev);
    expect(after.schemaVersion).toBe('2.0.0');
    expect(after.apiVersion).toBe('2.0.0');
  });

  it('raises an older version and overwrites a non-semver one', async () => {
    const older = freshDb();
    await seedMarker(older, '1.0.0');
    await writeNotebookSchemaMarker({
      db: asStore(older),
      schemaVersion: '1.0.1',
    });
    expect((await getMarker(older)).schemaVersion).toBe('1.0.1');

    const invalid = freshDb();
    await seedMarker(invalid, '7.0');
    expect(await readNotebookSchemaMarker(asStore(invalid))).not.toBeNull();
    await writeNotebookSchemaMarker({
      db: asStore(invalid),
      schemaVersion: '1.0.1',
    });
    expect((await getMarker(invalid)).schemaVersion).toBe('1.0.1');
  });

  it('retries after a 409 conflict and re-applies the max', async () => {
    const db = freshDb();
    await seedMarker(db, '1.0.0');
    const store = asStore(db);
    let puts = 0;
    const racing: NotebookSchemaMarkerStore = {
      get: id => store.get(id),
      put: async doc => {
        puts += 1;
        if (puts === 1) {
          // Another replica raises the marker between our read and put.
          const current = await getMarker(db);
          await db.put({...current, schemaVersion: '1.0.1', updatedAtMs: 2});
        }
        return store.put(doc);
      },
    };

    const result = await writeNotebookSchemaMarker({
      db: racing,
      schemaVersion: '1.0.1',
      now: () => 3,
    });

    expect(puts).toBe(2);
    expect(result).toEqual({written: true, schemaVersion: '1.0.1'});
    expect((await getMarker(db)).updatedAtMs).toBe(3);
  });

  it('throws once conflicts exhaust the attempt budget', async () => {
    const conflict = Object.assign(new Error('conflict'), {status: 409});
    let puts = 0;
    await expect(
      writeNotebookSchemaMarker({
        db: {
          get: async () => {
            throw Object.assign(new Error('missing'), {status: 404});
          },
          put: async () => {
            puts += 1;
            throw conflict;
          },
        },
        maxAttempts: 3,
      })
    ).rejects.toBe(conflict);
    expect(puts).toBe(3);
  });
});
