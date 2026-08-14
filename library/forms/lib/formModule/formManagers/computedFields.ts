/*
 * Copyright 2026 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: computedFields.ts
 * Description:
 *   Form bindings for computed field evaluation. The evaluation lives in
 *   @faims3/data-model so it can run in the app and server-side alike; this
 *   module binds it to the tanstack form.
 */

import {
  recomputeComputedFields,
  RecordContext,
  UiSpecModel,
} from '@faims3/data-model';
import {formDataExtractor} from '../../utils';
import {FaimsForm} from '../types';

/**
 * Form-ready onChange entrypoint for computed fields. Recomputes and writes
 * back any changed values.
 *
 * @param form The tanstack form
 * @param formId The target form ID to update
 * @param uiSpec The decoded UI spec (with compiled expressions attached)
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
  uiSpec: UiSpecModel;
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
