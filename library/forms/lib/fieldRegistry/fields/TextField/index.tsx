import {TextField as MuiTextField} from '@mui/material';
import React from 'react';
import z from 'zod';
import FieldWrapper from '../wrappers/FieldWrapper';
import {
  BaseFieldProps,
  FormFieldContextProps,
  BaseFieldPropsSchema,
} from '../../../formModule/types';
import {FieldInfo} from '../../types';

const TextField = (props: BaseFieldProps & FormFieldContextProps) => {
  const value = (props.state.value?.data as string) || '';

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    props.setFieldData(event.target.value);
  };

  return (
    <FieldWrapper
      heading={props.label}
      required={props.required}
      advancedHelperText={props.advancedHelperText}
      // This typing is not coming through - these are always strings - no
      // strings = no errors
      errors={props.state.meta.errors as unknown as string[]}
    >
      <MuiTextField
        value={value}
        fullWidth
        onChange={onChange}
        onBlur={props.handleBlur}
        variant="outlined"
      />
    </FieldWrapper>
  );
};

// generate a zod schema for the value. In this case, it's always a string
const valueSchema = () => {
  return z.string().min(1);
};

// Export a constant with the information required to
// register this field type
export const textFieldSpec: FieldInfo = {
  namespace: 'faims-custom',
  name: 'FAIMSTextField',
  returns: 'faims-core::String',
  component: TextField,
  fieldPropsSchema: BaseFieldPropsSchema,
  fieldDataSchemaFunction: valueSchema,
};
