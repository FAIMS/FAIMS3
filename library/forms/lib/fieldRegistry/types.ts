import z from 'zod';

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
