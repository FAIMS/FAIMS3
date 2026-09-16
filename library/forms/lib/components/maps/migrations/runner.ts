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
 * Runs migrations for tiles_db inside the IndexedDB onupgradeneeded
 * versionchange transaction.
 *
 * Migration progress is persisted in the tileDBMigrationMetadata object store.
 * Migration changes, validation, and version metadata therefore commit
 * atomically with the IndexedDB database upgrade.
 *
 * If a migration fails, the upgrade transaction is aborted. This rolls back
 * both the migration and metadata changes. A failure can be logged to the
 * console, but cannot be persisted in the same transaction because an aborted
 * IndexedDB transaction saves none of its writes.
 */

import {requestAsPromise} from '../IDBUtils';
import {TILE_DB_MIGRATIONS, TILE_DB_TARGET_VERSIONS} from './migrations';
import {
  TILE_DB_MIGRATION_STATE_KEY,
  TILE_DB_MIGRATION_STORE,
  type TileDbMigrationDetails,
  type TileDbMigrationLog,
  type TileDbMigrationState,
} from './types';

// Runs the migrations required to bring tiles_db to the target migration version.
class TileDbMigrationRunner {
  // Migration metadata store used to read and update migration state.
  private readonly migrationStore: IDBObjectStore;

  constructor(
    private readonly db: IDBDatabase,
    private readonly transaction: IDBTransaction,
    private readonly oldDatabaseVersion: number,
    private readonly launchedBy = 'system'
  ) {
    // Reuse the active database upgrade transaction for migration metadata.
    this.migrationStore = transaction.objectStore(TILE_DB_MIGRATION_STORE);
  }

  // Read the current migration state, or create the initial state if missing.
  private async readOrCreateMigrationState(): Promise<TileDbMigrationState> {
    const existingState = (await requestAsPromise(
      this.migrationStore.get(TILE_DB_MIGRATION_STATE_KEY)
    )) as TileDbMigrationState | undefined;

    if (existingState) {
      return existingState;
    }

    // A new database already uses the latest data format, so no migration is
    // required. Existing databases start from their previous IndexedDB version
    // and run any migrations required to reach the target version.
    const initialState: TileDbMigrationState = {
      id: TILE_DB_MIGRATION_STATE_KEY,
      // IndexedDB reports oldVersion as 0 when the database is first created.
      version:
        this.oldDatabaseVersion === 0
          ? TILE_DB_TARGET_VERSIONS
          : this.oldDatabaseVersion,

      status: 'healthy',
      migrationLog: [],
    };

    // Save the initial migration state in the current upgrade transaction.
    await requestAsPromise(this.migrationStore.put(initialState));

    return initialState;
  }

  // Find the sequential migrations needed to reach the target version.
  private identifyMigrations(currentVersion: number): TileDbMigrationDetails[] {
    const targetVersion = TILE_DB_TARGET_VERSIONS;

    // A migration version newer than this application cannot be safely downgraded.
    if (currentVersion > targetVersion) {
      throw new Error(
        `Cannot downgrade tile database from v${currentVersion} to v${targetVersion}`
      );
    }

    const migrations: TileDbMigrationDetails[] = [];
    let version = currentVersion;

    // Build the ordered migration path, for example v1 -> v2 -> v3.
    while (version < targetVersion) {
      const nextMigration = TILE_DB_MIGRATIONS.find(
        migration => migration.from === version && migration.to === version + 1
      );

      if (!nextMigration) {
        throw new Error(
          `Missing tile database migration from v${version} to v${version + 1}`
        );
      }

      migrations.push(nextMigration);
      version += 1;
    }

    return migrations;
  }

  // Run every required migration in order using the active upgrade transaction.
  async run(): Promise<void> {
    let state = await this.readOrCreateMigrationState();
    // Determine which migrations are still required from the stored version.
    const migrations = this.identifyMigrations(state.version);

    for (const migration of migrations) {
      // Record when this migration step started for the migration log.
      const startedAtTimestampMs = Date.now();

      console.info(
        `[tiles_db] Migrating v${migration.from} -> v${migration.to}: ${migration.description}`
      );

      try {
        const migrationContext = {
          db: this.db,
          transaction: this.transaction,
        };

        // Apply the data changes for this migration step.
        await migration.migrationFunction(migrationContext);

        // Verify the migrated data before recording the new version.
        await migration.validateFunction(migrationContext);

        // Record the successful migration step.
        const logEntry: TileDbMigrationLog = {
          from: migration.from,
          to: migration.to,
          startedAtTimestampMs,
          completedAtTimestampMs: Date.now(),
          launchedBy: this.launchedBy,
          status: 'success',
          description: migration.description,
          issues: [],
        };

        // Advance the migration state only after migration and validation pass.
        state = {
          ...state,
          version: migration.to,
          status: 'healthy',
          migrationLog: [...state.migrationLog, logEntry],
        };

        // Persist the updated state in the same upgrade transaction.
        await requestAsPromise(this.migrationStore.put(state));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // Do not write a failure state here because the caller will abort the
        // versionchange transaction. Any metadata written here would be rolled
        // back together with the failed migration.
        console.error(
          `[tiles_db] Migration v${migration.from} -> v${migration.to} failed: ${message}`,
          error
        );
        throw new Error(
          `Tile database migration failed at v${migration.from} -> v${migration.to}: ${message}`
        );
      }
    }
  }
}

// Create a runner for the current database upgrade and execute its migrations.
export async function runTileDbUpgradeMigrations(
  db: IDBDatabase,
  transaction: IDBTransaction,
  oldDatabaseVersion: number,
  launchedBy = 'system'
): Promise<void> {
  const runner = new TileDbMigrationRunner(
    db,
    transaction,
    oldDatabaseVersion,
    launchedBy
  );

  await runner.run();
}

/**
 * Run tile database migrations for the current IndexedDB upgrade.
 *
 * If migration or validation fails, notify the caller and abort the active
 * versionchange transaction. Aborting rolls back all schema, data, validation,
 * and migration metadata changes from the failed upgrade.
 */
export function handleTileDbUpgrade(
  // Database being upgraded.
  db: IDBDatabase,
  // Active IndexedDB versionchange transaction.
  transaction: IDBTransaction,
  // Database version before this upgrade started.
  oldDatabaseVersion: number,
  // Called after a migration failure aborts the upgrade transaction.
  onFailure: () => void
): void {
  runTileDbUpgradeMigrations(db, transaction, oldDatabaseVersion).catch(
    error => {
      console.error('[tiles_db] Database upgrade failed', error);
      // The abort event is fired when an IndexedDB transaction is aborted.
      // Only migration failures register this abort handler. Notify the caller
      // once IndexedDB has aborted the failed upgrade transaction.
      transaction.addEventListener('abort', onFailure, {once: true});

      // Abort the upgrade so no partial migration changes are committed.
      try {
        transaction.abort();
      } catch {
        // The transaction may already be aborting.
      }
    }
  );
}
