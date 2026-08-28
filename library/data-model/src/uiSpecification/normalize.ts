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
  TemplateDefinition,
  TemplateDefinitionSchema,
  type NotebookDefinition,
} from './types';
import {
  findDuplicatePlanIds,
  getNotebookPlans,
  getPlanTemplates,
  safeValidatePlan,
  safeValidatePlanTemplate,
} from '../plans';

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
 * Shared migrate + strict validate pass for a notebook or template JSON bundle.
 * Both kinds carry the same uiSpec, so they share the size cap, the migration
 * and the post-migration version assertion, and differ only in the schema they
 * validate against and the wording of their errors.
 */
function normalizeUiSpecificationBundle<
  T extends {uiSpec: {schemaVersion?: unknown}},
>({
  raw,
  schema,
  label,
}: {
  raw: unknown;
  schema: z.ZodType<T>;
  /** Names the bundle kind in every error message. */
  label: string;
}): T {
  if (!isPlainObject(raw)) {
    throw new Error(`${label} must be a JSON object`);
  }

  if (estimateJsonBytes(raw) > UI_SPEC_MAX_BYTES) {
    throw new Error(
      `${label} is too large (maximum ${Math.floor(UI_SPEC_MAX_BYTES / (1024 * 1024))} MB)`
    );
  }

  let candidate: unknown = raw;

  if (notebookUiSpecificationNeedsMigration(raw)) {
    try {
      candidate = migrateNotebook(raw).migrated;
    } catch (cause) {
      const detail =
        cause instanceof Error ? cause.message : 'unknown migration error';
      throw new Error(`${label} migration failed: ${detail}`);
    }
  }

  const parsed = schema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error(`Invalid ${label}: ${formatZodIssues(parsed.error)}`);
  }

  assertLatestSchemaVersion(parsed.data as unknown as NotebookDefinition);

  return parsed.data;
}

/**
 * Accept a legacy or current notebook template JSON bundle, then validate each
 * plan template it carries against that plan type's own schema.
 */
export function normalizeNotebookTemplateUiSpecification(
  raw: unknown
): TemplateDefinition {
  const definition = normalizeUiSpecificationBundle({
    raw,
    schema: TemplateDefinitionSchema,
    label: 'template uiSpecification',
  });

  // A template written against the single-plan shape would otherwise parse as
  // one with no plans at all, and create plan-less notebooks without a word.
  if (
    raw &&
    typeof raw === 'object' &&
    'planTemplate' in (raw as Record<string, unknown>)
  ) {
    throw new Error(
      'Template uiSpecification carries a single planTemplate; move it into the planTemplates list'
    );
  }

  const duplicateIds = findDuplicatePlanIds(definition.planTemplates);
  if (duplicateIds.length) {
    throw new Error(
      `Repeated plan id ${duplicateIds.join(', ')} in template uiSpecification`
    );
  }

  for (const {planId, planTemplate} of getPlanTemplates(definition)) {
    if (!safeValidatePlanTemplate(planTemplate).success) {
      throw new Error(
        `Invalid plan template "${planId}" in template uiSpecification`
      );
    }
  }

  return definition;
}

/**
 * Accept a legacy or current notebook JSON bundle, then validate each plan it
 * carries against that plan type's own schema.
 */
export function normalizeNotebookUiSpecification(
  raw: unknown
): NotebookDefinition {
  const definition = normalizeUiSpecificationBundle({
    raw,
    schema: NotebookDefinitionSchema,
    label: 'uiSpecification',
  });

  const duplicateIds = findDuplicatePlanIds(definition.plans);
  if (duplicateIds.length) {
    throw new Error(
      `Repeated plan id ${duplicateIds.join(', ')} in uiSpecification`
    );
  }

  // Validate every plan the notebook carries, so a bad one is caught at load
  // rather than when its tab is first opened.
  for (const {planId, plan} of getNotebookPlans(definition)) {
    if (!safeValidatePlan(plan).success) {
      throw new Error(`Invalid plan "${planId}" in uiSpecification`);
    }
  }

  return definition;
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
