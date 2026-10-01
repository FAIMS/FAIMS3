// SPDX-License-Identifier: Apache-2.0
/**
 * API-boot migration orchestration.
 *
 * When {@link config.disableMigrateOnStartup} is on, this is a no-op —
 * the full API attaches with no Couch migrate, no lock, and no notebook
 * walk. Use when migrate is handled out of band.
 *
 * Otherwise, when {@link config.startupMigrationLockEnabled} is on
 * (clustered production; AWS CDK hard-enables this unless the JSON
 * disable flag is set):
 *   under a Couch-mediated lock (so replicas do not race):
 *     1. initialise + migrate every DB (`initialiseAndMigrateDBs`, same
 *        path as `pnpm migrate-with-keys`)
 *     2. notebook uiSpec walks (`validateDatabases`)
 *
 * When the lock is off (default, local/dev): those steps run on this
 * process with no claim/wait. Rapid reloads can otherwise leave a
 * `running` lock that strands the next boot until
 * `STARTUP_MIGRATION_LOCK_TIMEOUT_MS`. Multi-replica deployments MUST
 * enable the lock if they still migrate on boot.
 *
 * Failures are logged (and recorded on the lock when it is on); this
 * function still resolves so the full API can attach, matching the
 * existing error-tolerant boot.
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

/** Migrate Couch DBs, then notebook uiSpecs. Thrown errors propagate to the caller. */
async function runMigrationWork(instanceId: string): Promise<void> {
  logStartupMigration('db_migrate_begin', {instance: instanceId});
  await initialiseAndMigrateDBs({force: true, pushKeys: true});
  logStartupMigration('db_migrate_complete', {instance: instanceId});

  logStartupMigration('notebook_migrate_begin', {instance: instanceId});
  await validateDatabases();
  logStartupMigration('notebook_migrate_complete', {
    instance: instanceId,
  });
}

/**
 * Boot migrate. No-op when {@link config.disableMigrateOnStartup} is on.
 * Uses the clustered lock when enabled; otherwise runs
 * {@link runMigrationWork} on this process. Always resolves so the full
 * API can attach.
 */
export async function runStartupMigrations(): Promise<void> {
  const instanceId = createStartupInstanceId();
  try {
    if (config.disableMigrateOnStartup) {
      logStartupMigration('migrate_disabled', {instance: instanceId});
      return;
    }

    if (!config.startupMigrationLockEnabled) {
      logStartupMigration('lock_disabled', {instance: instanceId});
      try {
        await runMigrationWork(instanceId);
      } catch (error) {
        console.error(`${STARTUP_MIGRATION_LOG} doer_failed`, error);
      }
      return;
    }

    await withStartupMigrationLock({
      db: getMigrationDb() as unknown as StartupMigrationLockStore,
      instanceId,
      timeoutMs: config.startupMigrationLockTimeoutMs,
      run: () => runMigrationWork(instanceId),
    });
  } catch (error) {
    // Lock I/O exhausted its retry/backoff streak (or failed before claim/wait
    // could start). Same as today's boot: log and continue to listen.
    console.error(`${STARTUP_MIGRATION_LOG} failed_open`, error);
  }
}
