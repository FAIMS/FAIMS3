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
 * Extended props schema for fields with speech-to-text support.
 */
const TextFieldPropsSchema = BaseFieldPropsSchema.extend({
  /** Enable speech-to-text input (default: true) */
  enableSpeech: z.boolean().optional().default(true),
  /** Whether to append speech to existing text or replace */
  speechAppendMode: z.boolean().optional(),
});

type TextFieldProps = z.infer<typeof TextFieldPropsSchema>;

/**
 * Single-line text field component with optional speech-to-text.
 * Uses the base MUI text field with default single-line configuration.
 */
const TextField: React.FC<TextFieldProps & FormFieldContextProps> = ({
  enableSpeech = true,
  speechAppendMode,
  ...props
}) => {
  return (
    <BaseMuiTextField
      {...props}
      multiline={false}
      inputType="text"
      enableSpeech={enableSpeech}
      speechAppendMode={speechAppendMode ?? false} // Single-line defaults to replace
    />
  );
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
 * Single-line text input for free-form entries with optional speech-to-text.
 */
export const textFieldSpec: FieldInfo<TextFieldProps & FormFieldContextProps> =
  {
    namespace: 'faims-custom',
    name: 'FAIMSTextField',
    returns: 'faims-core::String',
    component: TextField,
    fieldPropsSchema: TextFieldPropsSchema,
    fieldDataSchemaFunction: textFieldValueSchema,
    view: {component: DefaultRenderer, config: {}},
  };

/**
 * Extended props schema for MultilineTextField.
 * Includes configuration for the number of rows and speech support.
 */
const MultilineTextFieldPropsSchema = TextFieldPropsSchema.extend({
  InputProps: z
    .object({
      /** Number of rows to display (default: 4) */
      rows: z.number().optional().default(4),
    })
    .optional()
    .default({}),
});

type MultilineTextFieldProps = z.infer<typeof MultilineTextFieldPropsSchema>;
type MultilineTextFieldFullProps = MultilineTextFieldProps &
  FormFieldContextProps;

/**
 * Multi-line text area component for longer text entries with optional speech-to-text.
 * Uses the base MUI text field with multiline configuration.
 */
const MultilineTextField: React.FC<MultilineTextFieldFullProps> = ({
  InputProps: {rows},
  enableSpeech = true,
  speechAppendMode,
  ...baseProps
}) => {
  return (
    <BaseMuiTextField
      {...baseProps}
      multiline={true}
      rows={rows}
      enableSpeech={enableSpeech}
      speechAppendMode={speechAppendMode ?? true} // Multiline defaults to append
    />
  );
};

/**
 * Field specification for MultilineTextField.
 * Multi-line text area for longer notes and descriptions with optional speech-to-text.
 *
 * This replaces the legacy formik-material-ui::MultipleTextField
 */
export const multilineTextFieldSpec: FieldInfo<MultilineTextFieldFullProps> = {
  namespace: 'formik-material-ui',
  name: 'MultipleTextField',
  returns: 'faims-core::String',
  component: MultilineTextField,
  fieldPropsSchema: MultilineTextFieldPropsSchema,
  fieldDataSchemaFunction: textFieldValueSchema,
  view: {component: DefaultRenderer, config: {}},
};

/**
 * Email field component with built-in email validation.
 * Uses the base MUI text field with email input type.
 * Note: Speech-to-text is disabled by default for email fields as
 * dictating email addresses is typically not practical.
 */
const EmailField: React.FC<TextFieldProps & FormFieldContextProps> = ({
  enableSpeech = false, // Disabled by default for email
  speechAppendMode,
  ...props
}) => {
  return (
    <BaseMuiTextField
      {...props}
      inputType="email"
      enableSpeech={enableSpeech}
      speechAppendMode={speechAppendMode ?? false}
    />
  );
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
 * Speech-to-text is disabled by default but can be enabled if needed.
 *
 * This replaces the legacy formik-material-ui::TextField with email type.
 */
export const emailFieldSpec: FieldInfo<TextFieldProps & FormFieldContextProps> =
  {
    namespace: 'faims-custom',
    name: 'Email',
    returns: 'faims-core::String',
    component: EmailField,
    fieldPropsSchema: TextFieldPropsSchema,
    fieldDataSchemaFunction: emailValueSchema,
    view: {component: DefaultRenderer, config: {}},
  };
