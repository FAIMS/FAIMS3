import {z, ZodError} from 'zod';
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  getNotebookSchemaVersion,
  migrateNotebook,
} from '../data_storage/migrations/notebookMigrations';
import {NotebookDefinitionSchema, type NotebookDefinition} from './types';

export {CURRENT_NOTEBOOK_UI_SCHEMA_VERSION};

type NotebookSchemaVersionCarrier = {
  metadata?: {schema_version?: string | null};
  uiSpec?: {schemaVersion?: string | null};
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Whether {@link migrateNotebook} should run. Missing version is treated as v1
 * (same rule as the migration engine). Compares only to
 * {@link CURRENT_NOTEBOOK_UI_SCHEMA_VERSION}.
 */
export function notebookUiSpecificationNeedsMigration(
  raw: Record<string, unknown>
): boolean {
  const version = getNotebookSchemaVersion(raw as NotebookSchemaVersionCarrier);
  if (version === undefined || version === null) {
    return true;
  }
  return version !== CURRENT_NOTEBOOK_UI_SCHEMA_VERSION;
}

/**
 * Loose API/upload shape: any JSON object (legacy wire or current {@link NotebookDefinition}).
 */
export const NotebookUiSpecificationInputSchema = z.custom<Record<string, unknown>>(
  val => isPlainObject(val),
  {message: 'uiSpecification must be a JSON object'}
);
export type NotebookUiSpecificationInput = z.infer<
  typeof NotebookUiSpecificationInputSchema
>;

function formatZodIssues(error: ZodError): string {
  return error.errors
    .map(issue => {
      const path =
        issue.path.length > 0 ? issue.path.join('.') : 'uiSpecification';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}

function assertLatestSchemaVersion(notebook: NotebookDefinition): void {
  const version = getNotebookSchemaVersion(notebook as NotebookSchemaVersionCarrier);
  if (version !== CURRENT_NOTEBOOK_UI_SCHEMA_VERSION) {
    throw new Error(
      `uiSpecification must use schema version ${CURRENT_NOTEBOOK_UI_SCHEMA_VERSION} after migration (got ${version ?? 'none'})`
    );
  }
}

/**
 * Accept a legacy or current notebook JSON bundle. When the reported schema version
 * is missing or below {@link CURRENT_NOTEBOOK_UI_SCHEMA_VERSION}, runs
 * {@link migrateNotebook}, then validates with {@link NotebookDefinitionSchema}.
 */
export function normalizeNotebookUiSpecification(
  raw: unknown
): NotebookDefinition {
  if (!isPlainObject(raw)) {
    throw new Error('uiSpecification must be a JSON object');
  }

  let candidate: unknown = raw;

  if (notebookUiSpecificationNeedsMigration(raw)) {
    try {
      candidate = migrateNotebook(raw).migrated;
    } catch (cause) {
      const detail =
        cause instanceof Error ? cause.message : 'unknown migration error';
      throw new Error(`uiSpecification migration failed: ${detail}`);
    }
  }

  const parsed = NotebookDefinitionSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error(`Invalid uiSpecification: ${formatZodIssues(parsed.error)}`);
  }

  assertLatestSchemaVersion(parsed.data);

  return parsed.data;
}

/** User-facing message for API validation failures after normalize/migrate. */
export function notebookUiSpecificationValidationMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return `Invalid uiSpecification: ${formatZodIssues(error)}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Invalid uiSpecification';
}
