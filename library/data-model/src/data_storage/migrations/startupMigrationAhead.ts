// SPDX-License-Identifier: Apache-2.0
/**
 * Compare boot-migrate state recorded in the migrations DB to this process's
 * intended boot-migrate end-state.
 *
 * Used after a foreign startup-migration lock settlement so an older
 * process can skip becoming doer (and skip `forceWrite` init) when the
 * cluster is already past this build's targets. Hashes cannot be ordered;
 * these integer / semver fields can.
 *
 * "Ahead" is decided only from documents the boot-migrate process writes
 * itself, never from user content:
 *
 * - Couch DB version documents (written by `migrateDbs`).
 * - Per-database `db-setup` design/security versions (written by
 *   `applyVersionedInitialisation`). Hashes are not ordered and never
 *   count as ahead.
 * - The {@link NOTEBOOK_UI_SCHEMA_MARKER_ID} marker, written by a doer after
 *   its notebook uiSpec walk. Individual project / template
 *   `uiSpecProperties.schemaVersion` values are NOT consulted: they are
 *   copied from whatever uiSpecification was uploaded, so an imported or
 *   future-stamped notebook would otherwise make every upgraded replica skip
 *   boot migrate forever.
 *
 * A live version equal to or behind the target is not ahead. Missing
 * documents, unknown `dbType`s, and a missing or non-semver marker are not
 * ahead.
 */
import {
  compareNotebookSchemaSemver,
  isNotebookSchemaSemver,
} from '../../uiSpecification/schemaVersion';
import {
  DB_SETUP_VERSIONS,
  isDbSetupType,
  type DbSetupPart,
  type DbSetupType,
  type DbSetupVersions,
} from './dbSetup';
import {DB_TARGET_VERSIONS} from './migrations';
import {CURRENT_NOTEBOOK_UI_SCHEMA_VERSION} from './notebookMigrations/registry';
import {
  DATABASE_TYPES,
  type DATABASE_TYPE,
  type DBTargetVersions,
} from './types';

/** `_id` of the notebook UI-schema marker in the migrations DB. */
export const NOTEBOOK_UI_SCHEMA_MARKER_ID = 'notebook-ui-schema-state';

/** `kind` of the notebook UI-schema marker document. */
export const NOTEBOOK_UI_SCHEMA_MARKER_KIND = 'notebook-ui-schema';

/**
 * Records that a build targeting `schemaVersion` ran the notebook uiSpec
 * walk. It does not mean every notebook is at that version (the walk
 * tolerates per-notebook failures); it answers "has a newer build already
 * been here?".
 *
 * Kind `'notebook-ui-schema'` keeps it out of the version-record views.
 */
export type NotebookUiSchemaMarkerDoc = {
  _id: typeof NOTEBOOK_UI_SCHEMA_MARKER_ID;
  _rev?: string;
  kind: typeof NOTEBOOK_UI_SCHEMA_MARKER_KIND;
  /** Strict `MAJOR.MINOR.PATCH`. Only ever raised by boot writers. */
  schemaVersion: string;
  updatedAtMs: number;
  /** Diagnostics only: boot-migrate fingerprint of the writer, when known. */
  fingerprint?: string;
  /** Diagnostics only: `config.apiVersion` of the writer. */
  apiVersion?: string;
  /** Diagnostics only: instance id of the writer. */
  writerId?: string;
};

/** True for a document with the marker `_id` and `kind`. */
export function isNotebookUiSchemaMarker(
  doc: unknown
): doc is NotebookUiSchemaMarkerDoc {
  if (typeof doc !== 'object' || doc === null) {
    return false;
  }
  const record = doc as Record<string, unknown>;
  return (
    record._id === NOTEBOOK_UI_SCHEMA_MARKER_ID &&
    record.kind === NOTEBOOK_UI_SCHEMA_MARKER_KIND
  );
}

/**
 * Version a boot writer should record: the higher of `existing` and `mine`.
 * A missing or non-semver `existing` is replaced by `mine`.
 */
export function mergeNotebookUiSchemaMarkerVersion(
  existing: unknown,
  mine: string
): string {
  if (!isNotebookSchemaSemver(existing)) {
    return mine;
  }
  return compareNotebookSchemaSemver(existing, mine) > 0 ? existing : mine;
}

/** One recorded Couch DB version from the migrations database. */
export type StartupMigrationLiveDbVersion = {
  dbType: string;
  dbName: string;
  version: number;
};

/** One recorded design or security version from a `db-setup` document. */
export type StartupMigrationLiveSetupVersion = {
  setupType: string;
  dbName: string;
  designVersion?: number;
  securityVersion?: number;
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
      liveVersion: string;
      targetVersion: string;
    }
  | {
      kind: 'setup';
      part: DbSetupPart;
      setupType: DbSetupType;
      dbName: string;
      liveVersion: number;
      targetVersion: number;
    };

function isDatabaseType(value: string): value is DATABASE_TYPE {
  return (DATABASE_TYPES as readonly string[]).includes(value);
}

/**
 * Recorded versions that are strictly newer than this process's
 * {@link DB_TARGET_VERSIONS} / {@link CURRENT_NOTEBOOK_UI_SCHEMA_VERSION}.
 * `notebookMarker` is the marker's `schemaVersion`, if the marker exists.
 */
export function findStartupMigrationAheadReasons(input: {
  databases: readonly StartupMigrationLiveDbVersion[];
  notebookMarker?: string;
  setups?: readonly StartupMigrationLiveSetupVersion[];
  targetVersions?: DBTargetVersions;
  notebookTarget?: string;
  setupTargets?: Record<DbSetupType, DbSetupVersions>;
}): StartupMigrationAheadReason[] {
  const targetVersions = input.targetVersions ?? DB_TARGET_VERSIONS;
  const notebookTarget =
    input.notebookTarget ?? CURRENT_NOTEBOOK_UI_SCHEMA_VERSION;
  const setupTargets = input.setupTargets ?? DB_SETUP_VERSIONS;
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

  for (const setup of input.setups ?? []) {
    if (!isDbSetupType(setup.setupType)) {
      continue;
    }
    const targets = setupTargets[setup.setupType];
    if (
      setup.designVersion !== undefined &&
      setup.designVersion > targets.design
    ) {
      reasons.push({
        kind: 'setup',
        part: 'design',
        setupType: setup.setupType,
        dbName: setup.dbName,
        liveVersion: setup.designVersion,
        targetVersion: targets.design,
      });
    }
    if (
      setup.securityVersion !== undefined &&
      setup.securityVersion > targets.security
    ) {
      reasons.push({
        kind: 'setup',
        part: 'security',
        setupType: setup.setupType,
        dbName: setup.dbName,
        liveVersion: setup.securityVersion,
        targetVersion: targets.security,
      });
    }
  }

  const marker = input.notebookMarker;
  if (
    isNotebookSchemaSemver(marker) &&
    isNotebookSchemaSemver(notebookTarget) &&
    compareNotebookSchemaSemver(marker, notebookTarget) > 0
  ) {
    reasons.push({
      kind: 'notebook',
      liveVersion: marker,
      targetVersion: notebookTarget,
    });
  }

  return reasons;
}

/** True when any recorded DB version or the notebook marker is past this process. */
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
        : reason.kind === 'notebook'
          ? `${NOTEBOOK_UI_SCHEMA_MARKER_KIND}:${reason.liveVersion}>${reason.targetVersion}`
          : `setup:${reason.part}:${reason.setupType}:${reason.dbName}:${reason.liveVersion}>${reason.targetVersion}`
    )
    .join(',');
}
