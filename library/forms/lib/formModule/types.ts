import {FormAnnotation, FormUpdateData} from '@faims3/data-model';
import {useForm} from '@tanstack/react-form';
import React from 'react';
import {z} from 'zod';
import {FormConfig} from './formManagers/types';

export type FaimsFormData = FormUpdateData | undefined;

// Extract the Field type from the form instance
type ExtractFieldType<T> = T extends {
  Field: React.ComponentType<infer P>;
}
  ? P extends {children: (field: infer F) => any}
    ? F
    : never
  : never;

// We don't actually use this - but it is a way to let Typescript infer the type
// we need
const myUseForm = () =>
  useForm({
    defaultValues: {} as FaimsFormData,
  });
export type FaimsForm = ReturnType<typeof myUseForm>;
export type FaimsFormField = ExtractFieldType<FaimsForm>;
export type FaimsFormFieldState = FaimsFormField['state'];

// Type describing the description of a field in the UISpec

export const FieldSpecificationMeta = z.object({
  annotation: z.object({include: z.boolean(), label: z.string()}),
  uncertainty: z.object({include: z.boolean(), label: z.string()}),
});
export type FieldSpecificationMeta = z.infer<typeof FieldSpecificationMeta>;

export const FieldSpecificationSchema = z.object({
  'component-namespace': z.string(),
  'component-name': z.string(),
  'component-parameters': z.record(z.string(), z.any()),
  initialValue: z.any(),
  persistent: z.boolean(),
  displayParent: z.boolean(),
  meta: FieldSpecificationMeta,
});
export type EncodedFieldSpecification = z.infer<
  typeof FieldSpecificationSchema
>;

// Field properties common to all fields
export const BaseFieldPropsSchema = z.object({
  label: z.string().optional(),
  name: z.string(),
  helperText: z.string().optional(),
  required: z.boolean().optional(),
  advancedHelperText: z.string().optional(),
  disabled: z.boolean().optional(),
});
export type BaseFieldProps = z.infer<typeof BaseFieldPropsSchema>;

// These are the additional FaimsForm props passed
export type FormFieldContextProps = {
  // Which field is being rendered?
  fieldId: string;
  state: FaimsFormFieldState;
  setFieldData: (value: any) => void;
  setFieldAnnotation: (value: FormAnnotation) => void;
  // Add new attachment (at start of attachment list)
  addAttachment: (params: {
    blob: Blob;
    contentType: string;
    type: 'photo' | 'file';
    fileFormat: string;
  }) => Promise<string>;
  // Delete an attachment with given ID
  removeAttachment: (params: {attachmentId: string}) => Promise<void>;
  handleBlur: () => void;
  config: FormConfig;
  /** Special behavior triggers */
  trigger: {
    /** Force a commit/save of the current record */
    commit: () => Promise<void>;
  };
};

export type FullFieldProps = BaseFieldProps & FormFieldContextProps;

export type CompletionResult = {
  progress: number;
  requiredCount: number;
  completedCount: number;
};
