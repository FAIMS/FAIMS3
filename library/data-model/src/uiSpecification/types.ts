import {z} from 'zod';

// ============================================================================
// Basic aliases
// ============================================================================

/** A bag of field values keyed by field name. */
export type ValuesObject = {[fieldName: string]: any};

/** Identifier for a viewset (a form type). */
export type ViewsetId = string;

/** Maps each viewset to the field used as its human-readable id (HRID). */
export type HridFieldMap = Record<ViewsetId, string | undefined>;

/** Current field values, used when evaluating conditional logic. */
export interface RecordValues {
  [field_name: string]: any;
}

// ============================================================================
// UI specification model
//
// The decoded form definition: fields, the views that group them, and the
// viewsets (form types) that group views.
// ============================================================================

/**
 * A conditional logic expression, evaluated against a record's values to decide
 * whether a view or field is shown. May nest via `conditions`.
 */
export interface ConditionalExpression {
  operator: string;
  conditions?: ConditionalExpression[];
  field?: string;
  value?: any;
}

/** Field definitions keyed by field name. */
export interface ProjectUIFields {
  [key: string]: any;
}

/** A viewset: a named form type composed of one or more views. */
export interface ProjectUIViewset {
  label?: string;
  views: string[];
  submit_label?: string;
  is_visible?: boolean;
  summary_fields?: Array<string>;
  /** Which field should be used as the HRID. */
  hridField?: string;
  /** How the viewset's views are laid out. */
  layout?: 'inline' | 'tabs';
}

/** Viewsets keyed by type. */
export interface ProjectUIViewsets {
  [type: string]: ProjectUIViewset;
}

/** A view: a named group of fields, optionally gated by conditional logic. */
export interface ProjectUiView {
  label?: string;
  fields: string[];
  uidesign?: string;
  next_label?: string;
  /** Branching logic. */
  is_logic?: {[key: string]: string[]};
  /** Conditional logic that controls visibility. */
  condition?: ConditionalExpression;
  /** Compiled form of {@link condition}; see {@link CompiledUiSpecView}. */
  conditionFn?: (v: RecordValues) => boolean;
  description?: string;
}

/**
 * A view with its conditional logic compiled into a callable function. Same
 * shape as {@link ProjectUiView} but carries the non-serializable `conditionFn`.
 */
export interface CompiledUiSpecView extends ProjectUiView {
  conditionFn?: (v: RecordValues) => boolean;
}

/** Views keyed by view name. */
export interface UiSpecViews {
  [key: string]: ProjectUiView;
}

/** Compiled views keyed by view name. */
export interface CompiledUiSpecViews {
  [key: string]: CompiledUiSpecView;
}

/** The full UI specification model. */
export interface UiSpecModel {
  fields: ProjectUIFields;
  views: UiSpecViews;
  viewsets: ProjectUIViewsets;
  visible_types: string[];
}

/**
 * A {@link UiSpecModel} with views compiled (conditions turned into functions)
 * and a record of which fields feed into conditional expressions.
 */
export interface CompiledUiSpecModel extends UiSpecModel {
  views: CompiledUiSpecViews;
  /** Field names that are referenced as conditional sources. */
  conditional_sources: Set<string>;
}

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

// TODO: define this end-to-end with zod.
export const UISpecificationSchema = z
  .custom<UiSpecModel>()
  .refine(val => !!val);
export type UISpecification = z.infer<typeof UISpecificationSchema>;

/**
 * Inlined merge of the former notebook JSON and metadata DB.
 * `uiSpec` = decoded **`ProjectUIModel`** (`fields`, `views`, `viewsets`,
 * `visible_types`) plus **`settings`** and **`schemaVersion`**.
 */
export const NotebookUiSpecSchema = UISpecificationSchema.and(
  z.object({
    /** UI functional settings. */
    settings: NotebookSettingsSchema,
    /** Drives notebook migration / compatibility. */
    schemaVersion: z.string(),
  })
);
export type NotebookUiSpec = z.infer<typeof NotebookUiSpecSchema>;

export const NotebookDefinitionSchema = z.object({
  uiSpec: NotebookUiSpecSchema,
  metadata: NotebookMetadataSchema,
});
export type NotebookDefinition = z.infer<typeof NotebookDefinitionSchema>;

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
