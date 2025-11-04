import {useForm} from '@tanstack/react-form';
import React from 'react';
import {z} from 'zod';

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

export type FieldReturnType =
  | 'faims-attachment::Files'
  | 'faims-core::Array'
  | 'faims-core::Bool'
  | 'faims-core::Date'
  | 'faims-core::Email'
  | 'faims-core::Integer'
  | 'faims-core::JSON'
  | 'faims-core::Number'
  | 'faims-core::Relationship'
  | 'faims-core::String'
  | 'faims-pos::Location';

// FieldInfo is the information required to register a field type
// and will be provided by each field implementation
export interface FieldInfo {
  namespace: string; // Namespace of the field
  name: string; // Field name within the namespace
  returns: FieldReturnType | null; // The type returned by this field
  component: React.FC<any>; // React component implementing the field
  fieldSchema?: z.ZodTypeAny; // schema to validate the field properties
  valueSchemaFunction?: (props: any) => z.ZodTypeAny; // function to generate a schema to validate the field value based on props
}
