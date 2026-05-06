import {z} from 'zod';
import {DatabaseInterface, EncodedUISpecificationSchema} from '../../types';
import {CouchDocumentSchema, CouchExistingDocumentSchema} from '../utils';

// V1
export const TemplateV1Schema = z.object({
  // Version (internally incremented upon update)
  version: z.number().min(1),
  // NOTE: For some reason importing this from ./types causes an undefined error
  // (maybe circular import issue?). Metadata for the notebook (not optional -
  // refine to enforce this)
  metadata: z.record(z.any()).refine(val => !!val),
  // UI Spec of the template
  'ui-specification': EncodedUISpecificationSchema,
  // Which team owns this (optional)
  ownedByTeamId: z.string().optional(),
});
export type TemplateV1Fields = z.infer<typeof TemplateV1Schema>;
export type TemplateV1Document = PouchDB.Core.Document<TemplateV1Fields>;

// V2
export const TemplateV2Schema = TemplateV1Schema.extend({
  // Title of the template
  name: z.string().trim().min(1),
});
export type TemplateV2Fields = z.infer<typeof TemplateV2Schema>;
export type TemplateV2Document = PouchDB.Core.Document<TemplateV2Fields>;

// V3 — archive state is a top-level flag (not metadata.project_status)
export const TemplateV3Schema = TemplateV2Schema.extend({
  archived: z.boolean().default(false),
});
export type TemplateV3Fields = z.infer<typeof TemplateV3Schema>;
export type TemplateV3Document = PouchDB.Core.Document<TemplateV3Fields>;

// V4 — template visibility for all general users when true
export const TemplateV4Schema = TemplateV3Schema.extend({
  isPublic: z.boolean().default(false),
});
export type TemplateV4Fields = z.infer<typeof TemplateV4Schema>;
export type TemplateV4Document = PouchDB.Core.Document<TemplateV4Fields>;

// Current (V4)
// Fields
export const TemplateDBFieldsSchema = TemplateV4Schema;
export type TemplateDBFields = z.infer<typeof TemplateDBFieldsSchema>;

// Document
export const TemplateDocumentSchema = CouchDocumentSchema.extend(
  TemplateDBFieldsSchema.shape
);
export type TemplateDocument = z.infer<typeof TemplateDocumentSchema>;

// Existing document
export const ExistingTemplateDocumentSchema =
  CouchExistingDocumentSchema.extend(TemplateDBFieldsSchema.shape);
export type ExistingTemplateDocument = z.infer<
  typeof ExistingTemplateDocumentSchema
>;

/** Stored template shape without the form payload (matches listing view value). */
export const TemplateListItemSchema = ExistingTemplateDocumentSchema.omit({
  'ui-specification': true,
});
export type TemplateListItem = z.infer<typeof TemplateListItemSchema>;

// Database
export type TemplateDB = DatabaseInterface<TemplateDBFields>;
