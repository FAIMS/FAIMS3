import {z} from 'zod';

// ============================================================================
// Basic aliases
//
// Each model is defined as a zod `<Name>Schema` with the type derived via
// `z.infer`, so runtime validation and the static type stay in sync.
// ============================================================================

/** A bag of field values keyed by field name. */
export const ValuesObjectSchema = z.record(z.string(), z.any());
export type ValuesObject = z.infer<typeof ValuesObjectSchema>;

/** Identifier for a viewset (a form type). */
export const ViewsetIdSchema = z.string();
export type ViewsetId = z.infer<typeof ViewsetIdSchema>;

/** Maps each viewset to the field used as its human-readable id (HRID). */
export const HridFieldMapSchema = z.record(
  ViewsetIdSchema,
  z.string().optional()
);
export type HridFieldMap = z.infer<typeof HridFieldMapSchema>;

/** Current field values, used when evaluating conditional logic. */
export const RecordValuesSchema = z.record(z.string(), z.any());
export type RecordValues = z.infer<typeof RecordValuesSchema>;

// ============================================================================
// UI specification model
//
// The decoded form definition: fields, the views that group them, and the
// viewsets (form types) that group views. Object schemas use `.passthrough()`
// so that validating a stored spec never silently drops unmodelled properties.
// ============================================================================

/**
 * A conditional logic expression, evaluated against a record's values to decide
 * whether a view or field is shown. May nest via `conditions`.
 *
 * This type is declared explicitly rather than inferred: it is self-referential,
 * and zod needs a type annotation to resolve a recursive `z.lazy` schema.
 */
export interface ConditionalExpression {
  operator: string;
  conditions?: ConditionalExpression[];
  field?: string;
  // TODO: `value` is the comparand for `operator` and can be a string, number,
  // boolean or array. Kept as `any` until the supported operand types are
  // pinned down.
  value?: any;
}
export const ConditionalExpressionSchema: z.ZodType<ConditionalExpression> =
  z.lazy(() =>
    z.object({
      operator: z.string(),
      conditions: z.array(ConditionalExpressionSchema).optional(),
      field: z.string().optional(),
      value: z.any().optional(),
    })
  );

/**
 * Field definitions keyed by field name.
 *
 * TODO: model the individual field-definition shape with zod. Field configs are
 * currently untyped (`any`); their compiled `conditionFn` is attached at runtime.
 */
export const UiSpecFieldsSchema = z.record(z.string(), z.any());
export type UiSpecFields = z.infer<typeof UiSpecFieldsSchema>;

/** A viewset: a named form type composed of one or more views. */
export const UiSpecViewsetSchema = z
  .object({
    label: z.string().optional(),
    views: z.array(z.string()),
    submit_label: z.string().optional(),
    is_visible: z.boolean().optional(),
    summary_fields: z.array(z.string()).optional(),
    /** Which field should be used as the HRID. */
    hridField: z.string().optional(),
    /** How the viewset's views are laid out. */
    layout: z.enum(['inline', 'tabs']).optional(),
  })
  .passthrough();
export type UiSpecViewset = z.infer<typeof UiSpecViewsetSchema>;

/** Viewsets keyed by type. */
export const UiSpecViewsetsSchema = z.record(z.string(), UiSpecViewsetSchema);
export type UiSpecViewsets = z.infer<typeof UiSpecViewsetsSchema>;

/** A view: a named group of fields, optionally gated by conditional logic. */
export const UiSpecViewSchema = z
  .object({
    label: z.string().optional(),
    fields: z.array(z.string()),
    uidesign: z.string().optional(),
    next_label: z.string().optional(),
    /** Branching logic. */
    is_logic: z.record(z.string(), z.array(z.string())).optional(),
    /** Conditional logic that controls visibility. */
    condition: ConditionalExpressionSchema.optional(),
    /**
     * Compiled form of {@link condition}; see {@link CompiledUiSpecView}.
     * Non-serializable, so it is only validated as being a function (when
     * present) rather than by structure.
     */
    conditionFn: z.custom<(v: RecordValues) => boolean>().optional(),
    description: z.string().optional(),
  })
  .passthrough();
export type UiSpecView = z.infer<typeof UiSpecViewSchema>;

/**
 * A view with its conditional logic compiled into a callable function. Same
 * shape as {@link UiSpecView} but carries the non-serializable `conditionFn`.
 */
export const CompiledUiSpecViewSchema = UiSpecViewSchema.extend({
  conditionFn: z.custom<(v: RecordValues) => boolean>().optional(),
});
export type CompiledUiSpecView = z.infer<typeof CompiledUiSpecViewSchema>;

/** Views keyed by view name. */
export const UiSpecViewsSchema = z.record(z.string(), UiSpecViewSchema);
export type UiSpecViews = z.infer<typeof UiSpecViewsSchema>;

/** Compiled views keyed by view name. */
export const CompiledUiSpecViewsSchema = z.record(
  z.string(),
  CompiledUiSpecViewSchema
);
export type CompiledUiSpecViews = z.infer<typeof CompiledUiSpecViewsSchema>;

/** The full UI specification model. */
export const UiSpecModelSchema = z
  .object({
    fields: UiSpecFieldsSchema,
    views: UiSpecViewsSchema,
    viewsets: UiSpecViewsetsSchema,
    visible_types: z.array(z.string()),
  })
  .passthrough();
export type UiSpecModel = z.infer<typeof UiSpecModelSchema>;

/**
 * A {@link UiSpecModel} with views compiled (conditions turned into functions)
 * and a record of which fields feed into conditional expressions.
 */
export const CompiledUiSpecModelSchema = UiSpecModelSchema.extend({
  views: CompiledUiSpecViewsSchema,
  /** Field names that are referenced as conditional sources. */
  conditional_sources: z.set(z.string()),
});
export type CompiledUiSpecModel = z.infer<typeof CompiledUiSpecModelSchema>;

// ============================================================================
// Notebook schemas (zod)
//
// Runtime-validated schemas and their inferred types for a notebook definition:
// the UI spec, its functional settings, and non-functional design metadata.
// ============================================================================

/** UI behaviour toggles. */
export const NotebookSettingsSchema = z.object({
  /** When true, show “search by QR” on the record list for this survey. */
  showQrCodeButton: z.boolean(),
});
export type NotebookSettings = z.infer<typeof NotebookSettingsSchema>;

/** Non-functional **design** documentation bundled with the form definition. */
export const NotebookInformationSchema = z.object({
  /** Notebook / designer semver or similar; user managed. */
  notebookVersion: z.string(),
  /** Long-form design intent (formerly `pre_description`). */
  purposeMarkdown: z.string(),
  /** Responsible-person label for the design (formerly `project_lead`); not a user id. */
  projectLeadLabel: z.string(),
  /** Free-text field to track the creating institution. */
  leadInstitution: z.string(),
  /**
   * Source template id when this definition was derived or copied from another
   * template design.
   */
  derivedFromTemplateId: z.string().optional(),
});
export type NotebookInformation = z.infer<typeof NotebookInformationSchema>;

/** Typed design metadata plus optional org extensions. */
export const NotebookMetadataSchema = z.object({
  /** Non-functional information about the notebook. */
  information: NotebookInformationSchema,
  /** Optional key/value bag for org-specific tagging; not for settings or user ids. */
  custom: z.record(z.any()).optional(),
});
export type NotebookMetadata = z.infer<typeof NotebookMetadataSchema>;

/**
 * Inlined merge of the former notebook JSON and metadata DB.
 * `uiSpec` = decoded **`UiSpecModel`** (`fields`, `views`, `viewsets`,
 * `visible_types`) plus **`settings`** and **`schemaVersion`**.
 */
export const NotebookUiSpecSchema = UiSpecModelSchema.and(
  z.object({
    /** UI functional settings. */
    settings: NotebookSettingsSchema,
    /** Drives notebook migration / compatibility. */
    schemaVersion: z.string(),
  })
);
export type NotebookUiSpec = z.infer<typeof NotebookUiSpecSchema>;

/**
 * Compiled counterpart of {@link NotebookUiSpec}: same shape but with views
 * compiled (conditions turned into `conditionFn`s) and `conditional_sources`
 * populated, as per {@link CompiledUiSpecModelSchema}.
 */
export const CompiledNotebookUiSpecSchema = CompiledUiSpecModelSchema.and(
  z.object({
    /** UI functional settings. */
    settings: NotebookSettingsSchema,
    /** Drives notebook migration / compatibility. */
    schemaVersion: z.string(),
  })
);
export type CompiledNotebookUiSpec = z.infer<
  typeof CompiledNotebookUiSpecSchema
>;

export const NotebookDefinitionSchema = z.object({
  uiSpec: NotebookUiSpecSchema,
  metadata: NotebookMetadataSchema,
});
export type NotebookDefinition = z.infer<typeof NotebookDefinitionSchema>;

/**
 * Compiled counterpart of {@link NotebookDefinition}: identical shape but with a
 * compiled {@link CompiledNotebookUiSpec} in place of the plain `uiSpec`.
 */
export const CompiledNotebookDefinitionSchema = z.object({
  uiSpec: CompiledNotebookUiSpecSchema,
  metadata: NotebookMetadataSchema,
});
export type CompiledNotebookDefinition = z.infer<
  typeof CompiledNotebookDefinitionSchema
>;

const isPlainObjectRecord = (
  value: unknown
): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Download JSON / PUT uiSpecification body: a {@link NotebookDefinition} at the
 * root (not wrapped in a `uiSpecification` property).
 */
export const NotebookDefinitionUploadSchema = z
  .custom<Record<string, unknown>>(isPlainObjectRecord, {
    message: 'JSON must be an object',
  })
  .refine(val => val.uiSpecification === undefined, {
    message:
      'JSON must use top-level metadata and uiSpec (not a wrapped uiSpecification object)',
  })
  .pipe(NotebookDefinitionSchema);
