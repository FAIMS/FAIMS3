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
 *   Computed field evaluation. Lives in @faims3/data-model so the app and
 *   server-side evaluation share one implementation; the forms library binds
 *   it to the tanstack form.
 */

import {
  CompiledUiSpecModel,
  ExprValue,
  FAIMS_TYPE_TO_EXPR_TYPE,
  decodeParentRef,
  isParentRef,
  isRelatedRef,
  splitRelatedReference,
  ValuesObject,
} from '../uiSpecification';
import {logWarn} from '../logging';
import {RecordContext} from './recordContext';
import {TEMPLATED_STRING_FIELD_NAME} from './templatedFields';
import {coerceToExprType, hasComputedValueChanged} from './valueUtils';

// Computed field components and the value type each produces.
const COMPUTED_FIELD_NAMES = ['ComputedNumber', 'ComputedText'];

// Component names whose values are themselves derived. These are excluded as
// inputs to a computed expression in this version to avoid evaluation ordering
// problems; referencing one yields a blank (incomplete) result. Note this
// applies to local fields only - parent derived fields are usable, since
// their stored values carry no ordering problem (see resolveParentRef).
const DERIVED_FIELD_NAMES = [
  ...COMPUTED_FIELD_NAMES,
  TEMPLATED_STRING_FIELD_NAME,
];

/**
 * Recomputes all computed field (ComputedNumber/ComputedText) values in the
 * given form from current values. Expressions are compiled and type checked
 * once when the notebook loads (see compileUiSpecConditionals); this reads
 * the precompiled evaluator off each field and applies it against current
 * values. Recompute-all-and-diff, matching the templated-field recompute.
 *
 * <Rel-Field-ID>.<Field-ID> references resolve from the record linked through
 * a single-link Related Records field (context.relatedValues), and
 *
 * _PARENT.<Field-ID> references resolve from the parent record's stored values
 * supplied via context.parentValues (see resolveParentValues). A referenced
 * parent value that is missing - including when the record has no parent -
 * leaves the result blank.
 *
 * @param values Current form data values
 * @param uiSpecification The compiled UI spec (see compileUiSpecConditionals)
 * @param formId The target form ID to update
 * @param context Record context, carrying parent values if resolved
 * @returns Whether anything changed, and the new values keyed by field name
 */
export function recomputeComputedFields({
  values,
  uiSpecification,
  formId,
  context,
}: {
  values: ValuesObject;
  uiSpecification: CompiledUiSpecModel;
  formId: string;
  context?: RecordContext;
}): {changes: boolean; updates: Record<string, ExprValue | null>} {
  // Fields in this form: the union of its views' field lists.
  const formFieldNames = (
    uiSpecification.viewsets[formId]?.views ?? []
  ).flatMap(viewId => uiSpecification.views[viewId]?.fields ?? []);

  // Field names in this form, the derived ones (excluded as inputs), and the
  // computed fields to evaluate (with their precompiled evaluators).
  const formFields = new Set<string>();
  const derivedFields = new Set<string>();
  const computedFields: {
    fieldName: string;
    expressionFn: (scope: Map<string, ExprValue>) => ExprValue | null;
    references: string[];
  }[] = [];

  for (const fieldName of formFieldNames) {
    formFields.add(fieldName);
    const fieldDetails = uiSpecification.fields[fieldName];
    if (!fieldDetails) {
      continue;
    }
    const componentName = fieldDetails['component-name'];

    if (DERIVED_FIELD_NAMES.includes(componentName)) {
      derivedFields.add(fieldName);
    }
    if (COMPUTED_FIELD_NAMES.includes(componentName)) {
      // Expression is compiled at notebook load and attached in place; read it
      // off the compiled field definition.
      const expressionFn = fieldDetails.expressionFn;
      const references = fieldDetails.expressionRefs;
      if (!expressionFn || !references) {
        logWarn(
          `${componentName} has no compiled expression - cannot evaluate. ` +
            'Was the UI spec compiled (compileUiSpecConditionals)?'
        );
        continue;
      }
      computedFields.push({fieldName, expressionFn, references});
    }
  }

  // Resolves a local field name to a typed value, or null when missing,
  // mistyped, or itself derived.
  const resolveField = (name: string): ExprValue | null => {
    if (derivedFields.has(name)) {
      return null;
    }
    return coerceToExprType(
      values[name],
      FAIMS_TYPE_TO_EXPR_TYPE[uiSpecification.fields[name]?.['type-returned']]
    );
  };

  // Resolves a _PARENT.<Field-ID> reference from the parent's stored values.
  // Parent derived fields ARE usable: their stored values carry no evaluation
  // ordering problem, and persist-on-save is what guarantees they exist.
  // Field IDs are globally unique in the uiSpec, so the field's type can be
  // looked up directly.
  const resolveParentRef = (ref: string): ExprValue | null => {
    const parentFieldId = decodeParentRef(ref);
    if (parentFieldId === null) {
      return null;
    }
    return coerceToExprType(
      context?.parentValues?.[parentFieldId],
      FAIMS_TYPE_TO_EXPR_TYPE[
        uiSpecification.fields[parentFieldId]?.['type-returned']
      ]
    );
  };

  // Resolves a <Rel-Field-ID>.<Field-ID> reference from the linked record's
  // stored values (see resolveRelatedValues). As with parent references, the
  // linked record's derived fields are usable and the field's type is looked
  // up directly by its globally unique ID.
  const resolveRelatedRef = (ref: string): ExprValue | null => {
    const parts = splitRelatedReference(ref);
    if (!parts) return null;
    return coerceToExprType(
      context?.relatedValues?.[parts.relFieldId]?.[parts.fieldId],
      FAIMS_TYPE_TO_EXPR_TYPE[
        uiSpecification.fields[parts.fieldId]?.['type-returned']
      ]
    );
  };

  let changes = false;
  const updates: Record<string, ExprValue | null> = {};

  for (const {fieldName, expressionFn, references} of computedFields) {
    // Build the scope from referenced symbols: parent references resolve from
    // the parent record's values, local references from fields in this form.
    // A reference with no usable value leaves the result blank; any other
    // symbol is treated as unknown.
    const scope = new Map<string, ExprValue>();
    let incomplete = false;
    for (const ref of references) {
      if (isParentRef(ref)) {
        const value = resolveParentRef(ref);
        if (value === null) {
          incomplete = true;
          break;
        }
        scope.set(ref, value);
        continue;
      }
      if (!formFields.has(ref)) {
        // Not local: a related reference resolves from linked values; any
        // other symbol is unknown and skipped.
        if (!isRelatedRef(ref)) continue;
        const value = resolveRelatedRef(ref);
        if (value === null) {
          incomplete = true;
          break;
        }
        scope.set(ref, value);
        continue;
      }
      const value = resolveField(ref);
      if (value === null) {
        incomplete = true;
        break;
      }
      scope.set(ref, value);
    }

    let result = incomplete ? null : expressionFn(scope);
    // An empty-string result displays as blank; store it as null so repeat
    // recomputes compare equal.
    if (result === '') {
      result = null;
    }

    if (hasComputedValueChanged(values[fieldName], result)) {
      updates[fieldName] = result;
      changes = true;
    }
  }

  return {changes, updates};
}
