// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: computedFields.ts
 * Description:
 *   Form bindings for computed field evaluation. The evaluation lives in
 *   @faims3/data-model so it can run in the app and server-side alike; this
 *   module binds it to the tanstack form.
 */

import {
  recomputeComputedFields,
  RecordContext,
  CompiledUiSpecModel,
} from '@faims3/data-model';
import {formDataExtractor} from '../../utils';
import {FaimsForm} from '../types';

/**
 * Form-ready onChange entrypoint for computed fields. Recomputes and writes
 * back any changed values.
 *
 * @param form The tanstack form
 * @param formId The target form ID to update
 * @param uiSpec The compiled UI spec
 * @param context Record context, carrying parent values if resolved
 * @param runListeners Whether tanstack should fire listeners for the update
 * @returns True iff a change was detected
 */
export function onChangeComputedFields({
  form,
  uiSpec,
  formId,
  context,
  runListeners,
}: {
  form: FaimsForm;
  formId: string;
  uiSpec: CompiledUiSpecModel;
  context?: RecordContext;
  runListeners: boolean;
}): boolean {
  const data = formDataExtractor({fullData: form.state.values});
  const {changes, updates} = recomputeComputedFields({
    formId,
    uiSpecification: uiSpec,
    values: data,
    context,
  });

  for (const [k, v] of Object.entries(updates)) {
    form.setFieldValue(
      k,
      {...(form.state.values[k] ?? {}), data: v},
      {dontRunListeners: !runListeners}
    );
  }

  return changes;
}
