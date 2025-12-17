import React from 'react';
import z from 'zod';
import {
  BaseFieldProps,
  BaseFieldPropsSchema,
  FormFieldContextProps,
} from '../../../formModule/types';
import {DefaultRenderer} from '../../../rendering/fields/fallback';
import {FieldInfo} from '../../types';
import {BaseMuiTextField} from '../wrappers/BaseMuiTextField';

/**
 * Single-line text field component.
 * Uses the base MUI text field with default single-line configuration.
 */
const TextField: React.FC<BaseFieldProps & FormFieldContextProps> = props => {
  return <BaseMuiTextField {...props} multiline={false} inputType="text" />;
};

/**
 * Generate a Zod schema for validating the field value.
 * Adds minimum length constraint when field is required.
 */
const textFieldValueSchema = (props: BaseFieldProps) => {
  if (props.required) {
    return z.string().min(1, {message: 'This field is required'});
  }
  return z.string();
};

/**
 * Field specification for FAIMSTextField.
 * Single-line text input for free-form entries.
 */
export const textFieldSpec: FieldInfo = {
  namespace: 'faims-custom',
  name: 'FAIMSTextField',
  returns: 'faims-core::String',
  component: TextField,
  fieldPropsSchema: BaseFieldPropsSchema,
  fieldDataSchemaFunction: textFieldValueSchema,
  view: {component: DefaultRenderer, config: {}},
};

/**
 * Extended props schema for MultilineTextField.
 * Includes configuration for the number of rows.
 */
const MultilineTextFieldPropsSchema = BaseFieldPropsSchema.extend({
  /** Number of rows to display (default: 4) */
  rows: z.number().optional().default(4),
});

type MultilineTextFieldProps = z.infer<typeof MultilineTextFieldPropsSchema>;
type MultilineTextFieldFullProps = MultilineTextFieldProps &
  FormFieldContextProps;

/**
 * Multi-line text area component for longer text entries.
 * Uses the base MUI text field with multiline configuration.
 */
const MultilineTextField: React.FC<MultilineTextFieldFullProps> = props => {
  const {rows = 4, ...baseProps} = props;

  return <BaseMuiTextField {...baseProps} multiline={true} rows={rows} />;
};

/**
 * Field specification for MultilineTextField.
 * Multi-line text area for longer notes and descriptions.
 *
 * This replaces the legacy formik-material-ui::MultipleTextField
 */
export const multilineTextFieldSpec: FieldInfo<MultilineTextFieldFullProps> = {
  namespace: 'faims-custom',
  name: 'MultilineTextField',
  returns: 'faims-core::String',
  component: MultilineTextField,
  fieldPropsSchema: MultilineTextFieldPropsSchema,
  fieldDataSchemaFunction: textFieldValueSchema,
  view: {component: DefaultRenderer, config: {}},
};

/**
 * Email field component with built-in email validation.
 * Uses the base MUI text field with email input type.
 */
const EmailField: React.FC<BaseFieldProps & FormFieldContextProps> = props => {
  return <BaseMuiTextField {...props} inputType="email" />;
};

/**
 * Generate a Zod schema for validating the email field value.
 * Includes email format validation and optional required constraint.
 */
const emailValueSchema = (props: BaseFieldProps) => {
  // If not required, allow empty string
  if (!props.required) {
    // Use a union to allow either valid email or empty string
    return z.union([
      z.literal(''),
      z.string().email({message: 'Enter a valid email address'}),
    ]);
  }

  return z
    .string()
    .min(1, {message: 'This field is required'})
    .email({message: 'Enter a valid email address'});
};

/**
 * Field specification for Email.
 * Validates and captures an e-mail address.
 *
 * This replaces the legacy formik-material-ui::TextField with email type.
 */
export const emailFieldSpec: FieldInfo = {
  namespace: 'faims-custom',
  name: 'Email',
  returns: 'faims-core::String',
  component: EmailField,
  fieldPropsSchema: BaseFieldPropsSchema,
  fieldDataSchemaFunction: emailValueSchema,
  view: {component: DefaultRenderer, config: {}},
};
