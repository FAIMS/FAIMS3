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
 *
 * Description:
 *
 * Tests the tile database v1 -> v2 data migration.
 *
 * The main invariant is that every legacy `@project/...` tile-set identifier
 * becomes a generated offline-map ID and all tile membership references follow
 * the new ID.
 */

import 'fake-indexeddb/auto';
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';
import {OFFLINE_MAP_ID_PREFIX} from '../../tileStoreUtils';
import {migrateV1ToV2, validateV2} from './migrateV2';
import {requestAsPromise} from '../idbUtils';

const DB_NAME = 'tiles_db-migrate-v2-test';

/**
 * Convert an IndexedDB transaction into a Promise so tests can wait for it
 * to complete or abort.
 */
function transactionAsPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();

    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted'));

    transaction.onerror = () => {
      // The transaction will abort after an unhandled request error.
      console.error('IndexedDB transaction error', transaction.error);
    };
  });
}

/**
 * Create a v1 test database with the object stores used by the migration.
 */
async function openV1Db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      db.createObjectStore('tiles', {keyPath: ['url']});
      db.createObjectStore('tileSets', {keyPath: ['setName']});
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Seed the v1 database with legacy project tile sets, an existing non-legacy
 * tile set, and cached tiles that reference both.
 */
async function seedV1(db: IDBDatabase): Promise<void> {
  const transaction = db.transaction(['tiles', 'tileSets'], 'readwrite');
  const tiles = transaction.objectStore('tiles');
  const tileSets = transaction.objectStore('tileSets');

  // Legacy project tile set.
  tileSets.put({
    setName: '@project/project-a',
    extent: [0, 0, 1, 1],
    minZoom: 2,
    maxZoom: 14,
    size: 10,
    expectedTileCount: 1,
    created: new Date('2026-01-01T00:00:00Z'),
    tileKeys: [['tile-a']],
    projectId: 'project-a',
  });

  // Another legacy project tile set sharing a cached tile.
  tileSets.put({
    setName: '@project/project-b',
    extent: [1, 1, 2, 2],
    minZoom: 2,
    maxZoom: 14,
    size: 20,
    expectedTileCount: 1,
    created: new Date('2026-01-02T00:00:00Z'),
    tileKeys: [['shared-tile']],
    projectId: 'project-b',
  });

  // Existing non-legacy tile set should not be changed.
  tileSets.put({
    setName: 'existing-map-id',
    extent: [2, 2, 3, 3],
    minZoom: 2,
    maxZoom: 14,
    size: 30,
    expectedTileCount: 1,
    created: new Date('2026-01-03T00:00:00Z'),
    tileKeys: [['shared-tile']],
    label: 'Keep me',
  });

  // Cached tile belonging only to project-a.
  tiles.put({
    url: 'tile-a',
    data: new Blob(['a']),
    sets: ['@project/project-a'],
  });

  // Cached tile shared by a legacy and non-legacy tile set.
  tiles.put({
    url: 'shared-tile',
    data: new Blob(['shared']),
    sets: ['@project/project-b', 'existing-map-id'],
  });

  await transactionAsPromise(transaction);
}

/**
 * Read all records from an object store.
 */
async function readAll<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  const transaction = db.transaction(storeName, 'readonly');

  const result = await requestAsPromise(
    transaction.objectStore(storeName).getAll()
  );

  await transactionAsPromise(transaction);

  return result as T[];
}

/**
 * Run the migration and validation using one read/write transaction.
 *
 * Production runs this inside the IndexedDB versionchange transaction.
 * This helper uses a normal transaction to unit-test the migration logic.
 */
async function runMigrationForTest(db: IDBDatabase): Promise<void> {
  const transaction = db.transaction(['tiles', 'tileSets'], 'readwrite');
  const completion = transactionAsPromise(transaction);

  await migrateV1ToV2({db, transaction});
  await validateV2(transaction);
  // Wait for all validation requests in the transaction to finish.
  await completion;
}

const PROJECT_A_OFFLINE_MAP_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_B_OFFLINE_MAP_ID = '22222222-2222-4222-8222-222222222222';

describe('migrateV1ToV2', () => {
  let db: IDBDatabase;

  beforeEach(async () => {
    // Use predictable generated IDs so migrated records can be asserted.
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce(PROJECT_A_OFFLINE_MAP_ID)
      .mockReturnValueOnce(PROJECT_B_OFFLINE_MAP_ID);

    db = await openV1Db();
    await seedV1(db);
  });

  afterEach(async () => {
    // restores the real crypto.randomUUID() implementation after the test.
    vi.restoreAllMocks();

    db.close();

    // Remove the test database so every test starts with a clean v1 database.
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });

  test('migrates every @project/ tile-set id to a generated offline-map id', async () => {
    await runMigrationForTest(db);

    const tileSets = await readAll<any>(db, 'tileSets');

    expect(tileSets.map(tileSet => tileSet.setName)).toEqual(
      expect.arrayContaining([
        `${OFFLINE_MAP_ID_PREFIX}${PROJECT_A_OFFLINE_MAP_ID}`,
        `${OFFLINE_MAP_ID_PREFIX}${PROJECT_B_OFFLINE_MAP_ID}`,
        'existing-map-id',
      ])
    );

    // No legacy tile-set IDs should remain after migration.
    expect(
      tileSets.some(tileSet => tileSet.setName.startsWith('@project/'))
    ).toBe(false);
  });

  test('preserves projectId on migrated project tile sets', async () => {
    await runMigrationForTest(db);

    const tileSets = await readAll<any>(db, 'tileSets');

    const projectA = tileSets.find(
      tileSet =>
        tileSet.setName ===
        `${OFFLINE_MAP_ID_PREFIX}${PROJECT_A_OFFLINE_MAP_ID}`
    );

    const projectB = tileSets.find(
      tileSet =>
        tileSet.setName ===
        `${OFFLINE_MAP_ID_PREFIX}${PROJECT_B_OFFLINE_MAP_ID}`
    );

    expect(projectA.projectId).toBe('project-a');
    expect(projectB.projectId).toBe('project-b');
  });

  test('rewrites tile membership references and preserves unrelated set ids', async () => {
    await runMigrationForTest(db);

    const tiles = await readAll<any>(db, 'tiles');

    const projectATile = tiles.find(tile => tile.url === 'tile-a');
    const sharedTile = tiles.find(tile => tile.url === 'shared-tile');

    expect(projectATile.sets).toEqual([
      `${OFFLINE_MAP_ID_PREFIX}${PROJECT_A_OFFLINE_MAP_ID}`,
    ]);

    expect(sharedTile.sets).toEqual([
      `${OFFLINE_MAP_ID_PREFIX}${PROJECT_B_OFFLINE_MAP_ID}`,
      'existing-map-id',
    ]);
  });

  test('leaves non-legacy tile sets unchanged', async () => {
    await runMigrationForTest(db);

    const tileSets = await readAll<any>(db, 'tileSets');

    const existing = tileSets.find(
      tileSet => tileSet.setName === 'existing-map-id'
    );

    expect(existing.label).toBe('Keep me');
  });

  test('passes v2 validation after migration', async () => {
    await runMigrationForTest(db);

    const transaction = db.transaction(['tiles', 'tileSets'], 'readonly');

    const completion = transactionAsPromise(transaction);
    // Validation should complete without finding any remaining legacy references.
    await expect(validateV2(transaction)).resolves.toBeUndefined();
    // Wait for all validation requests in the transaction to finish.
    await completion;
  });

  test('fails when a legacy project tile set is missing projectId', async () => {
    // Add an invalid legacy project tile set without projectId.
    const seedTransaction = db.transaction('tileSets', 'readwrite');

    await requestAsPromise(
      seedTransaction.objectStore('tileSets').put({
        setName: '@project/project-c',
        extent: [3, 3, 4, 4],
        minZoom: 2,
        maxZoom: 14,
        size: 10,
        expectedTileCount: 0,
        created: new Date('2026-01-04T00:00:00Z'),
        tileKeys: [],
      })
    );

    await transactionAsPromise(seedTransaction);

    const migrationTransaction = db.transaction(
      ['tiles', 'tileSets'],
      'readwrite'
    );

    await expect(
      migrateV1ToV2({
        db,
        transaction: migrationTransaction,
      })
    ).rejects.toThrow();
  });
});
