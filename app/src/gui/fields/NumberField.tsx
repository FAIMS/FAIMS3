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
  const {label, helperText, advancedHelperText, required, min, max} = props;

  const error = form.touched[field.name] && Boolean(form.errors[field.name]);

  const isInvalid =
    field.value !== '' && (isNaN(field.value) || field.value === null);

  const errorMessage = isInvalid
    ? 'Error with numeric input, please enter a valid number.'
    : form.errors[field.name] || helperText;

  return (
    <FieldWrapper
      heading={label}
      subheading={helperText}
      required={required}
      advancedHelperText={advancedHelperText}
    >
      <TextField
        {...field}
        fullWidth
        disabled={props.disabled}
        type="number"
        error={error}
        helperText={error || isInvalid ? errorMessage : helperText}
        inputProps={{
          min,
          max,
        }}
        sx={{
          '& input::-webkit-inner-spin-button, & input::-webkit-outer-spin-button':
            {
              opacity: 1,
              appearance: 'auto',
              width: '10px',
              height: '20px',
              backgroundColor: '#9F9F9FFF',
              borderRadius: '4px',
              cursor: 'pointer',
              border: '2px solid #000',
              padding: '8px',
            },
        }}
        value={typeof field.value === 'number' ? field.value : ''}
        onChange={e => {
          const value = e.target.value === '' ? null : Number(e.target.value);
          form.setFieldValue(field.name, value);
        }}
        onBlur={() => form.setFieldTouched(field.name, true)}
      />
    </FieldWrapper>
  );
};

export default NumberField;
