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
 * Logical tile database v1 -> v2 migration.
 *
 * Replaces legacy project tile-set keys (`@project/:projectId`) with generated
 * offline-map IDs, adds/retains the associated projectId, and rewrites each
 * cached tile's set membership so references remain consistent.
 */

import {z} from 'zod';
import {createOfflineMapId} from '../../tileStoreUtils';
import type {StoredTile, StoredTileSet} from '../../tileStoreUtils';
import type {TileDbMigrationFunction} from '../types';
import {requestAsPromise} from '../idbUtils';

// Prefix used by legacy project-associated tile-set IDs.
const LEGACY_PROJECT_SET_PREFIX = '@project/';

// Validate the fields required from stored tile records during migration.
const StoredTileSchema = z.object({
  url: z.string(),
  data: z.unknown(),
  sets: z.array(z.string()),
});

// Validate the fields required from stored tile-set records during migration.
const StoredTileSetSchema = z.object({
  setName: z.string(),
  extent: z.array(z.number()).min(4),
  minZoom: z.number(),
  maxZoom: z.number(),
  size: z.number(),
  expectedTileCount: z.number(),
  created: z.date(),
  tileKeys: z.array(z.unknown()),
  projectId: z.string().optional(),
  label: z.string().optional(),
  offlineMapRegion: z.unknown().optional(),
});

// Check whether a tile set uses the legacy `@project/:id` format.
function isLegacyProjectSetName(setName: string): boolean {
  return setName.startsWith(LEGACY_PROJECT_SET_PREFIX);
}

// Scan an object store with a cursor without loading all records into memory.
function scanStore(
  store: IDBObjectStore,
  visit: (cursor: IDBCursorWithValue) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Open a cursor to iterate through the records in this object store.
    const request = store.openCursor();

    request.onerror = () =>
      reject(request.error ?? new Error(`Failed to scan '${store.name}'`));

    request.onsuccess = () => {
      const cursor = request.result;

      // A null cursor means there are no more records to scan.
      if (!cursor) {
        resolve();
        return;
      }

      try {
        visit(cursor);
        cursor.continue();
      } catch (error) {
        reject(error);
      }
    };
  });
}

/**
 * Migrate all legacy `@project/...` identifiers using the active IndexedDB
 * versionchange transaction.
 *
 * Changing StoredTileSet.setName changes its IndexedDB primary key, so the old
 * record must be deleted and a new record inserted. StoredTile.sets is changed
 * in the same transaction because tile cleanup relies on those references.
 */
export const migrateV1ToV2: TileDbMigrationFunction = async ({transaction}) => {
  // Use the stores from the active upgrade transaction.
  const tileSetStore = transaction.objectStore('tileSets');
  const tileStore = transaction.objectStore('tiles');

  const rawTileSets = (await requestAsPromise(
    tileSetStore.getAll()
  )) as unknown[];

  // Track old tileset IDs and their generated replacements.
  const idChanges = new Map<string, string>();

  for (const rawTileSet of rawTileSets) {
    const parsed = StoredTileSetSchema.parse(rawTileSet);

    // non-legacy tile sets do not need migration.
    if (!isLegacyProjectSetName(parsed.setName)) {
      continue;
    }

    const oldSetName = parsed.setName;
    const newSetName = createOfflineMapId();

    // legacy project tile sets should already have a projectId, just check in case.
    if (!parsed.projectId) {
      console.error(
        `[tiles_db] Legacy tile set '${oldSetName}' is missing projectId`
      );
      throw new Error(`Legacy tile set '${oldSetName}' is missing projectId`);
    }

    const migratedTileSet: StoredTileSet = {
      ...(rawTileSet as StoredTileSet),
      setName: newSetName,
    };

    // Remember the new ID so storedTile.sets references can be updated later.
    idChanges.set(oldSetName, newSetName);

    // setName is the keyPath, so changing it requires a new record and removal
    // of the old primary-key record.
    await requestAsPromise(tileSetStore.put(migratedTileSet));
    await requestAsPromise(tileSetStore.delete([oldSetName]));
  }

  // No legacy tile-set IDs means there are no tile references to update.
  if (idChanges.size === 0) {
    return;
  }

  // Scan tiles individually to avoid loading the full blob cache into memory.
  await scanStore(tileStore, cursor => {
    const rawTile = cursor.value;
    const parsedTile = StoredTileSchema.parse(rawTile);

    let changed = false;

    // Replace any StoredTile.sets references that point to migrated tile sets.
    const migratedSets = parsedTile.sets.map(setName => {
      const migratedId = idChanges.get(setName);
      if (migratedId) {
        changed = true;
        return migratedId;
      }
      // Keep the existing set name when no migration is needed.
      return setName;
    });

    // Only write the tile when at least one set reference changed.
    if (changed) {
      const migratedTile: StoredTile = {
        ...(rawTile as StoredTile),
        sets: migratedSets,
      };

      cursor.update(migratedTile);
    }
  });
};

/**
 * Validate the invariant introduced by v2 using the active versionchange
 * transaction.
 *
 * Kept separate from the migration so the runner can validate the completed
 * transformation before advancing the recorded logical/data version.
 */
export async function validateV2(transaction: IDBTransaction): Promise<void> {
  const tileSetStore = transaction.objectStore('tileSets');
  const tileStore = transaction.objectStore('tiles');

  // Confirm no tileset primary keys still use the legacy naming format.
  await scanStore(tileSetStore, cursor => {
    const parsed = StoredTileSetSchema.parse(cursor.value);

    if (isLegacyProjectSetName(parsed.setName)) {
      throw new Error(
        `Legacy tile-set id remains after v2 migration: ${parsed.setName}`
      );
    }
  });

  // Confirm cached tiles no longer reference legacy tile-set IDs.
  await scanStore(tileStore, cursor => {
    const parsed = StoredTileSchema.parse(cursor.value);
    const legacyReference = parsed.sets.find(isLegacyProjectSetName);

    if (legacyReference) {
      throw new Error(
        `Legacy tile-set reference remains after v2 migration: ${legacyReference}`
      );
    }
  });
}
