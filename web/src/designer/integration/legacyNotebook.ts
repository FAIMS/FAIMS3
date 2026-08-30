/**
 * @file Normalize API/upload `uiSpecification` JSON for the designer: detect schema version
 * (legacy `metadata.schema_version` or `uiSpec.schemaVersion`), migrate when needed, then
 * validate as {@link NotebookDefinition} (or {@link TemplateDefinition} in template mode).
 */

import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  getNotebookSchemaVersion,
  migrateNotebook,
  NotebookDefinitionSchema,
  notebookUiSpecificationNeedsMigration,
  notebookUiSpecificationValidationMessage,
  type NotebookDefinition,
  findDuplicatePlanIds,
  findDuplicatePlanLabels,
  safeValidatePlanTemplate,
  TemplateDefinitionSchema,
  type PlanTemplate,
} from '@faims3/data-model';

/** Which document kind the designer is editing; templates may carry plan templates. */
export type DesignerDocumentMode = 'project' | 'template';

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
      data: NotebookDefinition & {planTemplates?: PlanTemplate[]};
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
 * 3. Validates with {@link NotebookDefinitionSchema}, or {@link TemplateDefinitionSchema}
 *    in template mode so optional plan templates are preserved.
 */
export function tryNormalizeApiUiSpecification(
  raw: unknown,
  mode: DesignerDocumentMode = 'project'
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

  // Templates carry optional plan templates the notebook schema would strip, so
  // each mode parses with its own schema and reads back what that schema keeps
  const parsed =
    mode === 'template'
      ? TemplateDefinitionSchema.safeParse(candidate)
      : NotebookDefinitionSchema.safeParse(candidate);
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

  const planTemplates =
    'planTemplates' in parsed.data ? parsed.data.planTemplates : undefined;

  // A repeated id gives two plans one address, and the designer offers no way
  // to change one, so refuse the template rather than open one the api will
  // turn away on save
  const duplicateIds = findDuplicatePlanIds(planTemplates);
  if (duplicateIds.length) {
    return {
      ok: false,
      message: `uiSpecification has more than one plan with the id ${duplicateIds.join(', ')}`,
    };
  }

  // Warn rather than fail on an invalid plan template so the template stays
  // editable; name each failing plan, as normalizing a template does
  const invalid = (planTemplates ?? []).flatMap(planTemplate => {
    const result = safeValidatePlanTemplate(planTemplate);
    return result.success
      ? []
      : [`"${planTemplate.planId}": ${result.error.message}`];
  });
  const planWarning = invalid.length
    ? `${invalid.length} of this template's plans failed validation and may need to be re-created. ${invalid.join(' ')}`
    : undefined;

  // A repeated label is repairable here, unlike a repeated id, so the template
  // opens and says which; the api refuses to store it until one is renamed
  const duplicateLabels = findDuplicatePlanLabels(planTemplates);
  const labelWarning = duplicateLabels.length
    ? `More than one plan has the label ${duplicateLabels.join(', ')}. Rename one before saving: the plan chooser has only the label to tell them apart.`
    : undefined;

  return {
    ok: true,
    data: planTemplates?.length ? {...parsed.data, planTemplates} : parsed.data,
    migrated,
    warning:
      [warning, planWarning, labelWarning].filter(Boolean).join(' ') ||
      undefined,
  };
}

/**
 * Same as {@link tryNormalizeApiUiSpecification} but throws {@link UiSpecificationNormalizeError} on failure.
 */
export function normalizeApiUiSpecification(
  raw: unknown,
  mode: DesignerDocumentMode = 'project'
) {
  const result = tryNormalizeApiUiSpecification(raw, mode);
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
