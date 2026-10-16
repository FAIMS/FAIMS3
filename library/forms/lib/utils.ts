// SPDX-License-Identifier: Apache-2.0
import {ExprValue, formDataToValues} from '@faims3/data-model';
import {FaimsForm, FaimsFormData} from './formModule/types';

/** Pulls data out of faims form data */
export function formDataExtractor({
  fullData,
}: {
  fullData: FaimsFormData;
}): Record<string, unknown> {
  return formDataToValues(fullData);
}

/**
 * Writes a derived-field pass's results into form state, keeping the entry it
 * overwrites so an annotation or attachment survives.
 *
 * @param form The tanstack form
 * @param updates New values keyed by field name, as a recompute returns them
 * @param runListeners Whether tanstack should fire listeners for the update
 */
export function writeFieldUpdates({
  form,
  updates,
  runListeners,
}: {
  form: FaimsForm;
  updates: Record<string, ExprValue | null>;
  runListeners: boolean;
}): void {
  for (const [field, value] of Object.entries(updates)) {
    form.setFieldValue(
      field,
      {...(form.state.values[field] ?? {}), data: value},
      {dontRunListeners: !runListeners}
    );
  }
}

export const IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/bmp',
];
