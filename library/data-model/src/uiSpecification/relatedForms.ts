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
 * Filename: relatedForms.ts
 * Description:
 *   Finds the Linked-relation Related Records fields on a form and types the
 *   <Rel-Field-ID>.<Field-ID> references usable in computed expressions and
 *   templates on that form. A reference reads a field on the record linked
 *   through a single-link (multiple: false) Linked field; the linked form is
 *   the field's related_type, so each reference has one declared type. Child
 *   relations are covered by _PARENT references and are excluded here.
 *   Shared by the compile pass, the designer's expression validation and
 *   pickers, and the forms runtime.
 */

import {ExprType, FAIMS_TYPE_TO_EXPR_TYPE} from './expressions';
import {fieldIdsForViewset, ParentScanUiSpec} from './formScan';
import {
  FieldDefinition,
  RELATED_RECORD_SELECTOR,
  relatedRecordSelectorComponentParamsSchema,
} from './types';

/** Separates the Related Records field ID from the field on the linked form. */
export const RELATED_REFERENCE_SEPARATOR = '.';

/** The scan reads only these keys; a malformed unrelated param must not hide
 * the field. `multiple` defaults to false in the schema. */
const relatedScanSchema = relatedRecordSelectorComponentParamsSchema.pick({
  related_type: true,
  relation_type: true,
  multiple: true,
});

/** Only Linked relations are referenceable; Child is the _PARENT path. */
const LINKED_RELATION = 'faims-core::Linked';

/** What a reference needs to know about a Related Records field. */
export interface RelatedFieldInfo {
  relatedFormId: string;
  multiple: boolean;
}

/**
 * Parses a field as a Linked-relation RelatedRecordSelector, null for any
 * other field (including Child selectors and selectors with malformed
 * parameters).
 */
export const getRelatedRecordParams = (
  field: FieldDefinition | undefined
): RelatedFieldInfo | null => {
  if (
    !field ||
    field['component-namespace'] !== RELATED_RECORD_SELECTOR.namespace ||
    field['component-name'] !== RELATED_RECORD_SELECTOR.name
  ) {
    return null;
  }
  const params = relatedScanSchema.safeParse(field['component-parameters']);
  return params.success && params.data.relation_type === LINKED_RELATION
    ? {relatedFormId: params.data.related_type, multiple: params.data.multiple}
    : null;
};

/**
 * Every Linked Related Records field on the given form, keyed by field ID. Callers
 * decide whether multi-link fields are usable; the compile pass reports them
 * with a targeted error rather than silently dropping them.
 */
export const getRelatedRecordFields = ({
  uiSpecification,
  formId,
}: {
  uiSpecification: ParentScanUiSpec;
  formId: string;
}): Map<string, RelatedFieldInfo> => {
  const fields = new Map<string, RelatedFieldInfo>();
  for (const id of fieldIdsForViewset(uiSpecification, formId)) {
    const info = getRelatedRecordParams(uiSpecification.fields[id]);
    if (info) fields.set(id, info);
  }
  return fields;
};

/** Encodes a related reference (<Rel-Field-ID>.<Field-ID>). */
export const encodeRelatedRef = (relFieldId: string, fieldId: string): string =>
  `${relFieldId}${RELATED_REFERENCE_SEPARATOR}${fieldId}`;

/**
 * Splits a dotted reference at its first separator into the Related Records
 * field ID and the field on the linked form. Null when there is no separator
 * or either side is empty.
 */
export const splitRelatedReference = (
  ref: string
): {relFieldId: string; fieldId: string} | null => {
  const idx = ref.indexOf(RELATED_REFERENCE_SEPARATOR);
  if (idx <= 0 || idx === ref.length - 1) return null;
  return {relFieldId: ref.slice(0, idx), fieldId: ref.slice(idx + 1)};
};

/**
 * Types every <Rel-Field-ID>.<Field-ID> reference available on a form: for
 * each single-link Related Records field, every field on its linked form
 * whose declared type maps onto an expression type. The linked record's own
 * derived fields (templated, computed) are included, since their stored
 * values are what is read.
 */
export const buildRelatedFieldTypes = ({
  uiSpecification,
  formId,
}: {
  uiSpecification: ParentScanUiSpec;
  formId: string;
}): {
  /** <Rel-Field-ID>.<Field-ID> -> expression type. */
  types: Map<string, ExprType>;
  /** All Linked Related Records fields on the form, single- and multi-link. */
  relatedFields: Map<string, RelatedFieldInfo>;
} => {
  const relatedFields = getRelatedRecordFields({uiSpecification, formId});
  const types = new Map<string, ExprType>();
  for (const [relFieldId, info] of relatedFields) {
    if (info.multiple) continue;
    for (const fieldId of fieldIdsForViewset(
      uiSpecification,
      info.relatedFormId
    )) {
      const declared = uiSpecification.fields[fieldId]?.['type-returned'];
      const exprType = FAIMS_TYPE_TO_EXPR_TYPE[declared ?? ''];
      if (exprType) {
        types.set(
          `${relFieldId}${RELATED_REFERENCE_SEPARATOR}${fieldId}`,
          exprType
        );
      }
    }
  }
  return {types, relatedFields};
};
