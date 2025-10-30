import React from 'react';

// Field properties common to all fields
export interface BaseFieldProps {
  label?: string;
  name: string;
  value?: any;
  setValue: (value: any) => void;
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
