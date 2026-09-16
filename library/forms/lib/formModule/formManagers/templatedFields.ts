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
 * Filename: templatedFields.ts
 * Description:
 *   Form bindings for templated string evaluation. The evaluation lives in
 *   @faims3/data-model so it can run in the app and server-side alike; this
 *   module binds it to the field registry and the tanstack form.
 */

import {
  recomputeDerivedFields as recomputeDerivedFieldsCore,
  RecordContext,
  TemplateFunctionLookup,
  UiSpecModel,
  ValuesObject,
} from '@faims3/data-model';
import {getFieldInfo} from '../../fieldRegistry/registry';
import {formDataExtractor} from '../../utils';
import {FaimsForm} from '../types';

// Template functions resolve through the field registry. Registry entries
// reference functions defined in data-model's builtin map, keeping client and
// server evaluation identical.
const registryTemplateFunctionLookup: TemplateFunctionLookup = ({
  namespace,
  name,
}) => getFieldInfo({namespace, name}).fieldInfo.templateFunction;

/**
 * Recomputes templated string values for the given form; see the core in
 * @faims3/data-model. Bound to the field registry lookup.
 */
export function recomputeDerivedFields(args: {
  values: ValuesObject;
  uiSpecification: UiSpecModel;
  formId: string;
  context: RecordContext;
}): {changes: boolean; updates: Record<string, string>} {
  return recomputeDerivedFieldsCore({
    ...args,
    getTemplateFunction: registryTemplateFunctionLookup,
  });
}

/**
 * Wrapper for the template field logic. This provides convenient form-ready on
 * change entrypoint.
 * @param form The tanstack form
 * @param formId The target form ID to update
 * @param uiSpec The decoded UI spec
 * @param context A special context object which includes injectable context
 * @param runListeners Should we allow tanstack to fire listeners for the direct
 * field update?
 * @returns True iff a change was detected
 */
export function onChangeTemplatedFields({
  form,
  uiSpec,
  formId,
  context,
  runListeners,
}: {
  form: FaimsForm;
  formId: string;
  uiSpec: UiSpecModel;
  context: RecordContext;
  runListeners: boolean;
}): boolean {
  const data = formDataExtractor({fullData: form.state.values});
  const {changes, updates} = recomputeDerivedFields({
    context,
    formId,
    uiSpecification: uiSpec,
    values: data,
  });

  for (const [k, v] of Object.entries(updates)) {
    // Update just the data field
    form.setFieldValue(
      k,
      {...(form.state.values[k] ?? {}), data: v},
      // The form can determine whether to run listeners or not
      {dontRunListeners: !runListeners}
    );
  }

  return changes;
}
