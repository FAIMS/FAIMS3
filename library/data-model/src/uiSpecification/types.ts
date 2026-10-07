// SPDX-License-Identifier: Apache-2.0
import {z} from 'zod';
import {PlanTemplateSchema} from '../plans/types';
// Barrel import (not '../plans/planTypeMap') so the per-plan PlanTypeMap
// augmentations are in scope here, making a stored plan a narrowable union.
import {RegisteredPlanSchema} from '../plans';
import {ExprValue} from './expressions';
import {NotebookSchemaSemverSchema} from './schemaVersion';

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
// sections. Object schemas use `.loose()` so that validating a stored
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
 * Shared field properties (every schema version).
 *
 * `component-parameters` carries the {@link BaseFieldParameters} common to all
 * fields and passes any further per-field-type parameters through unmodelled
 * (validated precisely in the forms layer via each field's `fieldPropsSchema`,
 * which depends on this package and so cannot be referenced from it).
 */
const fieldDefinitionBaseShape = {
  'component-namespace': z.string(),
  'component-name': z.string(),
  'type-returned': z.string(),
  'component-parameters': BaseFieldParametersSchema.loose(),
  initialValue: z.any().optional(),
  persistent: z.boolean().optional(),
  meta: FieldMetaSchema.optional(),
  /** Conditional logic controlling this field's visibility. */
  condition: ConditionalExpressionSchema.nullable().optional(),
};

/** Field shape at notebook schema `1.0.0` — no `exportName`. */
const fieldDefinitionV1Shape = fieldDefinitionBaseShape;

/**
 * Field shape at notebook schema `1.0.1`.
 *
 * `exportName` is the editable CSV / GIS column. Distinct from the
 * `uiSpec.fields` object key, which is the immutable storage id.
 */
const fieldDefinitionV1_0_1Shape = {
  ...fieldDefinitionV1Shape,
  exportName: z.string().min(1),
};

const compiledFieldExtras = {
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
    .custom<(scope: Map<string, ExprValue>) => ExprValue | null>()
    .optional(),
  /** Field IDs referenced by the expression; used to build the eval scope. */
  expressionRefs: z.custom<string[]>().optional(),
};

const compiledFieldDefinitionV1Shape = {
  ...fieldDefinitionV1Shape,
  ...compiledFieldExtras,
};
const compiledFieldDefinitionV1_0_1Shape = {
  ...fieldDefinitionV1_0_1Shape,
  ...compiledFieldExtras,
};

/**
 * A single field definition at schema `1.0.0`.
 *
 * `.loose()` keeps any unmodelled properties (including the designer's
 * authoring metadata) intact across a validate/serialize round-trip.
 */
export const FieldDefinitionV1Schema = z.object(fieldDefinitionV1Shape).loose();
export type FieldDefinitionV1 = z.infer<
  z.ZodObject<typeof fieldDefinitionV1Shape>
>;

/** A single field definition at schema `1.0.1` (required `exportName`). */
export const FieldDefinitionV1_0_1Schema = z
  .object(fieldDefinitionV1_0_1Shape)
  .loose();
export type FieldDefinitionV1_0_1 = z.infer<
  z.ZodObject<typeof fieldDefinitionV1_0_1Shape>
>;

/**
 * Canonical runtime field definition (latest).
 *
 * Derived from the strict (non-loose) shape so it carries the named
 * properties without a `[k: string]: unknown` index signature. That keeps the
 * type composable with `Omit`/intersection in downstream packages (e.g. the
 * designer overriding `component-parameters`), while the schema above still
 * passes unmodelled keys through at runtime.
 */
export const FieldDefinitionSchema = FieldDefinitionV1_0_1Schema;
export type FieldDefinition = FieldDefinitionV1_0_1;

/** Compiled field definition at schema `1.0.0` — no `exportName`. */
export const CompiledFieldDefinitionV1Schema = z
  .object(compiledFieldDefinitionV1Shape)
  .loose();
export type CompiledFieldDefinitionV1 = z.infer<
  z.ZodObject<typeof compiledFieldDefinitionV1Shape>
>;

/** Compiled field definition at schema `1.0.1` (required `exportName`). */
export const CompiledFieldDefinitionV1_0_1Schema = z
  .object(compiledFieldDefinitionV1_0_1Shape)
  .loose();
export type CompiledFieldDefinitionV1_0_1 = z.infer<
  z.ZodObject<typeof compiledFieldDefinitionV1_0_1Shape>
>;

/**
 * A field definition with its conditional logic compiled into a callable
 * function. Same shape as {@link FieldDefinition} but carries the
 * non-serializable `conditionFn`, mirroring the {@link UiSpecSection} ↔
 * {@link CompiledUiSpecSection} relationship.
 */
export const CompiledFieldDefinitionSchema =
  CompiledFieldDefinitionV1_0_1Schema;
export type CompiledFieldDefinition = CompiledFieldDefinitionV1_0_1;

/** Field definitions keyed by field name (schema `1.0.0`). */
export const UiSpecFieldsV1Schema = z.record(
  z.string(),
  FieldDefinitionV1Schema
);
export type UiSpecFieldsV1 = z.infer<typeof UiSpecFieldsV1Schema>;

/** Field definitions keyed by field name (schema `1.0.1`). */
export const UiSpecFieldsV1_0_1Schema = z.record(
  z.string(),
  FieldDefinitionV1_0_1Schema
);
export type UiSpecFieldsV1_0_1 = z.infer<typeof UiSpecFieldsV1_0_1Schema>;

/** Field definitions keyed by field name. */
export const UiSpecFieldsSchema = UiSpecFieldsV1_0_1Schema;
export type UiSpecFields = UiSpecFieldsV1_0_1;

/** Compiled field definitions keyed by field name (schema `1.0.0`). */
export const CompiledUiSpecFieldsV1Schema = z.record(
  z.string(),
  CompiledFieldDefinitionV1Schema
);
export type CompiledUiSpecFieldsV1 = z.infer<
  typeof CompiledUiSpecFieldsV1Schema
>;

/** Compiled field definitions keyed by field name (schema `1.0.1`). */
export const CompiledUiSpecFieldsV1_0_1Schema = z.record(
  z.string(),
  CompiledFieldDefinitionV1_0_1Schema
);
export type CompiledUiSpecFieldsV1_0_1 = z.infer<
  typeof CompiledUiSpecFieldsV1_0_1Schema
>;

/** Compiled field definitions keyed by field name. */
export const CompiledUiSpecFieldsSchema = CompiledUiSpecFieldsV1_0_1Schema;
export type CompiledUiSpecFields = CompiledUiSpecFieldsV1_0_1;

/** Relation kind for RelatedRecordSelector `component-parameters.relation_type`. */
export const relatedTypeSchema = z.enum([
  'faims-core::Child',
  'faims-core::Linked',
]);
export type RelatedType = z.infer<typeof relatedTypeSchema>;

/** Component type whose field values hold forward links to related records. */
export const RELATED_RECORD_SELECTOR = {
  namespace: 'faims-custom',
  name: 'RelatedRecordSelector',
} as const;

/**
 * RelatedRecordSelector-specific `component-parameters` (excludes shared base field
 * props such as `label` and `name`, which are merged in by the forms package).
 */
export const relatedRecordSelectorComponentParamsSchema = z
  .object({
    related_type: z.string(),
    relation_type: relatedTypeSchema,
    multiple: z.boolean().optional().default(false),
    allowLinkToExisting: z.boolean().optional().default(false),
    hideCreateAnotherButton: z.boolean().optional().default(false),
  })
  .loose();

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
  .loose();
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
  .loose();
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

const uiSpecModelBaseShape = {
  // TODO Rename to sections
  views: UiSpecSectionsSchema,
  // TODO Rename to forms
  viewsets: UiSpecFormsSchema,
  visible_types: z.array(z.string()),
};

/** UI spec body at schema `1.0.0` (fields have no `exportName`). */
export const UiSpecModelV1Schema = z
  .object({
    fields: UiSpecFieldsV1Schema,
    ...uiSpecModelBaseShape,
  })
  .loose();
export type UiSpecModelV1 = z.infer<typeof UiSpecModelV1Schema>;

/** UI spec body at schema `1.0.1` (fields require `exportName`). */
export const UiSpecModelV1_0_1Schema = z
  .object({
    fields: UiSpecFieldsV1_0_1Schema,
    ...uiSpecModelBaseShape,
  })
  .loose();
export type UiSpecModelV1_0_1 = z.infer<typeof UiSpecModelV1_0_1Schema>;

/** The full UI specification model. */
export const UiSpecModelSchema = UiSpecModelV1_0_1Schema;
export type UiSpecModel = UiSpecModelV1_0_1;

/** Compiled UI spec body at schema `1.0.0`. */
export const CompiledUiSpecModelV1Schema = z
  .object({
    fields: CompiledUiSpecFieldsV1Schema,
    ...uiSpecModelBaseShape,
    views: CompiledUiSpecSectionsSchema,
  })
  .loose();
export type CompiledUiSpecModelV1 = z.infer<typeof CompiledUiSpecModelV1Schema>;

/** Compiled UI spec body at schema `1.0.1`. */
export const CompiledUiSpecModelV1_0_1Schema = z
  .object({
    fields: CompiledUiSpecFieldsV1_0_1Schema,
    ...uiSpecModelBaseShape,
    views: CompiledUiSpecSectionsSchema,
  })
  .loose();
export type CompiledUiSpecModelV1_0_1 = z.infer<
  typeof CompiledUiSpecModelV1_0_1Schema
>;

/**
 * A {@link UiSpecModel} with views compiled (conditions turned into functions).
 */
export const CompiledUiSpecModelSchema = CompiledUiSpecModelV1_0_1Schema;
export type CompiledUiSpecModel = CompiledUiSpecModelV1_0_1;

// ============================================================================
// Notebook schemas (zod)
//
// Runtime-validated schemas and their inferred types for a notebook definition:
// the UI spec, its functional settings, and non-functional design metadata.
//
// Versioning convention (same as `projectsDB/types.ts` / `templatesDB/types.ts`):
// each notebook JSON schema *shape* gets a block named after
// `uiSpec.schemaVersion` (`V1` = `1.0.0`, `V1_0_1` = `1.0.1`, …) with paired
// `<Name>V…Schema` + `z.infer` type. Unversioned names at the bottom
// ("Current exports") alias the latest block. The deprecated two-part
// `1.0`…`7.0` ladder has no Zod blocks here — it is collapsed by
// `notebookMigrations/steps/legacyToV1.ts`.
//
// Adding a shape change: add a `V<semver>` block (extend/omit/alias from the
// previous), add a harness step `<prev> → <next>` in
// `notebookMigrations/registry.ts`, then re-point the current aliases.
// ============================================================================

// =============
// V1 Definition (schemaVersion 1.0.0)
// =============

/** UI behaviour toggles (V1). */
export const NotebookSettingsV1Schema = z.object({
  /** When true, show “search by QR” on the record list for this survey. */
  showQrCodeButton: z.boolean(),
  /**
   * Markdown headed over the plan buttons, where a notebook offers a choice of
   * plan. Absent, the chooser heads itself.
   */
  planChooserMarkdown: z.string().optional(),
});
export type NotebookSettingsV1 = z.infer<typeof NotebookSettingsV1Schema>;

/** Non-functional **design** documentation bundled with the form definition (V1). */
export const NotebookInformationV1Schema = z.object({
  /**
   * Author-managed version label for the form design (free text). This is
   * **not** the platform `schemaVersion` and is never used for compatibility.
   */
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
export type NotebookInformationV1 = z.infer<typeof NotebookInformationV1Schema>;

/** Typed design metadata plus optional org extensions (V1). */
export const NotebookMetadataV1Schema = z.object({
  /** Non-functional information about the notebook. */
  information: NotebookInformationV1Schema,
  /** Optional key/value bag for org-specific tagging; not for settings or user ids. */
  custom: z.record(z.string(), z.any()).optional(),
});
export type NotebookMetadataV1 = z.infer<typeof NotebookMetadataV1Schema>;

/**
 * Inlined merge of the former notebook JSON and metadata DB (V1 / `1.0.0`).
 * Fields do not yet require `exportName`.
 *
 * Built as one object (not `.and()`) so Zod does not infer a circular
 * intersection type that collapses to `any`.
 */
export const NotebookUiSpecV1Schema = z
  .object({
    fields: UiSpecFieldsV1Schema,
    ...uiSpecModelBaseShape,
    settings: NotebookSettingsV1Schema,
    schemaVersion: NotebookSchemaSemverSchema,
  })
  .loose();
export type NotebookUiSpecV1 = z.infer<typeof NotebookUiSpecV1Schema>;

/**
 * Compiled counterpart of {@link NotebookUiSpecV1}: same shape but with sections
 * compiled (conditions turned into `conditionFn`s), as per
 * {@link CompiledUiSpecModelSchema}.
 */
export const CompiledNotebookUiSpecV1Schema = z
  .object({
    fields: CompiledUiSpecFieldsV1Schema,
    ...uiSpecModelBaseShape,
    views: CompiledUiSpecSectionsSchema,
    settings: NotebookSettingsV1Schema,
    schemaVersion: NotebookSchemaSemverSchema,
  })
  .loose();
export type CompiledNotebookUiSpecV1 = z.infer<
  typeof CompiledNotebookUiSpecV1Schema
>;

/*
 * A template is a notebook definition that will be used to instantiate many notebooks.
 * It has the same uiSpec and metadata as a notebook but includes optional plan templates,
 * one per plan, each instantiated when a notebook is created from the template.
 */
export const TemplateDefinitionV1Schema = z.object({
  uiSpec: NotebookUiSpecV1Schema,
  metadata: NotebookMetadataV1Schema,
  /** One per plan the template offers, each with its own `planId`. */
  planTemplates: z.array(PlanTemplateSchema).optional(),
});
export type TemplateDefinitionV1 = z.infer<typeof TemplateDefinitionV1Schema>;

/*
 * Notebook definition is what is stored in the DB and downloaded/uploaded as JSON.
 *
 * Todo: plans are attached to both templates and notebooks since they currently share the
 * same type but our intention is that templates will have a plan 'schema' while the notebook
 * has the actual plans. This means we probably want to split the NotebookDefinition type in two
 * at some point. Until we work out how to do this we can use the plan slot in the template for
 * the schema.
 */
export const NotebookDefinitionV1Schema = z.object({
  uiSpec: NotebookUiSpecV1Schema,
  metadata: NotebookMetadataV1Schema,
  /** The notebook's plans, each addressed by its own `planId`. */
  plans: z.array(RegisteredPlanSchema).optional(),
});
export type NotebookDefinitionV1 = z.infer<typeof NotebookDefinitionV1Schema>;

/**
 * Compiled counterpart of {@link NotebookDefinitionV1}: identical shape but with a
 * compiled {@link CompiledNotebookUiSpecV1} in place of the plain `uiSpec`.
 */
export const CompiledNotebookDefinitionV1Schema = z.object({
  uiSpec: CompiledNotebookUiSpecV1Schema,
  metadata: NotebookMetadataV1Schema,
  plans: z.array(RegisteredPlanSchema).optional(),
});
export type CompiledNotebookDefinitionV1 = z.infer<
  typeof CompiledNotebookDefinitionV1Schema
>;

// =============
// V1_0_1 Definition (schemaVersion 1.0.1 — required exportName)
// =============
//
// Unchanged envelopes alias V1. Only field-bearing models are new.

/** Alias of {@link NotebookSettingsV1Schema} (unchanged in `1.0.1`). */
export const NotebookSettingsV1_0_1Schema = NotebookSettingsV1Schema;
export type NotebookSettingsV1_0_1 = NotebookSettingsV1;

/** Alias of {@link NotebookInformationV1Schema} (unchanged in `1.0.1`). */
export const NotebookInformationV1_0_1Schema = NotebookInformationV1Schema;
export type NotebookInformationV1_0_1 = NotebookInformationV1;

/** Alias of {@link NotebookMetadataV1Schema} (unchanged in `1.0.1`). */
export const NotebookMetadataV1_0_1Schema = NotebookMetadataV1Schema;
export type NotebookMetadataV1_0_1 = NotebookMetadataV1;

/** Notebook UI spec at schema `1.0.1` — fields require `exportName`. */
export const NotebookUiSpecV1_0_1Schema = z
  .object({
    fields: UiSpecFieldsV1_0_1Schema,
    ...uiSpecModelBaseShape,
    settings: NotebookSettingsV1_0_1Schema,
    schemaVersion: NotebookSchemaSemverSchema,
  })
  .loose();
export type NotebookUiSpecV1_0_1 = z.infer<typeof NotebookUiSpecV1_0_1Schema>;

/**
 * Compiled counterpart of {@link NotebookUiSpecV1_0_1}: same shape but with
 * sections compiled (conditions turned into `conditionFn`s).
 */
export const CompiledNotebookUiSpecV1_0_1Schema = z
  .object({
    fields: CompiledUiSpecFieldsV1_0_1Schema,
    ...uiSpecModelBaseShape,
    views: CompiledUiSpecSectionsSchema,
    settings: NotebookSettingsV1_0_1Schema,
    schemaVersion: NotebookSchemaSemverSchema,
  })
  .loose();
export type CompiledNotebookUiSpecV1_0_1 = z.infer<
  typeof CompiledNotebookUiSpecV1_0_1Schema
>;

/** Template definition at schema `1.0.1` (required field `exportName`). */
export const TemplateDefinitionV1_0_1Schema = z.object({
  uiSpec: NotebookUiSpecV1_0_1Schema,
  metadata: NotebookMetadataV1_0_1Schema,
  planTemplates: z.array(PlanTemplateSchema).optional(),
});
export type TemplateDefinitionV1_0_1 = z.infer<
  typeof TemplateDefinitionV1_0_1Schema
>;

/** Notebook definition at schema `1.0.1` (required field `exportName`). */
export const NotebookDefinitionV1_0_1Schema = z.object({
  uiSpec: NotebookUiSpecV1_0_1Schema,
  metadata: NotebookMetadataV1_0_1Schema,
  plans: z.array(RegisteredPlanSchema).optional(),
});
export type NotebookDefinitionV1_0_1 = z.infer<
  typeof NotebookDefinitionV1_0_1Schema
>;

/**
 * Compiled counterpart of {@link NotebookDefinitionV1_0_1}: identical shape but
 * with a compiled {@link CompiledNotebookUiSpecV1_0_1} in place of the plain `uiSpec`.
 */
export const CompiledNotebookDefinitionV1_0_1Schema = z.object({
  uiSpec: CompiledNotebookUiSpecV1_0_1Schema,
  metadata: NotebookMetadataV1_0_1Schema,
  plans: z.array(RegisteredPlanSchema).optional(),
});
export type CompiledNotebookDefinitionV1_0_1 = z.infer<
  typeof CompiledNotebookDefinitionV1_0_1Schema
>;

// =============
// Current exports
// =============
//
// Unversioned names alias the latest block (`V1_0_1` / schema `1.0.1`).

export const NotebookSettingsSchema = NotebookSettingsV1_0_1Schema;
export type NotebookSettings = NotebookSettingsV1_0_1;

export const NotebookInformationSchema = NotebookInformationV1_0_1Schema;
export type NotebookInformation = NotebookInformationV1_0_1;

export const NotebookMetadataSchema = NotebookMetadataV1_0_1Schema;
export type NotebookMetadata = NotebookMetadataV1_0_1;

export const NotebookUiSpecSchema = NotebookUiSpecV1_0_1Schema;
export type NotebookUiSpec = NotebookUiSpecV1_0_1;

export const CompiledNotebookUiSpecSchema = CompiledNotebookUiSpecV1_0_1Schema;
export type CompiledNotebookUiSpec = CompiledNotebookUiSpecV1_0_1;

export const TemplateDefinitionSchema = TemplateDefinitionV1_0_1Schema;
export type TemplateDefinition = TemplateDefinitionV1_0_1;

export const NotebookDefinitionSchema = NotebookDefinitionV1_0_1Schema;
export type NotebookDefinition = NotebookDefinitionV1_0_1;

export const CompiledNotebookDefinitionSchema =
  CompiledNotebookDefinitionV1_0_1Schema;
export type CompiledNotebookDefinition = CompiledNotebookDefinitionV1_0_1;

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
