/**
 * @file NumberField.tsx
 * @description A reusable number input field for Formik forms.
 *
 * - Supports validation through Formik (Yup schema).
 * - Allows default values to be set via `initialValue`.
 * - Displays label and helper text using FieldWrapper.
 * - Handles number-only input with error handling.
 * - Pass Min/Max values dynamically via propss
 */

import React from 'react';
import {FieldProps} from 'formik';
import TextField from '@mui/material/TextField';
import FieldWrapper from './fieldWrapper';

const NumberField: React.FC<FieldProps & any> = ({field, form, ...props}) => {
  const {label, helperText, required, min, max, defaultValue} = props;

  const isInvalid =
    field.value !== '' && (isNaN(field.value) || field.value === null);

  const error = form.touched[field.name] && Boolean(form.errors[field.name]);

  const errorMessage = isInvalid
    ? 'Error with numeric input, please enter a valid number.'
    : form.errors[field.name] || '';

  return (
    <FieldWrapper heading={label} subheading={helperText} required={required}>
      <TextField
        {...field}
        fullWidth
        type="number"
        error={error}
        helperText={errorMessage}
        inputProps={{
          min,
          max,
        }}
        value={typeof field.value === 'number' ? field.value : ''}
        defaultValue={defaultValue}
        onChange={e => {
          const value =
            e.target.value.trim() === ''
              ? required
                ? null
                : ''
              : Number(e.target.value);
          form.setFieldValue(field.name, value);
        }}
        onBlur={() => form.setFieldTouched(field.name, true)}
      />
    </FieldWrapper>
  );
};

export default NumberField;
