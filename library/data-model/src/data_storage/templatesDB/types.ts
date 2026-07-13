import {z} from 'zod';
import {DatabaseInterface} from '../../types';
import {PersistedRootDescriptionSchema} from '../rootMetadata';
import {CouchDocumentSchema, CouchExistingDocumentSchema} from '../utils';
import {NotebookDefinitionSchema} from '../../uiSpecification/types';

// =============
// Legacy encoded UI spec (template v1–v4, metadata DB `ui-specification`)
// =============

/**
 * Zod schema for the legacy wire-format UI specification (`fviews`, not `views`).
 *
 * Intentional duplicate of the former `EncodedUISpecificationSchema` in `types.ts`
 * — kept here so template version schemas and migrations remain self-contained when
 * application encode/decode is removed.
 */
export const LegacyEncodedUISpecificationSchema = z
  .object({
    fields: z.record(z.string(), z.any()),
    fviews: z.record(z.string(), z.any()),
    viewsets: z.record(z.string(), z.any()),
    visible_types: z.array(z.string()),
  })
  .passthrough();

export type LegacyEncodedUISpecification = z.infer<
  typeof LegacyEncodedUISpecificationSchema
>;

// =============
// V1 Definition
// =============

export const TemplateV1FieldsSchema = z.object({
  // Version (internally incremented upon update)
  version: z.number().min(1),
  // NOTE: For some reason importing this from ./types causes an undefined error
  // (maybe circular import issue?). Metadata for the notebook (not optional -
  // refine to enforce this)
  metadata: z.record(z.string(), z.any()).refine(val => !!val),
  // UI Spec of the template
  'ui-specification': LegacyEncodedUISpecificationSchema,
  // Which team owns this (optional)
  ownedByTeamId: z.string().optional(),
});
export type TemplateV1Fields = z.infer<typeof TemplateV1FieldsSchema>;

export const TemplateV1DocumentSchema = CouchDocumentSchema.extend(
  TemplateV1FieldsSchema.shape
);
export type TemplateV1Document = z.infer<typeof TemplateV1DocumentSchema>;

// =============
// V2 Definition
// =============

export const TemplateV2FieldsSchema = TemplateV1FieldsSchema.extend({
  // Title of the template
  name: z.string().trim().min(1),
});
export type TemplateV2Fields = z.infer<typeof TemplateV2FieldsSchema>;

export const TemplateV2DocumentSchema = CouchDocumentSchema.extend(
  TemplateV2FieldsSchema.shape
);
export type TemplateV2Document = z.infer<typeof TemplateV2DocumentSchema>;

// =============
// V3 Definition
// =============

/** Archive state is a top-level flag (not metadata.project_status). */
export const TemplateV3FieldsSchema = TemplateV2FieldsSchema.extend({
  archived: z.boolean().default(false),
});
export type TemplateV3Fields = z.infer<typeof TemplateV3FieldsSchema>;

export const TemplateV3DocumentSchema = CouchDocumentSchema.extend(
  TemplateV3FieldsSchema.shape
);
export type TemplateV3Document = z.infer<typeof TemplateV3DocumentSchema>;

// =============
// V4 Definition
// =============

/** Template visibility for all general users when true. */
export const TemplateV4FieldsSchema = TemplateV3FieldsSchema.extend({
  isPublic: z.boolean().default(false),
});
export type TemplateV4Fields = z.infer<typeof TemplateV4FieldsSchema>;

export const TemplateV4DocumentSchema = CouchDocumentSchema.extend(
  TemplateV4FieldsSchema.shape
);
export type TemplateV4Document = z.infer<typeof TemplateV4DocumentSchema>;

// =============
// V5 Definition
// =============

/**
 * Templates DB v5 — extend this schema when adding new persisted template fields.
 * Update alongside {@link templatesV4toV5Migration}.
 */
export const TemplateV5FieldsSchema = z.object({
  // User metadata about templates - update with PUT /:id { ...name, ...description }
  name: z.string(),
  description: PersistedRootDescriptionSchema,

  // Version (internally incremented upon update)
  version: z.number().min(1),

  // Team ownership (change via PUT /api/templates/:id/team only)
  ownedByTeamId: z.string().optional(),

  // Visibility
  isPublic: z.boolean().default(false),

  // New information about templates - tracked automatically
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),

  // Template lifecycle
  archived: z.boolean().default(false),

  // UI Specification (now stored in the project) NOTE: This is never 'encoded'
  // anymore - no more fviews etc.
  uiSpecification: NotebookDefinitionSchema,
});
export type TemplateV5Fields = z.infer<typeof TemplateV5FieldsSchema>;

export const TemplateV5DocumentSchema = CouchDocumentSchema.extend(
  TemplateV5FieldsSchema.shape
);
export type TemplateV5Document = z.infer<typeof TemplateV5DocumentSchema>;

// =============
// Current exports
// =============

export const TemplateDBFieldsSchema = TemplateV5FieldsSchema;
export type TemplateDBFields = z.infer<typeof TemplateDBFieldsSchema>;

export const TemplateDocumentSchema = TemplateV5DocumentSchema;
export type TemplateDocument = z.infer<typeof TemplateDocumentSchema>;

export const ExistingTemplateDocumentSchema =
  CouchExistingDocumentSchema.extend(TemplateDBFieldsSchema.shape);
export type ExistingTemplateDocument = z.infer<
  typeof ExistingTemplateDocumentSchema
>;

/** Stored template shape without the form payload (matches listing view value). */
export const TemplateListItemSchema = ExistingTemplateDocumentSchema.omit({
  uiSpecification: true,
});
export type TemplateListItem = z.infer<typeof TemplateListItemSchema>;

export type TemplateDB = DatabaseInterface<TemplateDBFields>;
