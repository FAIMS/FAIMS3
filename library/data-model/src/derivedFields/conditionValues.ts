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
 * Filename: conditionValues.ts
 * Description:
 *   Builds the values object that field and section conditions evaluate
 *   against: the form's own values plus raw parent and related record values
 *   under their reference keys (_PARENT.<Field-ID> and
 *   <Rel-Field-ID>.<Field-ID>).
 */

import {ValuesObject} from '../uiSpecification';
import {encodeParentRef} from '../uiSpecification/parentReferences';
import {encodeRelatedRef} from '../uiSpecification/relatedForms';
import {RecordContext} from './recordContext';

/**
 * Merges parent and related record values from the record context into the
 * form values, keyed as condition references. Values are raw (no coercion),
 * so conditions treat them exactly as local field values: a field absent
 * from the parent or linked record is absent from the result, giving each
 * operator its usual missing-field behaviour. Local field IDs cannot contain
 * dots and the _PARENT. prefix is reserved, so keys cannot collide.
 */
export function buildConditionValues({
  values,
  context,
}: {
  values: ValuesObject;
  context?: RecordContext;
}): ValuesObject {
  const merged: ValuesObject = {...values};
  if (context?.parentValues) {
    for (const fieldId of Object.keys(context.parentValues)) {
      merged[encodeParentRef(fieldId)] = context.parentValues[fieldId];
    }
  }
  if (context?.relatedValues) {
    for (const relFieldId of Object.keys(context.relatedValues)) {
      const relValues = context.relatedValues[relFieldId];
      for (const fieldId of Object.keys(relValues)) {
        merged[encodeRelatedRef(relFieldId, fieldId)] = relValues[fieldId];
      }
    }
  }
  return merged;
}
