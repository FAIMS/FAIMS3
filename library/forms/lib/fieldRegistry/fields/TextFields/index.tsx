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
 * Props schema for the canonical "Text field" runtime.
 *
 * Single-line by default; set `multiline: true` (and optionally `rows`) to
 * render as a textarea. This is the unified shape used by the chooser-level
 * "Text field" with its Short / Long answer toggle.
 *
 * `InputProps.rows` is accepted for backward-compat with un-migrated notebooks
 * that came in as the legacy `formik-material-ui::MultipleTextField`. The
 * component below treats a `rows` value greater than 1 (from either source) as
 * implicit multiline. The v4 notebook migration lifts the legacy `InputProps.rows`
 * onto top-level `rows` and sets `multiline: true`, so once a notebook is
 * migrated this back-compat path is dormant.
 */
const TextFieldPropsSchema = BaseFieldPropsSchema.extend({
  /** Enable speech-to-text input (default: true) */
  enableSpeech: z.boolean().optional().default(true),
  /** Whether to append speech to existing text or replace */
  speechAppendMode: z.boolean().optional(),
  /** Render as a multiline textarea (Long answer mode). */
  multiline: z.boolean().optional(),
  /** Number of rows shown when `multiline` is true (default: 4). */
  rows: z.number().optional(),
  /**
   * Legacy `formik-material-ui::MultipleTextField` shape — `rows` nested under
   * `InputProps`. Kept optional so un-migrated notebooks still parse; the
   * component below normalises this onto the canonical top-level form.
   */
  InputProps: z.object({rows: z.number().optional()}).optional(),
});

type TextFieldProps = z.infer<typeof TextFieldPropsSchema>;

/**
 * Unified text field component with optional speech-to-text.
 *
 * Resolves multiline mode and rows from either the canonical top-level
 * `multiline`/`rows` props or the legacy nested `InputProps.rows` shape.
 * Renders single-line by default, or a multi-line textarea when either is set.
 */
const TextField: React.FC<TextFieldProps & FormFieldContextProps> = ({
  enableSpeech = true,
  speechAppendMode,
  multiline,
  rows,
  InputProps,
  ...props
}) => {
  const legacyRows = InputProps?.rows;
  const isMultiline = multiline === true || (legacyRows ?? 0) > 1;
  const effectiveRows = isMultiline ? (rows ?? legacyRows ?? 4) : undefined;

  return (
    <BaseMuiTextField
      {...props}
      multiline={isMultiline}
      rows={effectiveRows}
      inputType="text"
      enableSpeech={enableSpeech}
      // Single-line replaces by default; multiline appends.
      speechAppendMode={speechAppendMode ?? isMultiline}
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
 * Canonical "Text field" spec — `faims-custom::TextField`.
 *
 * Replaces the historical `faims-custom::FAIMSTextField` and
 * `formik-material-ui::MultipleTextField` registrations. Both legacy
 * `component-name` values are routed to this same spec via registry aliases
 * (see `LEGACY_FIELD_ALIASES` in `../../registry.ts`) so notebooks that have
 * not yet been migrated to schema v4 continue to render. Once migration is
 * confirmed-rolled-out, the aliases can be removed.
 */
export const textFieldSpec: FieldInfo<TextFieldProps & FormFieldContextProps> =
  {
    namespace: 'faims-custom',
    name: 'TextField',
    returns: 'faims-core::String',
    component: TextField,
    fieldPropsSchema: TextFieldPropsSchema,
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
