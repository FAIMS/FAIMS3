// SPDX-License-Identifier: Apache-2.0

/*
 * Description:
 * Registry and target version for map-tile IndexedDB migrations.
 * To introduce another migration, increment TILE_DB_TARGET_VERSIONS so
 * IndexedDB runs onupgradeneeded, then add exactly one sequential migration
 * entry (for example v2 -> v3).
 */

import type {TileDbMigrationDetails} from './types';
import {migrateV1ToV2, validateV2} from './versions/migrateV2';

// Target tile database version.
// Used both as the IndexedDB version passed to indexedDB.open()
// and as the target logical/data migration version.
export const TILE_DB_TARGET_VERSIONS = 2;

export const TILE_DB_MIGRATIONS: TileDbMigrationDetails[] = [
  {
    from: 1,
    to: 2,
    description:
      'Replace legacy project tile-set ids with generated offline-map ids',
    migrationFunction: migrateV1ToV2,
    validateFunction: validateV2,
  },
];
