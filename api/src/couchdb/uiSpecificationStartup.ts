// SPDX-License-Identifier: Apache-2.0
/**
 * @file Shared apply step for notebook JSON migrations on API boot.
 *
 * `migrateNotebook` is a pure transform of the design bundle. This module is
 * the persist-side counterpart used by `validateDatabases`: given a listing
 * digest and callbacks to load/write one project or template, decide whether
 * the stored `uiSpecification` must be rewritten.
 *
 * Callers must persist through `updateProjectUiSpecification` /
 * `updateTemplateUiSpecification`. Those helpers run `migrateNotebook` and
 * `buildUiSpecProperties` in one document write so `schemaVersion` and `hash`
 * stay aligned with the stored bundle. This module never hashes itself.
 *
 * Orchestration (Couch connection check, walking both DBs, data-DB init) lives
 * in `validateDatabases.ts` so this file does not import `notebooks` or
 * `templates`.
 */
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  getNotebookSchemaVersion,
  notebookSchemaVersionNeedsMigration,
  notebookUiSpecificationNeedsMigration,
  type NotebookWithSchemaVersion,
} from '@faims3/data-model';
import {logKeyValue, type LogKeyValueFields} from '../utils/logKeyValue';

/** Prefix for structured `console.log` lines from API-boot uiSpec walks. */
export const NOTEBOOK_STARTUP_LOG = '[notebook-startup]';

/**
 * Per-document result of {@link migrateStoredUiSpecificationIfNeeded}.
 *
 * - `migrated` — listing or stored version was behind current; `persist` ran.
 * - `up_to_date` — listing digest already current, or the fetched bundle does
 *   not need migration (including newer-than-current designs, which are left
 *   untouched).
 * - `skipped_no_ui_spec` / `skipped_invalid_ui_spec` — fetched payload missing
 *   or not a JSON object; nothing written.
 */
export type NotebookStartupUiSpecOutcome =
  | 'migrated'
  | 'up_to_date'
  | 'skipped_no_ui_spec'
  | 'skipped_invalid_ui_spec';

/** Running totals for one project or template walk. */
export type NotebookStartupUiSpecCounts = Record<
  NotebookStartupUiSpecOutcome,
  number
>;

export function emptyNotebookStartupUiSpecCounts(): NotebookStartupUiSpecCounts {
  return {
    migrated: 0,
    up_to_date: 0,
    skipped_no_ui_spec: 0,
    skipped_invalid_ui_spec: 0,
  };
}

/** One line: `[notebook-startup] <event> key=value ...` (undefined fields omitted). */
export function logNotebookStartup(
  event: string,
  fields: LogKeyValueFields
): void {
  logKeyValue(NOTEBOOK_STARTUP_LOG, event, fields);
}

function isUiSpecificationObject(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw);
}

function schemaVersionLabel(raw: Record<string, unknown>): string {
  return getNotebookSchemaVersion(raw as NotebookWithSchemaVersion) ?? 'none';
}

/**
 * Apply the boot decision tree to one stored design (project or template).
 *
 * Fast path: if `listedVersion` is present and not behind
 * `CURRENT_NOTEBOOK_UI_SCHEMA_VERSION`, do not fetch the bundle. Otherwise
 * load it (`fetchRaw`). Persist only when the stored JSON itself needs
 * migration — `persist` must be the matching write helper so the digest is
 * rebuilt. Newer-than-current designs are counted `up_to_date` and left
 * unchanged.
 *
 * Mutates `counts` and logs a `ui_spec` event with `logContext` (typically
 * `kind` plus id/name).
 */
export async function migrateStoredUiSpecificationIfNeeded({
  listedVersion,
  fetchRaw,
  persist,
  logContext,
  counts,
}: {
  /** `uiSpecProperties.schemaVersion` from the lean listing view, if any. */
  listedVersion: string | undefined;
  /** Load the full stored `uiSpecification` (only when the listing is stale). */
  fetchRaw: () => Promise<unknown>;
  /**
   * Write the (possibly legacy) bundle back. Must migrate and call
   * `buildUiSpecProperties` — use `updateProjectUiSpecification` or
   * `updateTemplateUiSpecification`.
   */
  persist: (raw: Record<string, unknown>) => Promise<unknown>;
  /** Extra log fields, e.g. `kind`, `projectId` / `templateId`. */
  logContext: Record<string, string | number | boolean | undefined>;
  /** Incremented for this document's {@link NotebookStartupUiSpecOutcome}. */
  counts: NotebookStartupUiSpecCounts;
}): Promise<void> {
  if (listedVersion && !notebookSchemaVersionNeedsMigration(listedVersion)) {
    counts.up_to_date++;
    logNotebookStartup('ui_spec', {
      outcome: 'up_to_date',
      schemaVersion: listedVersion,
      ...logContext,
    });
    return;
  }

  const raw = await fetchRaw();
  if (raw == null) {
    counts.skipped_no_ui_spec++;
    logNotebookStartup('ui_spec', {
      outcome: 'skipped_no_ui_spec',
      ...logContext,
    });
    return;
  }
  if (!isUiSpecificationObject(raw)) {
    counts.skipped_invalid_ui_spec++;
    logNotebookStartup('ui_spec', {
      outcome: 'skipped_invalid_ui_spec',
      ...logContext,
    });
    return;
  }
  if (notebookUiSpecificationNeedsMigration(raw)) {
    const fromSchemaVersion = schemaVersionLabel(raw);
    await persist(raw);
    counts.migrated++;
    logNotebookStartup('ui_spec', {
      outcome: 'migrated',
      fromSchemaVersion,
      toSchemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
      ...logContext,
    });
    return;
  }

  counts.up_to_date++;
  logNotebookStartup('ui_spec', {
    outcome: 'up_to_date',
    schemaVersion: schemaVersionLabel(raw),
    ...logContext,
  });
}
