import {z, ZodError} from 'zod';
import {estimateJsonBytes, INPUT_LIMITS} from '../inputLimits';
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  getNotebookSchemaVersion,
  migrateNotebook,
  NOTEBOOK_SCHEMA_LEGACY,
  resolveNotebookSchemaMigrationStart,
  type NotebookWithSchemaVersion,
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
  findDuplicatePlanLabels,
  safeValidatePlan,
  safeValidatePlanTemplate,
} from '../plans';
import {compareNotebookSchemaSemver} from './schemaVersion';

export {CURRENT_NOTEBOOK_UI_SCHEMA_VERSION};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Whether {@link migrateNotebook} should run: true for any legacy (non strict
 * semver) version and for strict versions **older** than
 * {@link CURRENT_NOTEBOOK_UI_SCHEMA_VERSION}. A version that is equal to or
 * **newer** than current never needs migration — forward compatibility is
 * decided by `assessNotebookSchemaCompatibility`, not by migrating.
 */
export function notebookUiSpecificationNeedsMigration(
  raw: Record<string, unknown>
): boolean {
  const start = resolveNotebookSchemaMigrationStart(
    getNotebookSchemaVersion(raw as NotebookWithSchemaVersion)
  );
  if (start === NOTEBOOK_SCHEMA_LEGACY) {
    return true;
  }
  return (
    compareNotebookSchemaSemver(start, CURRENT_NOTEBOOK_UI_SCHEMA_VERSION) < 0
  );
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

function formatZodIssues(
  error: ZodError,
  fallbackPath = 'uiSpecification'
): string {
  return error.issues
    .map(issue => {
      const path = issue.path.length > 0 ? issue.path.join('.') : fallbackPath;
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}

function assertLatestSchemaVersion(version: unknown): void {
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

  assertLatestSchemaVersion(parsed.data.uiSpec.schemaVersion);

  return parsed.data;
}

/**
 * Reject a set of plans or plan templates a notebook could not offer: an id
 * repeated between two of them, a label repeated between two of them, or one
 * that its own plan type refuses. All are caught at load rather than when the
 * plan's tab is first opened.
 */
function assertPlansAddressable({
  plans,
  validate,
  what,
  label,
}: {
  plans: {planId: string; label: string}[] | undefined;
  validate: (plan: unknown) => {success: boolean};
  what: string;
  label: string;
}): void {
  const duplicateIds = findDuplicatePlanIds(plans);
  if (duplicateIds.length) {
    throw new Error(`Repeated plan id ${duplicateIds.join(', ')} in ${label}`);
  }

  // The chooser has only the label to tell two plans apart by
  const duplicateLabels = findDuplicatePlanLabels(plans);
  if (duplicateLabels.length) {
    throw new Error(
      `Repeated plan label ${duplicateLabels.join(', ')} in ${label}`
    );
  }

  for (const plan of plans ?? []) {
    if (!validate(plan).success) {
      throw new Error(`Invalid ${what} "${plan.planId}" in ${label}`);
    }
  }
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

  assertPlansAddressable({
    plans: definition.planTemplates,
    validate: safeValidatePlanTemplate,
    what: 'plan template',
    label: 'template uiSpecification',
  });

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

  assertPlansAddressable({
    plans: definition.plans,
    validate: safeValidatePlan,
    what: 'plan',
    label: 'uiSpecification',
  });

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

/**
 * User-facing message for notebook validation / ingest failures.
 *
 * Write-path callers keep the default `Invalid uiSpecification:` prefix and
 * `uiSpecification` fallback path. The read path (`ingestNotebookUiSpecification`)
 * asks for issues only, with `uiSpec` as the empty-path label.
 */
export function notebookUiSpecificationValidationMessage(
  error: unknown,
  options?: {
    fallbackPath?: string;
    /** When true, return Zod issues without the `Invalid uiSpecification:` prefix. */
    issuesOnly?: boolean;
  }
): string {
  if (error instanceof ZodError) {
    const issues = formatZodIssues(error, options?.fallbackPath);
    return options?.issuesOnly ? issues : `Invalid uiSpecification: ${issues}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return options?.issuesOnly ? String(error) : 'Invalid uiSpecification';
}
