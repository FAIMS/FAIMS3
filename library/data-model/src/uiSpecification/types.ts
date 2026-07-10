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

/** Identifier for a form (a form type). */
export const FormIdSchema = z.string();
export type FormId = z.infer<typeof FormIdSchema>;

/** Maps each form to the field used as its human-readable id (HRID). */
export const HridFieldMapSchema = z.record(FormIdSchema, z.string().optional());
export type HridFieldMap = z.infer<typeof HridFieldMapSchema>;

/** Current field values, used when evaluating conditional logic. */
export const RecordValuesSchema = z.record(z.string(), z.any());
export type RecordValues = z.infer<typeof RecordValuesSchema>;

// ============================================================================
// UI specification model
//
// UISpec: fields, the sections that group them, and the forms that group
// sections. Object schemas use `.passthrough()` so that validating a stored
// spec never silently drops unmodelled properties. Note: Viewsets === Forms ->
// We will eventually rename this to Form
// ============================================================================

/**
 * A conditional logic expression, evaluated against a record's values to decide
 * whether a section or field is shown. May nest via `conditions`.
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

/** Annotation & uncertainty capture toggles attached to a field. */
export const FieldMetaSchema = z.object({
  annotation: z.object({include: z.boolean(), label: z.string()}),
  uncertainty: z.object({include: z.boolean(), label: z.string()}),
});
export type FieldMeta = z.infer<typeof FieldMetaSchema>;

/**
 * Parameters shared by every field's `component-parameters`.
 *
 * This is the single source of truth for the base parameter envelope: the
 * forms layer extends this schema per field type (each field's
 * `fieldPropsSchema`), and the designer types its redux field on top of it.
 * Living here (the lowest layer) lets both consumers reference one definition
 * instead of redeclaring the common shape.
 */
export const BaseFieldParametersSchema = z.object({
  label: z.string().optional(),
  name: z.string(),
  helperText: z.string().optional(),
  required: z.boolean().optional(),
  advancedHelperText: z.string().optional(),
  disabled: z.boolean().optional(),
});
export type BaseFieldParameters = z.infer<typeof BaseFieldParametersSchema>;

/**
 * The modelled shape of a single field definition.
 *
 * `component-parameters` carries the {@link BaseFieldParameters} common to all
 * fields and passes any further per-field-type parameters through unmodelled
 * (validated precisely in the forms layer via each field's `fieldPropsSchema`,
 * which depends on this package and so cannot be referenced from it).
 */
const fieldDefinitionShape = {
  'component-namespace': z.string(),
  'component-name': z.string(),
  'type-returned': z.string(),
  'component-parameters': BaseFieldParametersSchema.passthrough(),
  initialValue: z.any().optional(),
  persistent: z.boolean().optional(),
  displayParent: z.boolean().optional(),
  meta: FieldMetaSchema.optional(),
  /** Conditional logic controlling this field's visibility. */
  condition: ConditionalExpressionSchema.nullable().optional(),
};

/**
 * A single field definition, keyed by field name in {@link UiSpecFieldsSchema}.
 * This is the canonical runtime (serializable) shape of a field; the designer
 * extends it with its own authoring/chooser metadata rather than redefining it.
 *
 * `.passthrough()` keeps any unmodelled properties (including the designer's
 * authoring metadata) intact across a validate/serialize round-trip.
 */
export const FieldDefinitionSchema = z
  .object(fieldDefinitionShape)
  .passthrough();

/**
 * Canonical field-definition type.
 *
 * Derived from the strict (non-passthrough) shape so it carries the named
 * properties without a `[k: string]: unknown` index signature. That keeps the
 * type composable with `Omit`/intersection in downstream packages (e.g. the
 * designer overriding `component-parameters`), while the schema above still
 * passes unmodelled keys through at runtime.
 */
export type FieldDefinition = z.infer<z.ZodObject<typeof fieldDefinitionShape>>;

/**
 * A field definition with its conditional logic compiled into a callable
 * function. Same shape as {@link FieldDefinition} but carries the
 * non-serializable `conditionFn`, mirroring the {@link UiSpecSection} ↔
 * {@link CompiledUiSpecSection} relationship.
 */
const compiledFieldDefinitionShape = {
  ...fieldDefinitionShape,
  /**
   * Compiled form of {@link FieldDefinition.condition}; attached at runtime by
   * `compileUiSpecConditionals`. Non-serializable, so it is only validated as
   * being a function (when present) rather than by structure.
   */
  conditionFn: z.custom<(v: RecordValues) => boolean>().optional(),
  /**
   * Compiled form of a ComputedField's expression; attached at runtime by
   * `compileUiSpecConditionals`. Non-serializable, validated only as a function.
   */
  expressionFn: z
    .custom<(scope: Map<string, number>) => number | null>()
    .optional(),
  /** Field IDs referenced by the expression; used to build the eval scope. */
  expressionRefs: z.custom<string[]>().optional(),
};
export const CompiledFieldDefinitionSchema = z
  .object(compiledFieldDefinitionShape)
  .passthrough();
export type CompiledFieldDefinition = z.infer<
  z.ZodObject<typeof compiledFieldDefinitionShape>
>;

/** Field definitions keyed by field name. */
export const UiSpecFieldsSchema = z.record(z.string(), FieldDefinitionSchema);
export type UiSpecFields = z.infer<typeof UiSpecFieldsSchema>;

/** Compiled field definitions keyed by field name. */
export const CompiledUiSpecFieldsSchema = z.record(
  z.string(),
  CompiledFieldDefinitionSchema
);
export type CompiledUiSpecFields = z.infer<typeof CompiledUiSpecFieldsSchema>;

/** A form: a named form type composed of one or more sections. */
export const UiSpecFormSchema = z
  .object({
    label: z.string().optional(),
    // TODO Rename to sections
    views: z.array(z.string()),
    is_visible: z.boolean().optional(),
    summary_fields: z.array(z.string()).optional(),
    /** Which field should be used as the HRID. */
    hridField: z.string().optional(),
    /** How the form's sections are laid out. */
    layout: z.enum(['inline', 'tabs']).optional(),
    /** Whether records of this form type appear on the notebook overview map. */
    displayInOverviewMap: z.boolean().optional(),
  })
  .passthrough();
export type UiSpecForm = z.infer<typeof UiSpecFormSchema>;

/** Forms keyed by type. */
export const UiSpecFormsSchema = z.record(z.string(), UiSpecFormSchema);
export type UiSpecForms = z.infer<typeof UiSpecFormsSchema>;

/** A section: a named group of fields, optionally gated by conditional logic. */
export const UiSpecSectionSchema = z
  .object({
    label: z.string().optional(),
    fields: z.array(z.string()),
    /** Conditional logic that controls visibility. */
    condition: ConditionalExpressionSchema.optional(),
    description: z.string().optional(),
  })
  .passthrough();
export type UiSpecSection = z.infer<typeof UiSpecSectionSchema>;

/**
 * A section with its conditional logic compiled into a callable function. Same
 * shape as {@link UiSpecSection} but carries the non-serializable `conditionFn`.
 */
export const CompiledUiSpecSectionSchema = UiSpecSectionSchema.extend({
  conditionFn: z.custom<(v: RecordValues) => boolean>().optional(),
});
export type CompiledUiSpecSection = z.infer<typeof CompiledUiSpecSectionSchema>;

/** Sections keyed by section name. */
export const UiSpecSectionsSchema = z.record(z.string(), UiSpecSectionSchema);
export type UiSpecSections = z.infer<typeof UiSpecSectionsSchema>;

/** Compiled sections keyed by section name. */
export const CompiledUiSpecSectionsSchema = z.record(
  z.string(),
  CompiledUiSpecSectionSchema
);
export type CompiledUiSpecSections = z.infer<
  typeof CompiledUiSpecSectionsSchema
>;

/** The full UI specification model. */
export const UiSpecModelSchema = z
  .object({
    fields: UiSpecFieldsSchema,
    // TODO Rename to sections
    views: UiSpecSectionsSchema,
    // TODO Rename to forms
    viewsets: UiSpecFormsSchema,
    visible_types: z.array(z.string()),
  })
  .passthrough();
export type UiSpecModel = z.infer<typeof UiSpecModelSchema>;

/**
 * A {@link UiSpecModel} with views compiled (conditions turned into functions)
 * and a record of which fields feed into conditional expressions.
 */
export const CompiledUiSpecModelSchema = UiSpecModelSchema.extend({
  fields: CompiledUiSpecFieldsSchema,
  // TODO Rename to sections
  views: CompiledUiSpecSectionsSchema,
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
  custom: z.record(z.string(), z.any()).optional(),
});
export type NotebookMetadata = z.infer<typeof NotebookMetadataSchema>;

/**
 * Inlined merge of the former notebook JSON and metadata DB. `uiSpec` = decoded
 * **`UiSpecModel`** (`fields`, `views (sections)`, `viewsets (forms)`,
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
 * Compiled counterpart of {@link NotebookUiSpec}: same shape but with sections
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
