import z from 'zod';
import {FullFormManagerConfig} from '../../../formModule/formManagers/types';
import {
  BaseFieldPropsSchema,
  FormFieldContextProps,
} from '../../../formModule/types';

// ============================================================================
// Component Specific Types & Schemas
// ============================================================================
export const relatedTypeSchema = z.enum([
  'faims-core::Child',
  'faims-core::Linked',
]);
export type RelatedType = z.infer<typeof relatedTypeSchema>;
export const relatedRecordPropsSchema = BaseFieldPropsSchema.extend({
  related_type: z.string(),
  relation_type: relatedTypeSchema,
  multiple: z.boolean().optional().default(false),
  allowLinkToExisting: z.boolean().optional().default(false),
  showCreateAnotherButton: z.boolean().optional().default(false),
});

export type RelatedRecordFieldProps = z.infer<typeof relatedRecordPropsSchema>;
export type RelatedRecordProps = RelatedRecordFieldProps &
  FormFieldContextProps;

export interface FullRelatedRecordFieldProps extends RelatedRecordProps {
  config: FullFormManagerConfig;
}

export const fieldValueEntrySchema = z.object({
  record_id: z.string(),
  project_id: z.string().optional(),
  relation_type_vocabPair: z.tuple([z.string(), z.string()]),
});

export const relatedFieldValueSchema = z.union([
  z.array(fieldValueEntrySchema),
  fieldValueEntrySchema,
]);
export type RelatedFieldValue = z.infer<typeof relatedFieldValueSchema>;
export type FieldValueEntry = z.infer<typeof fieldValueEntrySchema>;
