/**
 * @file Normalize API/upload `uiSpecification` JSON for the designer: detect schema version
 * (legacy `metadata.schema_version` or `uiSpec.schemaVersion`), migrate when needed, then
 * validate as {@link NotebookDefinition}.
 */

import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  getNotebookSchemaVersion,
  migrateNotebook,
  NotebookDefinitionSchema,
  notebookUiSpecificationNeedsMigration,
  notebookUiSpecificationValidationMessage,
  type NotebookDefinition,
} from '@faims3/data-model';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Thrown when uiSpecification cannot be migrated or validated for the designer. */
export class UiSpecificationNormalizeError extends Error {
  readonly cause?: unknown;

  constructor(message: string, options?: {cause?: unknown}) {
    super(message);
    this.name = 'UiSpecificationNormalizeError';
    this.cause = options?.cause;
  }
}

export type NormalizeApiUiSpecificationResult =
  | {
      ok: true;
      data: NotebookDefinition;
      /** True when {@link migrateNotebook} ran because the version was missing or below current. */
      migrated: boolean;
      /** Present when migration ran — design was upgraded in memory before editing. */
      warning?: string;
    }
  | {
      ok: false;
      message: string;
    };

/**
 * Read schema version from a loose payload (legacy or current paths) without migrating.
 */
export function readUiSpecificationSchemaVersion(
  raw: Record<string, unknown>
): string | undefined {
  return getNotebookSchemaVersion(raw);
}

/**
 * Normalize API/upload JSON to the current {@link NotebookDefinition}.
 *
 * 1. Reads version via {@link getNotebookSchemaVersion} (legacy or current field).
 * 2. Runs {@link migrateNotebook} when version is missing or below {@link CURRENT_NOTEBOOK_UI_SCHEMA_VERSION}.
 * 3. Validates with {@link NotebookDefinitionSchema}.
 */
export function tryNormalizeApiUiSpecification(
  raw: unknown
): NormalizeApiUiSpecificationResult {
  if (!isPlainObject(raw)) {
    return {ok: false, message: 'uiSpecification must be a JSON object'};
  }

  const versionBefore = readUiSpecificationSchemaVersion(raw);
  const needsMigration = notebookUiSpecificationNeedsMigration(raw);

  let candidate: unknown = raw;

  if (needsMigration) {
    try {
      candidate = migrateNotebook(raw).migrated;
    } catch (cause) {
      return {
        ok: false,
        message: `uiSpecification migration failed: ${notebookUiSpecificationValidationMessage(cause)}`,
      };
    }
  }

  const parsed = NotebookDefinitionSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      message: notebookUiSpecificationValidationMessage(parsed.error),
    };
  }

  const versionAfter = parsed.data.uiSpec.schemaVersion;
  if (versionAfter !== CURRENT_NOTEBOOK_UI_SCHEMA_VERSION) {
    return {
      ok: false,
      message: `uiSpecification must use schema version ${CURRENT_NOTEBOOK_UI_SCHEMA_VERSION} after migration (got ${versionAfter ?? 'none'})`,
    };
  }

  const migrated = needsMigration;
  const warning =
    migrated && versionBefore !== CURRENT_NOTEBOOK_UI_SCHEMA_VERSION
      ? versionBefore == null
        ? `This design had no schema version and was migrated to ${CURRENT_NOTEBOOK_UI_SCHEMA_VERSION}. Save to persist the updated structure.`
        : `This design used schema version ${versionBefore} and was migrated to ${CURRENT_NOTEBOOK_UI_SCHEMA_VERSION}. Save to persist the updated structure.`
      : undefined;

  return {ok: true, data: parsed.data, migrated, warning};
}

/**
 * Same as {@link tryNormalizeApiUiSpecification} but throws {@link UiSpecificationNormalizeError} on failure.
 */
export function normalizeApiUiSpecification(raw: unknown): NotebookDefinition {
  const result = tryNormalizeApiUiSpecification(raw);
  if (result.ok === false) {
    throw new UiSpecificationNormalizeError(result.message);
  }
  return result.data;
}

/** User-facing message for display in the designer shell (dialogs, alerts). */
export function formatUiSpecificationNormalizeError(error: unknown): string {
  if (error instanceof UiSpecificationNormalizeError) {
    return error.message;
  }
  return notebookUiSpecificationValidationMessage(error);
}
