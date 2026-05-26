import {
  relatedRecordFieldAvpEntrySchema,
  relatedRecordSelectorComponentParamsSchema,
} from '@faims3/data-model';
import z from 'zod';
import {FullFormManagerConfig} from '../../../formModule/formManagers/types';
import {
  BaseFieldPropsSchema,
  FormFieldContextProps,
} from '../../../formModule/types';

// ============================================================================
// Component Specific Types & Schemas
// ============================================================================
export const relatedRecordPropsSchema = BaseFieldPropsSchema.merge(
  relatedRecordSelectorComponentParamsSchema
);

export type RelatedRecordFieldProps = z.infer<typeof relatedRecordPropsSchema>;
export type RelatedRecordProps = RelatedRecordFieldProps &
  FormFieldContextProps;

export interface FullRelatedRecordFieldProps extends RelatedRecordProps {
  config: FullFormManagerConfig;
}

/** Form validation: vocabulary pair must be a full pair (stricter than AVP/storage). */
export const fieldValueEntrySchema = relatedRecordFieldAvpEntrySchema.extend({
  relation_type_vocabPair: z.tuple([z.string(), z.string()]),
});

export const relatedFieldValueSchema = z.union([
  z.array(fieldValueEntrySchema),
  fieldValueEntrySchema,
]);
export type RelatedFieldValue = z.infer<typeof relatedFieldValueSchema>;
export type FieldValueEntry = z.infer<typeof fieldValueEntrySchema>;
