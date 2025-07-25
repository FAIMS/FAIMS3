import {z} from 'zod';
import {EncodedUISpecificationSchema} from '../../types';
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

// Current (V2)
// Fields
export const TemplateDBFieldsSchema = TemplateV2Schema; // v2
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

// Database
export type TemplateDB = PouchDB.Database<TemplateDBFields>;
