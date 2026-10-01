// SPDX-License-Identifier: Apache-2.0
/**
 * API-boot migration orchestration.
 *
 * Under a Couch-mediated lock (so clustered replicas do not race):
 *   1. initialise + migrate every DB (`initialiseAndMigrateDBs`, same path as
 *      `pnpm migrate-with-keys`)
 *   2. notebook uiSpec walks (`validateDatabases`)
 *
 * Failures are logged and recorded on the lock; this function still resolves
 * so the full API can attach, matching the existing error-tolerant boot.
 */
import {config} from '../buildconfig';
import {getMigrationDb, initialiseAndMigrateDBs} from '.';
import {
  createStartupInstanceId,
  logStartupMigration,
  STARTUP_MIGRATION_LOG,
  withStartupMigrationLock,
  type StartupMigrationLockStore,
} from './startupMigrationLock';
import {validateDatabases} from './validateDatabases';

/** Under the clustered lock: migrate Couch DBs, then notebook uiSpecs; always resolves so the full API can attach. */
export async function runStartupMigrations(): Promise<void> {
  const instanceId = createStartupInstanceId();
  try {
    await withStartupMigrationLock({
      db: getMigrationDb() as unknown as StartupMigrationLockStore,
      instanceId,
      timeoutMs: config.startupMigrationLockTimeoutMs,
      run: async () => {
        logStartupMigration('db_migrate_begin', {instance: instanceId});
        await initialiseAndMigrateDBs({force: true, pushKeys: true});
        logStartupMigration('db_migrate_complete', {instance: instanceId});

        logStartupMigration('notebook_migrate_begin', {instance: instanceId});
        await validateDatabases();
        logStartupMigration('notebook_migrate_complete', {
          instance: instanceId,
        });
      },
    });
  } catch (error) {
    // Lock I/O exhausted its retry/backoff streak (or failed before claim/wait
    // could start). Same as today's boot: log and continue to listen.
    console.error(`${STARTUP_MIGRATION_LOG} failed_open`, error);
  }
}
