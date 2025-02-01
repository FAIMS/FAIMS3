/**
 * @file NumberField.tsx
 * @description A reusable number input field for Formik forms.
 *
 * Features:
 * - Supports validation through Formik.
 * - Displays label and helper text using FieldWrapper.
 * - Handles number-only input with error handling.
 */

import React from 'react';
import {FieldProps} from 'formik';
import TextField from '@mui/material/TextField';
import FieldWrapper from './fieldWrapper';

const NumberField: React.FC<FieldProps & any> = ({field, form, ...props}) => {
  const {label, helperText, required} = props;

  const error = form.touched[field.name] && Boolean(form.errors[field.name]);
  const errorMessage = error ? String(form.errors[field.name]) : helperText;

  return (
    <FieldWrapper heading={label} subheading={helperText} required={required}>
      <TextField
        {...field}
        fullWidth
        type="number"
        error={error}
        helperText={errorMessage}
        onChange={e => form.setFieldValue(field.name, Number(e.target.value))}
        onBlur={() => form.setFieldTouched(field.name, true)}
      />
    </FieldWrapper>
  );
};

export default NumberField;
