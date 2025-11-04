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
  console.log('TextField:', props.name);

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    console.log('TextField onChange:', newValue);
    console.log('TextField state', props.field.state);
    props.field.handleChange(newValue);
  };

  return (
    <FieldWrapper
      heading={props.label}
      required={props.required}
      advancedHelperText={props.advancedHelperText}
    >
      <MuiTextField
        value={props.field.state.value ?? ''}
        fullWidth
        onChange={onChange}
        onBlur={props.field.handleBlur}
        variant="outlined"
      />
    </FieldWrapper>
  );
};

// generate a zod schema for the value. In this case, it's always a string
const valueSchema = () => {
  return z.string();
};

// Export a constant with the information required to
// register this field type
export const textFieldSpec: FieldInfo = {
  namespace: 'faims-custom',
  name: 'FAIMSTextField',
  returns: 'faims-core::String',
  component: TextField,
  fieldSchema: BaseFieldPropsSchema,
  valueSchemaFunction: valueSchema,
};
