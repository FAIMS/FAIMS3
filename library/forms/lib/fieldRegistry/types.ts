import z from 'zod';
import {FullFieldProps} from '../formModule/types';
import {DataViewFieldRegistryEntry} from '../rendering';

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

export interface FieldInfo<T extends FullFieldProps = FullFieldProps> {
  namespace: string; // Namespace of the field
  name: string; // Field name within the namespace
  returns: FieldReturnType | null; // The type returned by this field
  component: React.ComponentType<T & Record<string, unknown>>;
  // The view entry
  view: DataViewFieldRegistryEntry;

  // validation
  fieldPropsSchema?: z.ZodTypeAny; // schema to validate the field properties
  fieldDataSchemaFunction?: (props: any) => z.ZodTypeAny; // function to generate a schema to validate the field value based on props
}
