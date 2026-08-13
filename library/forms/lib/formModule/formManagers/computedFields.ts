import {
  CompiledFieldDefinition,
  ExprValue,
  FAIMS_TYPE_TO_EXPR_TYPE,
  getFieldToIdsMap,
  UiSpecModel,
  ValuesObject,
} from '@faims3/data-model';
import {formDataExtractor} from '../../utils';
import {logWarn} from '../../logging';
import {FaimsForm} from '../types';

const TEMPLATED_STRING_FIELD_NAME = 'TemplatedStringField';

// Computed field components and the value type each produces.
const COMPUTED_FIELD_NAMES = ['ComputedNumber', 'ComputedText'];

// Component names whose values are themselves derived. These are excluded as
// inputs to a computed expression in this version to avoid evaluation ordering
// problems; referencing one yields a blank (incomplete) result.
const DERIVED_FIELD_NAMES = [
  ...COMPUTED_FIELD_NAMES,
  TEMPLATED_STRING_FIELD_NAME,
];

/**
 * Recomputes all computed field (ComputedNumber/ComputedText) values in the
 * given form from current values. Expressions are compiled and type checked
 * once when the notebook loads (see compileUiSpecConditionals in
 * @faims3/data-model); this reads the precompiled evaluator off each field and
 * applies it against current values. Recompute-all-and-diff, matching the
 * templated-field recompute.
 *
 * @param values Current form data values
 * @param uiSpecification The decoded UI spec (with compiled expressions attached)
 * @param formId The target form ID to update
 * @returns Whether anything changed, and the new values keyed by field name
 */
export function recomputeComputedFields({
  values,
  uiSpecification,
  formId,
}: {
  values: ValuesObject;
  uiSpecification: UiSpecModel;
  formId: string;
}): {changes: boolean; updates: Record<string, ExprValue | null>} {
  const fieldMap = getFieldToIdsMap(uiSpecification);

  // Field names in this form, the derived ones (excluded as inputs), and the
  // computed fields to evaluate (with their precompiled evaluators).
  const formFields = new Set<string>();
  const derivedFields = new Set<string>();
  const computedFields: {
    fieldName: string;
    expressionFn: (scope: Map<string, ExprValue>) => ExprValue | null;
    references: string[];
  }[] = [];

  for (const [fieldName, location] of Object.entries(fieldMap)) {
    if (location.viewSetId !== formId) {
      continue;
    }
    formFields.add(fieldName);

    const fieldDetails = uiSpecification.fields[fieldName];
    const componentName = fieldDetails['component-name'];

    if (DERIVED_FIELD_NAMES.includes(componentName)) {
      derivedFields.add(fieldName);
    }
    if (COMPUTED_FIELD_NAMES.includes(componentName)) {
      // Expression is compiled at notebook load and attached in place; read it
      // off the compiled field definition.
      const compiledField = fieldDetails as CompiledFieldDefinition;
      const expressionFn = compiledField.expressionFn;
      const references = compiledField.expressionRefs;
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

  // Resolves a field name to a typed value matching its declared type-returned,
  // or null when missing, mistyped, or itself derived. Number inputs may arrive
  // as strings from form controls and are converted; other types are strict.
  // An empty string counts as missing so partially filled forms stay blank.
  const resolveField = (name: string): ExprValue | null => {
    if (derivedFields.has(name)) {
      return null;
    }
    const exprType =
      FAIMS_TYPE_TO_EXPR_TYPE[uiSpecification.fields[name]?.['type-returned']];
    if (!exprType) {
      return null;
    }
    const raw = values[name];
    if (raw === undefined || raw === null || raw === '') {
      return null;
    }
    switch (exprType) {
      case 'number': {
        const n = typeof raw === 'number' ? raw : Number(raw);
        return Number.isNaN(n) ? null : n;
      }
      case 'string':
        return typeof raw === 'string' ? raw : null;
      case 'boolean':
        return typeof raw === 'boolean' ? raw : null;
    }
  };

  let changes = false;
  const updates: Record<string, ExprValue | null> = {};

  for (const {fieldName, expressionFn, references} of computedFields) {
    // Build the scope from referenced symbols that are fields in this form.
    // A referenced field with no usable value leaves the result blank; any
    // symbol that is not a field in this form is treated as unknown.
    const scope = new Map<string, ExprValue>();
    let incomplete = false;
    for (const ref of references) {
      if (!formFields.has(ref)) {
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

    // Normalise previous value so null and empty compare equal.
    const previous = values[fieldName];
    const prev =
      previous === undefined || previous === null || previous === ''
        ? null
        : (previous as ExprValue);

    if (!Object.is(prev, result)) {
      updates[fieldName] = result;
      changes = true;
    }
  }

  return {changes, updates};
}

/**
 * Form-ready onChange entrypoint for computed fields. Recomputes and writes
 * back any changed values.
 *
 * @param form The tanstack form
 * @param formId The target form ID to update
 * @param uiSpec The decoded UI spec (with compiled expressions attached)
 * @param runListeners Whether tanstack should fire listeners for the update
 * @returns True iff a change was detected
 */
export function onChangeComputedFields({
  form,
  uiSpec,
  formId,
  runListeners,
}: {
  form: FaimsForm;
  formId: string;
  uiSpec: UiSpecModel;
  runListeners: boolean;
}): boolean {
  const data = formDataExtractor({fullData: form.state.values});
  const {changes, updates} = recomputeComputedFields({
    formId,
    uiSpecification: uiSpec,
    values: data,
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
