// SPDX-License-Identifier: Apache-2.0
/**
 * API-boot migration orchestration.
 *
 * When {@link config.disableMigrateOnStartup} is on, this is a no-op —
 * the full API attaches with no Couch migrate, no lock, and no notebook
 * walk. Use when migrate is handled out of band.
 *
 * Otherwise, when {@link config.startupMigrationLockEnabled} is on
 * (clustered production; AWS CDK defaults it on unless
 * `core.migration.startupMigrationLockEnabled` is `false`):
 *   under a Couch-mediated lock (so replicas do not race):
 *     1. initialise + migrate every DB (`initialiseAndMigrateDBs`, same
 *        path as `pnpm migrate-with-keys`)
 *     2. notebook uiSpec walks (`validateDatabases`), then raise the
 *        notebook UI-schema marker to this build's
 *        `CURRENT_NOTEBOOK_UI_SCHEMA_VERSION`
 *
 * Init/migrate run only on the lock doer — waiters attach without rewriting
 * design docs. After a foreign settlement, an older replica skips becoming
 * doer when recorded DB versions, `db-setup` versions or the notebook marker
 * are already ahead of this process. Notebook "ahead" comes from the marker, not from individual
 * notebooks, because uploaded uiSpecs can carry any `schemaVersion`.
 *
 * The marker is only raised after a walk that completed.
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
import {getMigrationDbStore, initialiseAndMigrateDBs} from '.';
import {writeNotebookSchemaMarker} from './notebookSchemaMarker';
import {isStartupMigrationClusterAhead} from './startupMigrationAhead';
import {getStartupMigrationFingerprint} from './startupMigrationFingerprint';
import {
  createStartupInstanceId,
  logStartupMigration,
  STARTUP_MIGRATION_LOG,
  withStartupMigrationLock,
} from './startupMigrationLock';
import {validateDatabases} from './validateDatabases';

/**
 * Raise the notebook UI-schema marker after a walk. Failures are logged and
 * swallowed: a missing marker only means the next foreign-settlement check
 * cannot report notebook "ahead".
 */
async function recordNotebookSchemaMarker(
  instanceId: string,
  fingerprint?: string
): Promise<void> {
  try {
    const result = await writeNotebookSchemaMarker({
      db: getMigrationDbStore(),
      fingerprint,
      apiVersion: config.apiVersion,
      writerId: instanceId,
    });
    logStartupMigration('notebook_schema_marker_written', {
      instance: instanceId,
      schemaVersion: result.schemaVersion,
      written: result.written,
    });
  } catch (error) {
    logStartupMigration('notebook_schema_marker_write_failed', {
      instance: instanceId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Walk notebook uiSpecs, then raise the marker. `validateDatabases` reports
 * failure as `{valid: false}` rather than throwing; the marker is only
 * written after a walk that completed.
 * @returns whether the walk completed
 */
async function runNotebookWalk(
  instanceId: string,
  fingerprint?: string
): Promise<boolean> {
  logStartupMigration('notebook_migrate_begin', {instance: instanceId});
  const report = await validateDatabases();
  if (!report.valid) {
    logStartupMigration('notebook_migrate_failed', {instance: instanceId});
    return false;
  }
  logStartupMigration('notebook_migrate_complete', {
    instance: instanceId,
  });
  await recordNotebookSchemaMarker(instanceId, fingerprint);
  return true;
}

/** Migrate Couch DBs, then notebook uiSpecs. Thrown errors propagate to the caller. */
async function runMigrationWork(
  instanceId: string,
  fingerprint?: string
): Promise<void> {
  logStartupMigration('db_migrate_begin', {instance: instanceId});
  await initialiseAndMigrateDBs({
    force: true,
    pushKeys: true,
    setupDiagnostics: {
      fingerprint,
      apiVersion: config.apiVersion,
      writerId: instanceId,
    },
  });
  logStartupMigration('db_migrate_complete', {instance: instanceId});

  await runNotebookWalk(instanceId, fingerprint);
}

/**
 * Manual `pnpm migrate` / `migrate-with-keys`: everything boot does, but
 * forced. Design/security docs are pushed regardless of `db-setup` records
 * (parts recorded ahead of this build are still left alone), then notebook
 * uiSpecs are walked and the marker raised unless `skipNotebooks`.
 *
 * Takes no startup lock, so do not run it against a cluster that is booting.
 * Throws on any failure, including a notebook walk that did not complete.
 */
export async function runManualMigration({
  pushKeys,
  skipNotebooks = false,
}: {
  pushKeys: boolean;
  skipNotebooks?: boolean;
}): Promise<void> {
  const instanceId = createStartupInstanceId();
  logStartupMigration('manual_migrate_begin', {
    instance: instanceId,
    pushKeys,
    skipNotebooks,
  });
  await initialiseAndMigrateDBs({
    force: true,
    forceSetup: true,
    pushKeys,
    setupDiagnostics: {
      apiVersion: config.apiVersion,
      writerId: instanceId,
    },
  });
  logStartupMigration('db_migrate_complete', {instance: instanceId});

  if (skipNotebooks) {
    logStartupMigration('notebook_migrate_skipped', {instance: instanceId});
    return;
  }
  if (!(await runNotebookWalk(instanceId))) {
    throw new Error(
      'Notebook uiSpec walk did not complete; see [notebook-startup] logs'
    );
  }
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

    const fingerprint = await getStartupMigrationFingerprint();
    await withStartupMigrationLock({
      db: getMigrationDbStore(),
      instanceId,
      timeoutMs: config.startupMigrationLockTimeoutMs,
      fingerprint,
      apiVersion: config.apiVersion,
      isClusterAhead: isStartupMigrationClusterAhead,
      run: () => runMigrationWork(instanceId, fingerprint),
    });
  } catch (error) {
    // Lock I/O exhausted its retry/backoff streak (or failed before claim/wait
    // could start). Same as today's boot: log and continue to listen.
    console.error(`${STARTUP_MIGRATION_LOG} failed_open`, error);
  }
}
