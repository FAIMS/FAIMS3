/**
 * Simple wrapper of input base field for text
 */

import {FieldProps} from 'formik';
import {ReactNode} from 'react';
import {InputBaseWrapper} from './InputFieldBase';

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
  return <InputBaseWrapper {...props} type={'text'} />;
};
