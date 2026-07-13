import {z, ZodError} from 'zod';
import {estimateJsonBytes, INPUT_LIMITS} from '../inputLimits';
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  getNotebookSchemaVersion,
  migrateNotebook,
} from '../data_storage/migrations/notebookMigrations';
import {
  NotebookDefinitionSchema,
  NotebookDefinitionUploadSchema,
  type NotebookDefinition,
} from './types';

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

/** Maximum serialized size (bytes) for an incoming ui-specification (design file). */
export const UI_SPEC_MAX_BYTES = INPUT_LIMITS.UI_SPEC_MAX_BYTES;

/**
 * Loose API/upload shape: any JSON object (legacy wire or current {@link NotebookDefinition}).
 * Rejects design files whose serialized size exceeds {@link UI_SPEC_MAX_BYTES}.
 */
export const NotebookUiSpecificationInputSchema = z
  .custom<Record<string, unknown>>(val => isPlainObject(val), {
    message: 'uiSpecification must be a JSON object',
  })
  .refine(val => estimateJsonBytes(val) <= UI_SPEC_MAX_BYTES, {
    message: `uiSpecification is too large (maximum ${Math.floor(UI_SPEC_MAX_BYTES / (1024 * 1024))} MB)`,
  });
export type NotebookUiSpecificationInput = z.infer<
  typeof NotebookUiSpecificationInputSchema
>;

function formatZodIssues(error: ZodError): string {
  return error.issues
    .map(issue => {
      const path =
        issue.path.length > 0 ? issue.path.join('.') : 'uiSpecification';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}

function assertLatestSchemaVersion(notebook: NotebookDefinition): void {
  const version = getNotebookSchemaVersion(
    notebook as NotebookSchemaVersionCarrier
  );
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

  if (estimateJsonBytes(raw) > UI_SPEC_MAX_BYTES) {
    throw new Error(
      `uiSpecification is too large (maximum ${Math.floor(UI_SPEC_MAX_BYTES / (1024 * 1024))} MB)`
    );
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
    throw new Error(
      `Invalid uiSpecification: ${formatZodIssues(parsed.error)}`
    );
  }

  assertLatestSchemaVersion(parsed.data);

  return parsed.data;
}

export type PrepareNotebookUiSpecificationInputResult =
  | {ok: true; uiSpecification: NotebookUiSpecificationInput}
  | {ok: false; message: string};

/**
 * Loose client check aligned with POST/PUT API gateway
 * ({@link NotebookUiSpecificationInputSchema}). Unwraps a top-level
 * `uiSpecification` when present. Does not migrate or strict-validate — the
 * API runs {@link normalizeNotebookUiSpecification}.
 */
export function prepareNotebookUiSpecificationInputForApi(
  payload: unknown
): PrepareNotebookUiSpecificationInputResult {
  let candidate = payload;
  if (isPlainObject(payload) && payload.uiSpecification !== undefined) {
    candidate = payload.uiSpecification;
  }
  const parsed = NotebookUiSpecificationInputSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      message: notebookUiSpecificationValidationMessage(parsed.error),
    };
  }
  return {ok: true, uiSpecification: parsed.data};
}

export type ParseNotebookDefinitionUploadResult =
  | {ok: true; uiSpecification: NotebookDefinition}
  | {ok: false; message: string};

/** Validate Download JSON / PUT uiSpecification upload (no migration). */
export function parseNotebookDefinitionUpload(
  payload: unknown
): ParseNotebookDefinitionUploadResult {
  const parsed = NotebookDefinitionUploadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      message: notebookUiSpecificationValidationMessage(parsed.error),
    };
  }
  return {ok: true, uiSpecification: parsed.data};
}

/** User-facing message for API validation failures after normalize/migrate. */
export function notebookUiSpecificationValidationMessage(
  error: unknown
): string {
  if (error instanceof ZodError) {
    return `Invalid uiSpecification: ${formatZodIssues(error)}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Invalid uiSpecification';
}
