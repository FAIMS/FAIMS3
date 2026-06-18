import {getFieldToIdsMap, UiSpecModel, ValuesObject} from '@faims3/data-model';
import {formDataExtractor} from '../../utils';
import {logWarn} from '../../logging';
import {FaimsForm} from '../types';
import {compileExpression, ExpressionError} from './expressionEngine';

const COMPUTED_FIELD_NAME = 'ComputedField';
const TEMPLATED_STRING_FIELD_NAME = 'TemplatedStringField';

// Component names whose values are themselves derived. These are excluded as
// inputs to a computed expression in this version to avoid evaluation ordering
// problems; referencing one yields a blank (incomplete) result.
const DERIVED_FIELD_NAMES = [COMPUTED_FIELD_NAME, TEMPLATED_STRING_FIELD_NAME];

/**
 * Recomputes all ComputedField values in the given form from current values.
 * Recompute-all-and-diff, matching recomputeDerivedFields.
 *
 * @param values Current form data values
 * @param UiSpecModel The decoded UI spec
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
}): {changes: boolean; updates: Record<string, number | null>} {
  const fieldMap = getFieldToIdsMap(uiSpecification);

  // Field names in this form, the derived ones (excluded as inputs), and the
  // computed fields to evaluate.
  const formFields = new Set<string>();
  const derivedFields = new Set<string>();
  const computedFields: {fieldName: string; expression: string}[] = [];

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
    if (componentName === COMPUTED_FIELD_NAME) {
      const expression = fieldDetails['component-parameters']?.expression;
      if (typeof expression !== 'string' || expression.trim() === '') {
        logWarn('ComputedField missing expression prop - cannot evaluate.');
        continue;
      }
      computedFields.push({fieldName, expression});
    }
  }

  // Resolves a field name to a number, or null when missing, non-numeric, or
  // itself derived.
  const resolveField = (name: string): number | null => {
    if (derivedFields.has(name)) {
      return null;
    }
    const raw = values[name];
    if (raw === undefined || raw === null || raw === '') {
      return null;
    }
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isNaN(n) ? null : n;
  };

  let changes = false;
  const updates: Record<string, number | null> = {};

  for (const {fieldName, expression} of computedFields) {
    let result: number | null = null;
    try {
      const compiled = compileExpression(expression);

      // Build the scope from referenced symbols that are fields in this form.
      // A referenced field with no usable value leaves the result blank; any
      // symbol that is not a field in this form is treated as unknown.
      const scope = new Map<string, number>();
      let incomplete = false;
      for (const ref of compiled.references) {
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

      result = incomplete ? null : compiled.evaluate(scope);
    } catch (e) {
      if (e instanceof ExpressionError) {
        logWarn(
          `ComputedField "${fieldName}" has an invalid expression: ${e.message}`
        );
      } else {
        logWarn(`ComputedField "${fieldName}" evaluation failed:`, e);
      }
      result = null;
    }

    // Normalise previous value so null and empty compare equal.
    const previous = values[fieldName];
    const prev =
      previous === undefined || previous === null || previous === ''
        ? null
        : Number(previous);

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
 * @param uiSpecification The decoded UI spec
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
