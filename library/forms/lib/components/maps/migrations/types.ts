// SPDX-License-Identifier: Apache-2.0

/*
 * Description:
 * Types shared by the map-tile IndexedDB migration framework.
 */

// Migration metadata object store name.
export const TILE_DB_MIGRATION_STORE = 'tileDBMigrationMetadata';
// Migration state record key.
export const TILE_DB_MIGRATION_STATE_KEY = 'tile-db-migration-state';

export type TileDbMigrationStatus = 'healthy' | 'not-healthy';
export type TileDbMigrationLogStatus = 'success' | 'failure';

export interface TileDbMigrationLog {
  /** Migration version before this migration ran. */
  from: number;
  /** Migration version after this migration completed. */
  to: number;
  /** Time the migration started, in milliseconds. */
  startedAtTimestampMs: number;
  /** Time the migration completed, in milliseconds. */
  completedAtTimestampMs: number;
  /** Source that triggered the migration. */
  launchedBy: string;
  /** Whether the migration succeeded or failed. */
  status: TileDbMigrationLogStatus;
  /** Short description of what the migration changes. */
  description: string;
  /** Problems reported while running the migration. */
  issues: string[];
}

// State stored in the tile database migration metadata store.
export interface TileDbMigrationState {
  /** Fixed key used to store the migration state record. */
  id: typeof TILE_DB_MIGRATION_STATE_KEY;

  /** Current migration/data version of the tile database. */
  version: number;

  /** Current health of the stored migration state. */
  status: TileDbMigrationStatus;

  /** History of recorded migrations. */
  migrationLog: TileDbMigrationLog[];
}

export interface TileDbMigrationContext {
  db: IDBDatabase;
  /**
   * The versionchange transaction created by IndexedDB for onupgradeneeded.
   *
   * Migration steps must use this transaction rather than opening their own
   * read/write transactions so schema changes, data changes, validation, and
   * migration metadata commit or roll back together.
   */
  transaction: IDBTransaction;
}

export type TileDbMigrationFunction = (
  context: TileDbMigrationContext
) => Promise<void>;

export interface TileDbMigrationDetails {
  /** Migration version before this migration runs. */
  from: number;
  /** Migration version after this migration completes. */
  to: number;
  /** Short description of what the migration changes. */
  description: string;
  /** Function that performs the migration. */
  migrationFunction: TileDbMigrationFunction;
  /** Function that validates the data format introduced by this migration. */
  validateFunction: TileDbMigrationFunction;
}

export class TileDbMigrationError extends Error {
  constructor() {
    super('Tile database migration failed');
    this.name = 'TileDbMigrationError';
  }
}
