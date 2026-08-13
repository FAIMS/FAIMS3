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
 * Filename: parentForms.ts
 * Description:
 *   Determines which forms can parent a given form, and types the
 *   _PARENT.<Field-ID> references usable in computed expressions on that form.
 *   Shared by the notebook-load compile pass, the designer's live expression
 *   validation, and the forms runtime.
 */

import {
  compileComputedExpression,
  CompiledExpression,
  ExpressionError,
  ExprType,
  extractExpressionReferences,
  FAIMS_TYPE_TO_EXPR_TYPE,
} from './expressions';
import {UiSpecModel} from './types';

/** Prefix marking a reference to a field on the parent record. Reserved. */
export const PARENT_REFERENCE_PREFIX = '_PARENT.';

const RELATED_RECORD_COMPONENT = 'RelatedRecordSelector';
const CHILD_RELATION = 'faims-core::Child';

/** Field IDs across all views of a viewset. Local to avoid an import cycle
 * with utils.ts, which imports this module via the compile pass. */
const fieldIdsForViewset = (
  uiSpecification: UiSpecModel,
  viewSetId: string
): string[] => {
  const viewset = uiSpecification.viewsets[viewSetId];
  if (!viewset) return [];
  const ids: string[] = [];
  for (const viewId of viewset.views) {
    ids.push(...(uiSpecification.views[viewId]?.fields ?? []));
  }
  return ids;
};

/**
 * Form IDs of every form that can parent the given form: those holding a
 * Child-relation RelatedRecordSelector targeting it. Matches the designer's
 * ParentFieldDisplay editor scan.
 */
export const getParentFormsForForm = ({
  uiSpecification,
  formId,
}: {
  uiSpecification: UiSpecModel;
  formId: string;
}): string[] => {
  const parentForms: string[] = [];
  for (const candidateId of Object.keys(uiSpecification.viewsets)) {
    if (candidateId === formId) continue;
    const isParent = fieldIdsForViewset(uiSpecification, candidateId).some(
      id => {
        const f = uiSpecification.fields[id];
        return (
          f?.['component-name'] === RELATED_RECORD_COMPONENT &&
          f['component-parameters']?.related_type === formId &&
          f['component-parameters']?.relation_type === CHILD_RELATION
        );
      }
    );
    if (isParent) parentForms.push(candidateId);
  }
  return parentForms;
};

/**
 * Types the _PARENT.<Field-ID> references available to expressions on the given
 * form. A parent field is referenceable when exactly one parent form defines
 * it, or all defining forms agree on its expression type; otherwise it is
 * recorded as ambiguous. Fields whose type does not map onto an expression
 * type are treated as a disagreement, since runtime resolution could select
 * that _PARENT.
 */
export const buildParentFieldTypes = ({
  uiSpecification,
  formId,
}: {
  uiSpecification: UiSpecModel;
  formId: string;
}): {
  /** _PARENT.<Field-ID> -> expression type, for unambiguous references. */
  types: Map<string, ExprType>;
  /** Field ID -> defining parent form IDs, for ambiguous references. */
  ambiguous: Map<string, string[]>;
  parentForms: string[];
} => {
  const parentForms = getParentFormsForForm({uiSpecification, formId});

  // Field ID -> expr type (or undefined for unmapped) per defining form.
  const seen = new Map<
    string,
    {forms: string[]; types: Set<ExprType | undefined>}
  >();
  for (const parentFormId of parentForms) {
    for (const fieldId of fieldIdsForViewset(uiSpecification, parentFormId)) {
      const declared = uiSpecification.fields[fieldId]?.['type-returned'];
      const exprType = FAIMS_TYPE_TO_EXPR_TYPE[declared ?? ''];
      const entry = seen.get(fieldId) ?? {forms: [], types: new Set()};
      entry.forms.push(parentFormId);
      entry.types.add(exprType);
      seen.set(fieldId, entry);
    }
  }

  const types = new Map<string, ExprType>();
  const ambiguous = new Map<string, string[]>();
  for (const [fieldId, entry] of seen) {
    if (entry.types.size > 1) {
      // Defensive only: field IDs are global in the uiSpec, so one ID cannot
      // carry two types. Kept in case that invariant ever changes.
      ambiguous.set(fieldId, entry.forms);
    } else {
      const [only] = entry.types;
      // Unmapped type (e.g. JSON, Relationship): not referenceable, silently
      // absent so compile reports "not found on any parent form".
      if (only !== undefined) {
        types.set(`${PARENT_REFERENCE_PREFIX}${fieldId}`, only);
      }
    }
  }
  return {types, ambiguous, parentForms};
};

/**
 * Compiles an expression for a computed field on the given form, resolving
 * _PARENT.<Field-ID> references against the form's possible parent forms.
 * Pre-checks parent references so failures produce targeted errors rather
 * than a bare "Unknown field". Local fields keep the existing behaviour.
 */
export const compileComputedExpressionForForm = ({
  source,
  uiSpecification,
  formId,
  requiredType,
}: {
  source: string;
  uiSpecification: UiSpecModel;
  formId: string;
  requiredType?: ExprType;
}): CompiledExpression => {
  const fieldTypes = new Map<string, ExprType>();
  for (const [id, f] of Object.entries(uiSpecification.fields)) {
    if (id.startsWith(PARENT_REFERENCE_PREFIX)) {
      // Reserved prefix - a real field with this ID would be shadowed.
      throw new ExpressionError(
        `Field ID "${id}" uses the reserved prefix "${PARENT_REFERENCE_PREFIX}"`
      );
    }
    const t = FAIMS_TYPE_TO_EXPR_TYPE[f['type-returned'] ?? ''];
    if (t) fieldTypes.set(id, t);
  }

  const {
    types: parentTypes,
    ambiguous,
    parentForms,
  } = buildParentFieldTypes({
    uiSpecification,
    formId,
  });

  // Targeted errors for parent references the merged map won't cover.
  for (const ref of extractExpressionReferences(source)) {
    if (!ref.startsWith(PARENT_REFERENCE_PREFIX)) continue;
    if (parentTypes.has(ref)) continue;
    const fieldId = ref.slice(PARENT_REFERENCE_PREFIX.length);
    if (parentForms.length === 0) {
      throw new ExpressionError(
        `{${ref}}: this form has no parent form, so parent references cannot be used`
      );
    }
    const forms = ambiguous.get(fieldId);
    if (forms) {
      throw new ExpressionError(
        `{${ref}}: field "${fieldId}" exists on multiple possible parent forms ` +
          `(${forms.join(', ')}) with differing types - rename one to disambiguate`
      );
    }
    throw new ExpressionError(
      `{${ref}}: field "${fieldId}" was not found on any parent form ` +
        `(${parentForms.join(', ')})`
    );
  }

  for (const [k, v] of parentTypes) fieldTypes.set(k, v);
  return compileComputedExpression(source, fieldTypes, requiredType);
};
