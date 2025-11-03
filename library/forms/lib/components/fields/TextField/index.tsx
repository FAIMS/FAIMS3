import {TextField as MuiTextField} from '@mui/material';
import FieldWrapper from '../../FieldWrapper';
import {BaseFieldProps, BaseFieldPropsSchema, FieldInfo} from '../../../types';
import {useFormField} from '../../FormManager/FormContext';
import React from 'react';
import z from 'zod';

const TextField = React.memo((props: BaseFieldProps) => {
  console.log('TextField:', props.name);

  const {value, setValue} = useFormField(props.name);

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setValue(newValue);
  };

  return (
    <FieldWrapper
      heading={props.label}
      required={props.required}
      advancedHelperText={props.advancedHelperText}
    >
      <MuiTextField
        value={value || ''}
        fullWidth
        onChange={onChange}
        variant="outlined"
      />
    </FieldWrapper>
  );
});

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
