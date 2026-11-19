// SPDX-License-Identifier: Apache-2.0
/**
 * Read the migrations DB to decide whether this process's boot-migrate
 * targets are already behind the cluster.
 *
 * Passed as {@link withStartupMigrationLock}'s `isClusterAhead` so an older
 * replica that sees a foreign settlement does not become doer.
 *
 * Only state written by boot migrate is consulted: per-DB version documents
 * and the notebook UI-schema marker ({@link NOTEBOOK_UI_SCHEMA_MARKER_ID},
 * written by a doer after its notebook walk). Project / template
 * `uiSpecProperties.schemaVersion` is never read here: it is copied from
 * the uploaded uiSpec and can carry any version, so a single imported or
 * future-stamped notebook would otherwise make every upgraded replica skip
 * boot migrate on every boot.
 */
import {
  findStartupMigrationAheadReasons,
  formatStartupMigrationAheadSample,
  isNotebookUiSchemaMarker,
  NOTEBOOK_UI_SCHEMA_MARKER_ID,
  type StartupMigrationAheadReason,
  type StartupMigrationLiveDbVersion,
} from '@faims3/data-model';
import {getMigrationDb} from '.';
import {
  logStartupMigration,
  STARTUP_MIGRATION_LOCK_ID,
} from './startupMigrationLock';

function isLiveDbVersion(doc: unknown): doc is StartupMigrationLiveDbVersion {
  if (typeof doc !== 'object' || doc === null) {
    return false;
  }
  const record = doc as Record<string, unknown>;
  return (
    typeof record.dbType === 'string' &&
    typeof record.dbName === 'string' &&
    typeof record.version === 'number'
  );
}

async function loadRecordedState(): Promise<{
  databases: StartupMigrationLiveDbVersion[];
  notebookMarker?: string;
}> {
  const result = await getMigrationDb().allDocs({include_docs: true});
  const databases: StartupMigrationLiveDbVersion[] = [];
  let notebookMarker: string | undefined;
  for (const row of result.rows) {
    if (row.id === NOTEBOOK_UI_SCHEMA_MARKER_ID) {
      if (
        isNotebookUiSchemaMarker(row.doc) &&
        typeof row.doc.schemaVersion === 'string'
      ) {
        notebookMarker = row.doc.schemaVersion;
      }
      continue;
    }
    if (row.id.startsWith('_design/') || row.id === STARTUP_MIGRATION_LOCK_ID) {
      continue;
    }
    if (isLiveDbVersion(row.doc)) {
      databases.push({
        dbType: row.doc.dbType,
        dbName: row.doc.dbName,
        version: row.doc.version,
      });
    }
  }
  return {databases, notebookMarker};
}

/** Live ahead reasons for this process's boot-migrate targets. */
export async function readStartupMigrationAheadReasons(): Promise<
  StartupMigrationAheadReason[]
> {
  return findStartupMigrationAheadReasons(await loadRecordedState());
}

/**
 * True when any recorded DB version or the notebook UI-schema marker is
 * already past this process. Logs a sample of reasons when ahead. Used as
 * the lock `isClusterAhead` callback.
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
