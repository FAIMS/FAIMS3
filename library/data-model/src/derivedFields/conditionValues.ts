// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: conditionValues.ts
 * Description:
 *   Builds the values object that field and section conditions evaluate
 *   against: the form's own values plus raw parent record, related record and
 *   notebook metadata values under their reference keys (_PARENT.<Field-ID>,
 *   <Rel-Field-ID>.<Field-ID> and _METADATA.<key>).
 */

import {ValuesObject} from '../uiSpecification';
import {encodeParentRef} from '../uiSpecification/parentReferences';
import {encodeRelatedRef} from '../uiSpecification/relatedForms';
import {RecordContext} from './recordContext';
import {encodeMetadataRef} from '../uiSpecification/metadataReferences';

/**
 * Merges parent record, related record and notebook metadata values from the
 * record context into the form values, keyed as condition references. Values are raw (no coercion),
 * so conditions treat them exactly as local field values: a field absent
 * from the parent or linked record is absent from the result, giving each
 * operator its usual missing-field behaviour. Local field IDs cannot contain
 * dots and the _PARENT. and _METADATA. prefixes are reserved, so keys cannot collide.
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
  if (context?.metadataValues) {
    for (const key of Object.keys(context.metadataValues)) {
      merged[encodeMetadataRef(key)] = context.metadataValues[key];
    }
  }
  return merged;
}
