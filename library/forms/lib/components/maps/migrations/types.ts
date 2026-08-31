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
}

export interface TileDbTargetVersions {
  /**
   * IndexedDB database version used to trigger onupgradeneeded.
   *
   * Increment this whenever a new migration is added so IndexedDB runs
   * onupgradeneeded and the migration can execute.
   */
  databaseVersion: number;

  /** Migration version expected by the current application. */
  targetMigrationVersion: number;
}
