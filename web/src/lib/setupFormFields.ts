// SPDX-License-Identifier: Apache-2.0
import {z} from 'zod';
import type {SetupField, SetupForm, SetupValues} from '@faims3/data-model';
import type {Field} from '@/components/form';

/** Prefix keeping setup field names clear of the form's own fields. */
const PREFIX = 'setup__';
const MULTI_SEPARATOR = '__opt__';

/** Zod schema for a single setup field's form input. */
const schemaFor = (field: SetupField): z.ZodSchema => {
  switch (field.type) {
    case 'number':
      return field.required
        ? z.number({message: `${field.label} must be a number.`})
        : z.number().optional();
    case 'date': {
      const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
        message: `${field.label} must be a date.`,
      });
      return field.required
        ? date.min(1, {message: `${field.label} is required.`})
        : date.optional().or(z.literal(''));
    }
    case 'select':
      return field.required
        ? z.string().min(1, {message: `${field.label} is required.`})
        : z.string().optional();
    default:
      // string and longtext
      return field.required
        ? z.string().min(1, {message: `${field.label} is required.`})
        : z.string().optional();
  }
};

/**
 * Generates form Field entries for a template's setup form.
 * Multiselects expand to one checkbox per option; values are reassembled
 * by {@link collectSetupValues}.
 */
export const setupFieldsToFormFields = (form: SetupForm): Field[] =>
  form.fields.flatMap((field): Field[] => {
    if (field.type === 'multiselect') {
      return (field.options ?? []).map(
        (option, index): Field => ({
          name: `${PREFIX}${field.name}${MULTI_SEPARATOR}${option}`,
          // label the group once, on its first checkbox
          label: index === 0 ? field.label : undefined,
          description: index === 0 ? field.helperText : undefined,
          type: 'checkbox',
          checkboxLabel: option,
          schema: z.boolean().optional(),
        })
      );
    }
    return [
      {
        name: `${PREFIX}${field.name}`,
        label: field.label,
        description: field.helperText,
        schema: schemaFor(field),
        ...(field.type === 'number' ? {type: 'number'} : {}),
        ...(field.type === 'date' ? {type: 'date'} : {}),
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
  for (const field of form.fields) {
    if (field.type === 'multiselect') {
      const ticked = (field.options ?? []).filter(
        option =>
          data[`${PREFIX}${field.name}${MULTI_SEPARATOR}${option}`] === true
      );
      if (ticked.length > 0) values[field.name] = ticked;
      continue;
    }
    const raw = data[`${PREFIX}${field.name}`];
    if (raw === undefined || raw === '' || raw === null) continue;
    values[field.name] = raw as string | number;
  }
  return values;
};
