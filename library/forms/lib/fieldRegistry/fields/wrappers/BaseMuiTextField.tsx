import {TextField as MuiTextField, TextFieldProps} from '@mui/material';
import React from 'react';
import {BaseFieldProps, FormFieldContextProps} from '../../../formModule/types';
import FieldWrapper from './FieldWrapper';

/**
 * Extended props for the base MUI text field component.
 * These allow customization of the underlying MUI TextField behavior.
 */
export interface BaseMuiTextFieldConfig {
  /** Whether to render as multiline textarea */
  multiline?: boolean;
  /** Number of rows for multiline (used as minRows) */
  rows?: number;
  /** HTML input type (text, email, number, etc.) */
  inputType?: string;
  /** Additional MUI TextField props to pass through */
  muiProps?: Partial<TextFieldProps>;
}

export type BaseMuiTextFieldProps = BaseFieldProps &
  FormFieldContextProps &
  BaseMuiTextFieldConfig;

/**
 * Base MUI TextField component that can be configured for various text input types.
 * This component handles:
 * - Single-line text input
 * - Multiline text areas
 * - Email inputs
 * - Other text-based inputs via inputType
 *
 * It wraps MUI's TextField with our standard FieldWrapper for consistent styling.
 */
export const BaseMuiTextField: React.FC<BaseMuiTextFieldProps> = props => {
  const {
    // Field context props
    state,
    setFieldData,
    handleBlur,
    // Base field props
    label,
    helperText,
    required,
    advancedHelperText,
    disabled,
    // Configuration props
    multiline = false,
    rows,
    inputType = 'text',
    muiProps = {},
  } = props;

  const value = (state.value?.data as string) || '';
  const errors = state.meta.errors as unknown as string[];

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFieldData(event.target.value);
  };

  return (
    <FieldWrapper
      heading={label}
      subheading={helperText}
      required={required}
      advancedHelperText={advancedHelperText}
      errors={errors}
    >
      <MuiTextField
        value={value}
        fullWidth
        onChange={onChange}
        onBlur={handleBlur}
        variant="outlined"
        disabled={disabled}
        multiline={multiline}
        minRows={rows}
        type={inputType}
        {...muiProps}
      />
    </FieldWrapper>
  );
};

export default BaseMuiTextField;
