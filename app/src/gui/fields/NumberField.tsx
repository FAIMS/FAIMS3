import React from 'react';
import {FieldProps} from 'formik';
import TextField from '@mui/material/TextField';
import FieldWrapper from './fieldWrapper';

const NumberField: React.FC<FieldProps & any> = ({field, form, ...props}) => {
  const {label, helperText, required, min, max, step} = props;
  const error = form.touched[field.name] && Boolean(form.errors[field.name]);
  const errorMessage = error ? String(form.errors[field.name]) : helperText;

  return (
    <FieldWrapper heading={label} subheading={helperText} required={required}>
      <TextField
        {...field}
        fullWidth
        type="number"
        variant="outlined"
        error={error}
        helperText={errorMessage}
        inputProps={{
          min: min || 0,
          max: max || 100,
          step: step || 1,
          inputMode: 'numeric',
          pattern: '[0-9]*',
        }}
        onChange={e => form.setFieldValue(field.name, Number(e.target.value))}
        onBlur={() => form.setFieldTouched(field.name, true)}
      />
    </FieldWrapper>
  );
};

export default NumberField;
