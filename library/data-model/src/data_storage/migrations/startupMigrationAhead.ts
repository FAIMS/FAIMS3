// SPDX-License-Identifier: Apache-2.0
/**
 * Compare live Couch / notebook versions to this process's intended
 * boot-migrate end-state.
 *
 * Used after a foreign startup-migration lock settlement so an older
 * process can skip becoming doer (and skip `forceWrite` init) when the
 * cluster is already past this build's targets. Hashes cannot be ordered;
 * these integer / semver fields can.
 *
 * A live version equal to or behind the target is not ahead. Missing
 * documents, unknown `dbType`s, and non-semver notebook versions are not
 * ahead (legacy notebooks still need the collapse path).
 */
import {
  compareNotebookSchemaSemver,
  isNotebookSchemaSemver,
} from '../../uiSpecification/schemaVersion';
import {DB_TARGET_VERSIONS} from './migrations';
import {CURRENT_NOTEBOOK_UI_SCHEMA_VERSION} from './notebookMigrations/registry';
import {
  DATABASE_TYPES,
  type DATABASE_TYPE,
  type DBTargetVersions,
} from './types';

/** One recorded Couch DB version from the migrations database. */
export type StartupMigrationLiveDbVersion = {
  dbType: string;
  dbName: string;
  version: number;
};

/** One listed project or template `uiSpecProperties.schemaVersion`. */
export type StartupMigrationLiveNotebookVersion = {
  kind: 'project' | 'template';
  id: string;
  schemaVersion: unknown;
};

/** Why {@link isStartupMigrationClusterAhead} returned true. */
export type StartupMigrationAheadReason =
  | {
      kind: 'db';
      dbType: DATABASE_TYPE;
      dbName: string;
      liveVersion: number;
      targetVersion: number;
    }
  | {
      kind: 'notebook';
      notebookKind: 'project' | 'template';
      id: string;
      liveVersion: string;
      targetVersion: string;
    };

function isDatabaseType(value: string): value is DATABASE_TYPE {
  return (DATABASE_TYPES as readonly string[]).includes(value);
}

/**
 * Live versions that are strictly newer than this process's
 * {@link DB_TARGET_VERSIONS} / {@link CURRENT_NOTEBOOK_UI_SCHEMA_VERSION}.
 */
export function findStartupMigrationAheadReasons(input: {
  databases: readonly StartupMigrationLiveDbVersion[];
  notebooks?: readonly StartupMigrationLiveNotebookVersion[];
  targetVersions?: DBTargetVersions;
  notebookTarget?: string;
}): StartupMigrationAheadReason[] {
  const targetVersions = input.targetVersions ?? DB_TARGET_VERSIONS;
  const notebookTarget =
    input.notebookTarget ?? CURRENT_NOTEBOOK_UI_SCHEMA_VERSION;
  const reasons: StartupMigrationAheadReason[] = [];

  for (const database of input.databases) {
    if (!isDatabaseType(database.dbType)) {
      continue;
    }
    const targetVersion = targetVersions[database.dbType].targetVersion;
    if (database.version > targetVersion) {
      reasons.push({
        kind: 'db',
        dbType: database.dbType,
        dbName: database.dbName,
        liveVersion: database.version,
        targetVersion,
      });
    }
  }

  for (const notebook of input.notebooks ?? []) {
    if (
      !isNotebookSchemaSemver(notebook.schemaVersion) ||
      !isNotebookSchemaSemver(notebookTarget)
    ) {
      continue;
    }
    if (
      compareNotebookSchemaSemver(notebook.schemaVersion, notebookTarget) > 0
    ) {
      reasons.push({
        kind: 'notebook',
        notebookKind: notebook.kind,
        id: notebook.id,
        liveVersion: notebook.schemaVersion,
        targetVersion: notebookTarget,
      });
    }
  }

  return reasons;
}

/** True when any live DB or notebook version is already past this process. */
export function isStartupMigrationClusterAhead(
  input: Parameters<typeof findStartupMigrationAheadReasons>[0]
): boolean {
  return findStartupMigrationAheadReasons(input).length > 0;
}

/** Compact `key=value` sample for lock logs (first few reasons). */
export function formatStartupMigrationAheadSample(
  reasons: readonly StartupMigrationAheadReason[],
  limit = 3
): string | undefined {
  if (reasons.length === 0) {
    return undefined;
  }
  return reasons
    .slice(0, limit)
    .map(reason =>
      reason.kind === 'db'
        ? `${reason.dbName}:${reason.liveVersion}>${reason.targetVersion}`
        : `${reason.notebookKind}:${reason.id}:${reason.liveVersion}>${reason.targetVersion}`
    )
    .join(',');
}
