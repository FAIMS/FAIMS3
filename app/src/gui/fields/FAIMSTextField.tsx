/**
 * @file FAIMSTextField.tsx
 * @description A reusable MUI TextField component integrated with Formik & FieldWrapper.
 *
 * - Supports Formik's form state handling.
 * - Uses `FieldWrapper` to provide a structured layout (heading & subheading).
 * - Ensures compatibility with FAIMS field system.
 * - Handles both text and number input types dynamically.
 * - Prevents `undefined` values for better stability.
 *
 * @dependencies
 * - MUI `TextField` for input rendering.
 * - Formik's `FieldProps` for form state management.
 * - `FieldWrapper` for consistent label & help text styling.
 */

import {ReactNode} from 'react';
import {TextField as MuiTextField} from '@mui/material';
import {FieldProps} from 'formik';
import FieldWrapper from './fieldWrapper';

/**
 * @interface Props
 * @description Defines the props for `FAIMSTextField`.
 *
 * @property {ReactNode} [label] - The field label (heading).
 * @property {ReactNode} [helperText] - Helptext for user (subheading).
 * @property {boolean} [required] - Indicates if the field is mandatory.
 * @property {boolean} [fullWidth] - Determines whether the field spans full width.
 */
interface Props {
  label?: ReactNode;
  helperText?: ReactNode;
  required?: boolean;
  fullWidth?: boolean;
  advancedHelperText?: ReactNode;
}

/**
 * @component FAIMSTextField
 * @description A wrapper around MUI's `TextField` for use in FAIMS forms.
 *
 * - Automatically applies Formik state handling.
 * - Uses MUI’s `OutlinedTextFieldProps` for customization.
 * - Supports dynamic input types (text/number).
 * - Prevents passing undefined values to the field.
 *
 * @param {FieldProps & Props} props - Field & UI configuration props.
 * @returns {JSX.Element} The styled text field component.
 */
export const FAIMSTextField = (props: FieldProps & Props) => {
  const hasError =
    props.form.errors[props.field.name] && props.form.touched[props.field.name];

  return (
    <FieldWrapper
      heading={props.label}
      subheading={props.helperText}
      required={props.required}
      advancedHelperText={props.advancedHelperText}
    >
      <MuiTextField
        {...props.field}
        variant="outlined"
        fullWidth={props.fullWidth ?? true}
        required={props.required}
        value={props.field.value ?? ''} //  no undefined values
        onChange={e => {
          const newValue = e.target.value.trim() === '' ? '' : e.target.value;
          props.form.setFieldValue(props.field.name, newValue);
        }}
        error={Boolean(hasError)}
        helperText={hasError ? String(props.form.errors[props.field.name]) : ''}
      />
    </FieldWrapper>
  );
};
