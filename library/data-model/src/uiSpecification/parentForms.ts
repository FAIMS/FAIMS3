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
 *   validation, and the forms runtime. Also home of the shared child-relation
 *   field scan (getChildRelationParams) that the record status report reuses,
 *   and merges the <Rel-Field-ID>.<Field-ID> references typed by
 *   relatedForms.ts into the same compile.
 */

import {
  compileComputedExpression,
  CompiledExpression,
  ExpressionError,
  ExprType,
  extractExpressionReferences,
  FAIMS_TYPE_TO_EXPR_TYPE,
} from './expressions';
import {fieldIdsForViewset, ParentScanUiSpec} from './formScan';
import {buildRelatedFieldTypes, splitRelatedReference} from './relatedForms';
import {
  FieldDefinition,
  RELATED_RECORD_SELECTOR,
  relatedRecordSelectorComponentParamsSchema,
  UiSpecModel,
} from './types';
import {
  decodeMetadataRef,
  isMetadataRef,
  METADATA_EXPR_TYPE,
  METADATA_REFERENCE_PREFIX,
} from './metadataReferences';

/** Prefix marking a reference to a field on the parent record. Reserved. */
export const PARENT_REFERENCE_PREFIX = '_PARENT.';

/** The scan reads only these keys; a malformed unrelated param (e.g. a string
 * `multiple` in a hand-edited notebook) must not hide the relation. */
const childRelationScanSchema = relatedRecordSelectorComponentParamsSchema.pick(
  {related_type: true, relation_type: true}
);

/**
 * Parses a field as a Child-relation RelatedRecordSelector, null for any other
 * field (including selectors with malformed parameters). The one definition
 * keeps parent-form inference, the record status report, and the designer's
 * ParentFieldDisplayEditor scanning for the same fields.
 */
export const getChildRelationParams = (field: FieldDefinition | undefined) => {
  if (
    !field ||
    field['component-namespace'] !== RELATED_RECORD_SELECTOR.namespace ||
    field['component-name'] !== RELATED_RECORD_SELECTOR.name
  ) {
    return null;
  }
  const params = childRelationScanSchema.safeParse(
    field['component-parameters']
  );
  return params.success && params.data.relation_type === 'faims-core::Child'
    ? params.data
    : null;
};

/**
 * Form IDs of every form that can parent the given form: those holding a
 * Child-relation RelatedRecordSelector targeting it.
 */
export const getParentFormsForForm = ({
  uiSpecification,
  formId,
}: {
  uiSpecification: ParentScanUiSpec;
  formId: string;
}): string[] => {
  const parentForms: string[] = [];
  for (const candidateId of Object.keys(uiSpecification.viewsets)) {
    if (candidateId === formId) continue;
    const isParent = fieldIdsForViewset(uiSpecification, candidateId).some(
      id =>
        getChildRelationParams(uiSpecification.fields[id])?.related_type ===
        formId
    );
    if (isParent) parentForms.push(candidateId);
  }
  return parentForms;
};

/**
 * Field IDs across every form that can parent the given form: the candidate
 * set for the designer's ParentFieldDisplay picker, composed from the same
 * scan (getParentFormsForForm, fieldIdsForViewset) the runtime infers with.
 */
export const getParentFormFieldIds = ({
  uiSpecification,
  formId,
}: {
  uiSpecification: ParentScanUiSpec;
  formId: string;
}): Set<string> => {
  const ids = new Set<string>();
  for (const parentFormId of getParentFormsForForm({uiSpecification, formId})) {
    for (const id of fieldIdsForViewset(uiSpecification, parentFormId)) {
      ids.add(id);
    }
  }
  return ids;
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
    for (const prefix of [PARENT_REFERENCE_PREFIX, METADATA_REFERENCE_PREFIX]) {
      if (id.startsWith(prefix)) {
        // Reserved prefix - a real field with this ID would be shadowed.
        throw new ExpressionError(
          `Field ID "${id}" uses the reserved prefix "${prefix}"`
        );
      }
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

  // Metadata references: _METADATA.<key> reads the notebook's custom metadata.
  // Keys are not known to the uiSpec, so any key types as string; a key the
  // notebook does not define reads as blank at runtime.
  for (const ref of extractExpressionReferences(source)) {
    if (!isMetadataRef(ref)) continue;
    if (decodeMetadataRef(ref) === null) {
      throw new ExpressionError(
        `{${ref}}: a metadata reference needs a key after "${METADATA_REFERENCE_PREFIX}"`
      );
    }
    fieldTypes.set(ref, METADATA_EXPR_TYPE);
  }

  // Related record references: <Rel-Field-ID>.<Field-ID> reads a field on the
  // record linked through a single-link Linked Related Records field on this
  // form. Targeted errors first, then merge the typed references.
  const {types: relatedTypes, relatedFields} = buildRelatedFieldTypes({
    uiSpecification,
    formId,
  });
  for (const ref of extractExpressionReferences(source)) {
    if (ref.startsWith(PARENT_REFERENCE_PREFIX)) continue;
    if (fieldTypes.has(ref) || relatedTypes.has(ref)) continue;
    const parts = splitRelatedReference(ref);
    if (!parts) continue; // plain unknown local ref: compiler reports it
    const {relFieldId, fieldId} = parts;
    const rel = relatedFields.get(relFieldId);
    if (!rel) {
      throw new ExpressionError(
        `{${ref}}: "${relFieldId}" is not a Linked Related Records field on this form`
      );
    }
    if (rel.multiple) {
      throw new ExpressionError(
        `{${ref}}: "${relFieldId}" allows multiple linked records - only ` +
          'single-link Related Records fields can be referenced'
      );
    }
    throw new ExpressionError(
      `{${ref}}: field "${fieldId}" was not found on form "${rel.relatedFormId}"`
    );
  }
  for (const [k, v] of relatedTypes) fieldTypes.set(k, v);

  return compileComputedExpression(source, fieldTypes, requiredType);
};
