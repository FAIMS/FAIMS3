import {TextField as MuiTextField} from '@mui/material';
import FieldWrapper from '../../FieldWrapper';
import {BaseFieldProps, FieldInfo} from '../../../types';
import {useState} from 'react';
import {useFormField} from '../../FormManager/FormContext';
import React from 'react';

const TextField = React.memo((props: BaseFieldProps) => {
  console.log('TextField:', props.name);

  const {value, setValue} = useFormField(props.name);
  const [currentValue, setCurrentValue] = useState(value || '');

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setCurrentValue(newValue);
    setValue(newValue);
  };

  return (
    <FieldWrapper
      heading={props.label}
      required={props.required}
      advancedHelperText={props.advancedHelperText}
    >
      <MuiTextField
        value={currentValue}
        fullWidth
        onChange={onChange}
        variant="outlined"
      />
    </FieldWrapper>
  );
});

const validateTextField = (value: any) => {
  return true;
};

// Export a constant with the information required to
// register this field type
export const textFieldSpec: FieldInfo = {
  namespace: 'formik-material-ui',
  name: 'TextField',
  returns: 'faims-core::String',
  component: TextField,
  validator: validateTextField,
};
