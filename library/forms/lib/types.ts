import React from 'react';

// Type describing the description of a field in the UISpec
export interface EncodedFieldSpecification {
  'component-namespace': string;
  'component-name': string;
  'component-parameters': {[key: string]: any};
  initialValue: any;
  persistent: boolean;
  displayParent: boolean;
  meta: {
    annotation: {include: boolean; label: string};
    uncertainty: {include: boolean; label: string};
  };
}

// Field properties common to all fields
export interface BaseFieldProps {
  label?: string;
  name: string;
  helperText?: string;
  required?: boolean;
  advancedHelperText?: string;
}

export type FieldReturnType = 'faims-core::String' | 'faims-core::Number';

export interface FieldInfo {
  namespace: string;
  name: string;
  returns: FieldReturnType | null;
  component: React.FC<any>;
  validator: (value: any) => boolean;
}
