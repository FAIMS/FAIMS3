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
import {requestAsPromise, scanStore} from '../idbUtils';
import type {TileDbMigrationFunction} from '../types';

// Validate the fields required from stored tile records during migration.
const TileV1Schema = z.object({
  url: z.string(),
  data: z.unknown(),
  sets: z.array(z.string()),
});
export type TileV1 = z.infer<typeof TileV1Schema>;

// Validate the fields required from stored tile-set records during migration.
const TileSetV1Schema = z.object({
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
export type TileSetV1 = z.infer<typeof TileSetV1Schema>;

// V2 keeps the same stored record shapes as V1.
// The v2 migration changes the data invariant rather than the schema:
// legacy @project/... IDs are replaced with generated offline-map IDs.
const TileV2Schema = TileV1Schema;
export type TileV2 = z.infer<typeof TileV2Schema>;

const TileSetV2Schema = TileSetV1Schema;
export type TileSetV2 = z.infer<typeof TileSetV2Schema>;

// Prefix used by legacy project-associated tile-set IDs.
const V1_LEGACY_PROJECT_SET_PREFIX = '@project/';

// Check whether a tile set uses the legacy v1 `@project/:id` format.
function isV1LegacyProjectSetName(setName: string): boolean {
  return setName.startsWith(V1_LEGACY_PROJECT_SET_PREFIX);
}

/**
 * Migrate all legacy `@project/...` identifiers using the active IndexedDB
 * versionchange transaction.
 *
 * Changing TileSetV1.setName changes its IndexedDB primary key, so the old
 * record must be deleted and a new record inserted. TileV1.sets is changed
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
    const parsedTileSet = TileSetV1Schema.parse(rawTileSet);

    // non-legacy tile sets do not need migration.
    if (!isV1LegacyProjectSetName(parsedTileSet.setName)) {
      continue;
    }

    const oldSetName = parsedTileSet.setName;
    const newSetName = createOfflineMapId();

    // legacy project tile sets should already have a projectId, just check in case.
    if (!parsedTileSet.projectId) {
      console.error(
        `[tiles_db] Legacy tile set '${oldSetName}' is missing projectId`
      );
      throw new Error(`Legacy tile set '${oldSetName}' is missing projectId`);
    }

    const migratedTileSet = {
      ...parsedTileSet,
      setName: newSetName,
    } satisfies TileSetV2;

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
    const parsedTile = TileV1Schema.parse(rawTile);

    let changed = false;

    // Replace any TileV1.sets references that point to migrated tile sets.
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
      const migratedTile = {
        ...parsedTile,
        sets: migratedSets,
      } satisfies TileV2;

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
export const validateV2: TileDbMigrationFunction = async ({transaction}) => {
  const tileSetStore = transaction.objectStore('tileSets');
  const tileStore = transaction.objectStore('tiles');

  // Confirm no V2 tile-set IDs still use the legacy naming format.
  await scanStore(tileSetStore, cursor => {
    const parsed = TileSetV2Schema.parse(cursor.value);

    if (isV1LegacyProjectSetName(parsed.setName)) {
      throw new Error(
        `Legacy tile-set id remains after v2 migration: ${parsed.setName}`
      );
    }
  });

  // Confirm cached tiles no longer reference legacy tile-set IDs.
  await scanStore(tileStore, cursor => {
    const parsed = TileV2Schema.parse(cursor.value);
    const legacyReference = parsed.sets.find(isV1LegacyProjectSetName);

    if (legacyReference) {
      throw new Error(
        `Legacy tile-set reference remains after v2 migration: ${legacyReference}`
      );
    }
  });
};
