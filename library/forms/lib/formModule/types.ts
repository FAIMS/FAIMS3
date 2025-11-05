import {useForm} from '@tanstack/react-form';
import React from 'react';
import {z} from 'zod';

export type FaimsFormData = Record<string, any>;

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
    defaultValues: {} as Record<string, any>,
  });
export type FaimsForm = ReturnType<typeof myUseForm>;
export type FaimsFormField = ExtractFieldType<FaimsForm>;

// Type describing the description of a field in the UISpec

export const FieldSpecificationSchema = z.object({
  'component-namespace': z.string(),
  'component-name': z.string(),
  'component-parameters': z.record(z.string(), z.any()),
  initialValue: z.any(),
  persistent: z.boolean(),
  displayParent: z.boolean(),
  meta: z.object({
    annotation: z.object({include: z.boolean(), label: z.string()}),
    uncertainty: z.object({include: z.boolean(), label: z.string()}),
  }),
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
  field: FaimsFormField;
};
