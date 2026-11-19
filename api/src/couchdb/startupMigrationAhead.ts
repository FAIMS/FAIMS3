// SPDX-License-Identifier: Apache-2.0
/**
 * Read live Couch migration docs and notebook listing versions to decide
 * whether this process's boot-migrate targets are already behind the cluster.
 *
 * Passed as {@link withStartupMigrationLock}'s `isClusterAhead` so an older
 * replica that sees a foreign settlement does not become doer.
 */
import {
  findStartupMigrationAheadReasons,
  formatStartupMigrationAheadSample,
  type StartupMigrationAheadReason,
  type StartupMigrationLiveDbVersion,
  type StartupMigrationLiveNotebookVersion,
} from '@faims3/data-model';
import {getMigrationDb} from '.';
import {getAllProjectsListing} from './notebooks';
import {
  logStartupMigration,
  STARTUP_MIGRATION_LOCK_ID,
} from './startupMigrationLock';
import {getTemplates} from './templates';

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

async function loadLiveDbVersions(): Promise<StartupMigrationLiveDbVersion[]> {
  const result = await getMigrationDb().allDocs({include_docs: true});
  const databases: StartupMigrationLiveDbVersion[] = [];
  for (const row of result.rows) {
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
  return databases;
}

async function loadLiveNotebookVersions(): Promise<
  StartupMigrationLiveNotebookVersion[]
> {
  const [projects, templates] = await Promise.all([
    getAllProjectsListing(),
    getTemplates({}),
  ]);
  return [
    ...projects.map(project => ({
      kind: 'project' as const,
      id: project._id,
      schemaVersion: project.uiSpecProperties?.schemaVersion,
    })),
    ...templates.map(template => ({
      kind: 'template' as const,
      id: template._id,
      schemaVersion: template.uiSpecProperties?.schemaVersion,
    })),
  ];
}

/** Live ahead reasons for this process's boot-migrate targets. */
export async function readStartupMigrationAheadReasons(): Promise<
  StartupMigrationAheadReason[]
> {
  const [databases, notebooks] = await Promise.all([
    loadLiveDbVersions(),
    loadLiveNotebookVersions(),
  ]);
  return findStartupMigrationAheadReasons({databases, notebooks});
}

/**
 * True when any live DB or notebook version is already past this process.
 * Logs a sample of reasons when ahead. Used as the lock `isClusterAhead`
 * callback.
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
