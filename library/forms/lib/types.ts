import React from 'react';
import {z} from 'zod';

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
  field: z.any(), // would like to use the tanstack field type but it's too complex
  label: z.string().optional(),
  name: z.string(),
  helperText: z.string().optional(),
  required: z.boolean().optional(),
  advancedHelperText: z.string().optional(),
  disabled: z.boolean().optional(),
});
export type BaseFieldProps = z.infer<typeof BaseFieldPropsSchema>;

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
