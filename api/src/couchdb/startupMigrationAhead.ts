// SPDX-License-Identifier: Apache-2.0
/**
 * Read the migrations DB to decide whether this process's boot-migrate
 * targets are already behind the cluster.
 *
 * Passed as {@link withStartupMigrationLock}'s `isClusterAhead` so an older
 * replica that sees a foreign settlement does not become doer.
 *
 * Only state written by boot migrate is consulted: per-DB version documents,
 * `db-setup` design/security versions, and the notebook UI-schema marker
 * ({@link NOTEBOOK_UI_SCHEMA_MARKER_ID}, written by a doer after its
 * notebook walk). Project / template `uiSpecProperties.schemaVersion` is
 * never read here: it is copied from the uploaded uiSpec and can carry any
 * version, so a single imported or future-stamped notebook would otherwise
 * make every upgraded replica skip boot migrate on every boot.
 */
import {
  findStartupMigrationAheadReasons,
  formatStartupMigrationAheadSample,
  isDbSetupDoc,
  isMigrationVersionRecord,
  isNotebookUiSchemaMarker,
  NOTEBOOK_UI_SCHEMA_MARKER_ID,
  type StartupMigrationAheadReason,
  type StartupMigrationLiveDbVersion,
  type StartupMigrationLiveSetupVersion,
} from '@faims3/data-model';
import {getMigrationDbStore} from '.';
import {
  logStartupMigration,
  STARTUP_MIGRATION_LOCK_ID,
} from './startupMigrationLock';

async function loadRecordedState(): Promise<{
  databases: StartupMigrationLiveDbVersion[];
  notebookMarker?: string;
  setups: StartupMigrationLiveSetupVersion[];
}> {
  const result = await getMigrationDbStore().allDocs({include_docs: true});
  const databases: StartupMigrationLiveDbVersion[] = [];
  const setups: StartupMigrationLiveSetupVersion[] = [];
  let notebookMarker: string | undefined;
  for (const row of result.rows) {
    const doc = row.doc;
    if (row.id === NOTEBOOK_UI_SCHEMA_MARKER_ID) {
      if (isNotebookUiSchemaMarker(doc)) {
        notebookMarker = doc.schemaVersion;
      }
      continue;
    }
    if (row.id.startsWith('_design/') || row.id === STARTUP_MIGRATION_LOCK_ID) {
      continue;
    }
    if (isDbSetupDoc(doc)) {
      setups.push({
        setupType: doc.dbType,
        dbName: doc.dbName,
        designVersion: doc.design?.version,
        securityVersion: doc.security?.version,
      });
      continue;
    }
    if (isMigrationVersionRecord(doc)) {
      databases.push({
        dbType: doc.dbType,
        dbName: doc.dbName,
        version: doc.version,
      });
    }
  }
  return {databases, notebookMarker, setups};
}

/** Live ahead reasons for this process's boot-migrate targets. */
export async function readStartupMigrationAheadReasons(): Promise<
  StartupMigrationAheadReason[]
> {
  return findStartupMigrationAheadReasons(await loadRecordedState());
}

/**
 * True when any recorded DB version, db-setup version, or the notebook
 * UI-schema marker is already past this process. Logs a sample of reasons
 * when ahead. Used as the lock `isClusterAhead` callback.
 */
export async function isStartupMigrationClusterAhead(): Promise<boolean> {
  const reasons = await readStartupMigrationAheadReasons();
  if (reasons.length === 0) {
    return false;
  }
  logStartupMigration('cluster_ahead', {
    count: reasons.length,
    sample: formatStartupMigrationAheadSample(reasons),
  });
  return true;
}
