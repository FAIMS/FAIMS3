/**
 * Provides an input base which uses the field wrapper. Exposes an interface.
 * Recommend passing in type to determine type of input.
 */

import {HTMLInputTypeAttribute, ReactNode} from 'react';
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
export interface InputBaseProps extends FieldProps {
  label?: ReactNode;
  helperText?: ReactNode;
  required?: boolean;
  fullWidth?: boolean;
  advancedHelperText?: ReactNode;
  type: HTMLInputTypeAttribute;
}

export const InputBaseWrapper = (props: InputBaseProps) => {
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
        type={props.type}
      />
    </FieldWrapper>
  );
};
