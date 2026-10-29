// SPDX-License-Identifier: Apache-2.0
import {z} from 'zod';
import type {SetupField, SetupForm, SetupValues} from '@faims3/data-model';
import type {Field} from '@/components/form';

/** Prefix keeping setup field names clear of the form's own fields. */
const PREFIX = 'setup__';
const MULTI_SEPARATOR = '__opt__';

/**
 * Indexed RHF names so a user-edited field `name` or option label cannot
 * introduce `.` path segments (react-hook-form would nest those).
 */
const fieldFormName = (fieldIndex: number) => `${PREFIX}${fieldIndex}`;
const optionFormName = (fieldIndex: number, optionIndex: number) =>
  `${PREFIX}${fieldIndex}${MULTI_SEPARATOR}${optionIndex}`;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Zod schema for a single setup field's form input. Required fields carry
 * their own message so the error lands on the field at submit.
 */
const schemaFor = (field: SetupField): z.ZodSchema => {
  const required = {message: `${field.label} is required.`};
  const date = {message: `${field.label} must be a date.`};
  switch (field.type) {
    case 'number':
      return field.required ? z.number(required) : z.number().optional();
    case 'date':
      // min(1) first so an empty value reads as missing, not malformed
      return field.required
        ? z.string(required).min(1, required).regex(DATE_PATTERN, date)
        : z.string().regex(DATE_PATTERN, date).optional().or(z.literal(''));
    default:
      // string, longtext and select
      return field.required
        ? z.string(required).min(1, required)
        : z.string().optional();
  }
};

/**
 * Generates form Field entries for a template's setup form.
 * Multiselects expand to one checkbox per option; values are reassembled
 * by {@link collectSetupValues}.
 */
export const setupFieldsToFormFields = (form: SetupForm): Field[] =>
  form.fields.flatMap((field, fieldIndex): Field[] => {
    if (field.type === 'multiselect') {
      return (field.options ?? []).map(
        (option, optionIndex): Field => ({
          name: optionFormName(fieldIndex, optionIndex),
          // label the group once, on its first checkbox
          label: optionIndex === 0 ? field.label : undefined,
          description: optionIndex === 0 ? field.helperText : undefined,
          required: optionIndex === 0 ? field.required : undefined,
          type: 'checkbox',
          checkboxLabel: option,
          schema: z.boolean().optional(),
        })
      );
    }
    return [
      {
        name: fieldFormName(fieldIndex),
        label: field.label,
        description: field.helperText,
        required: field.required,
        schema: schemaFor(field),
        ...(field.type === 'number' ? {type: 'number'} : {}),
        ...(field.type === 'date' ? {type: 'date'} : {}),
        ...(field.type === 'longtext' ? {type: 'textarea'} : {}),
        ...(field.type === 'select'
          ? {
              options: (field.options ?? []).map(o => ({label: o, value: o})),
              ...(field.required ? {} : {clearable: true}),
            }
          : {}),
      },
    ];
  });

/**
 * Reassembles submitted form data into SetupValues: strips the name
 * prefix, folds multiselect checkboxes back into arrays, drops empties.
 */
export const collectSetupValues = (
  form: SetupForm,
  data: Record<string, unknown>
): SetupValues => {
  const values: SetupValues = {};
  for (const [fieldIndex, field] of form.fields.entries()) {
    if (field.type === 'multiselect') {
      const ticked = (field.options ?? []).filter(
        (_option, optionIndex) =>
          data[optionFormName(fieldIndex, optionIndex)] === true
      );
      if (ticked.length > 0) values[field.name] = ticked;
      continue;
    }
    const raw = data[fieldFormName(fieldIndex)];
    if (raw === undefined || raw === '' || raw === null) continue;
    values[field.name] = raw as string | number;
  }
  return values;
};

/**
 * Submit gate for required multiselects only. They expand to optional
 * checkboxes, so there is no single field to carry a validation error;
 * every other required field reports through its own schema on submit.
 *
 * Callers wrap `isBlocked` in Form's `disableSubmission` themselves; handing
 * Form a ready-made function here would feed its schema inference.
 *
 * @returns Undefined when the form has no required multiselect.
 */
export const setupSubmissionGate = (
  form: SetupForm
):
  | {isBlocked: (data: Record<string, unknown>) => boolean; reason: string}
  | undefined => {
  const required = form.fields.filter(
    f => f.type === 'multiselect' && f.required
  );
  if (required.length === 0) return undefined;
  return {
    isBlocked: data => {
      const values = collectSetupValues(form, data);
      return required.some(f => values[f.name] === undefined);
    },
    reason: `Select at least one option for: ${required.map(f => f.label).join(', ')}.`,
  };
};
