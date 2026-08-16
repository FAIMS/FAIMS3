import {UiSpecModel} from '../uiSpecification/types';
import {FieldVisibilityMap, getViewsForViewSet} from '../uiSpecification/utils';
import {FormDataEntry, FormUpdateData} from './types';

export type CompletionResult = {
  progress: number;
  requiredCount: number;
  completedCount: number;
  /** Required fields the user hasn't filled in yet. */
  incompleteRequired: string[];
};

/**
 * Builds a CompletionResult from the required-field total and the ids still
 * incomplete; a form with no required fields counts as complete.
 */
export function completionFromIncomplete(
  requiredCount: number,
  incompleteRequired: string[]
): CompletionResult {
  const completedCount = requiredCount - incompleteRequired.length;
  return {
    progress: requiredCount === 0 ? 1.0 : completedCount / requiredCount,
    requiredCount,
    completedCount,
    incompleteRequired,
  };
}

/**
 * Optional per-field-type completeness override, injected by the forms package
 * whose field registry can't live here (it is React-bound).
 */
export type IsCompleteResolver = (fieldType: {
  namespace: string;
  name: string;
}) => ((formData: FormDataEntry) => boolean) | undefined;

/** A field is complete when it has a non-empty string or any non-null data. */
function defaultCompletionFunction(formData: FormDataEntry): boolean {
  const {data} = formData;
  if (typeof data === 'string') {
    return data.length > 0;
  }
  return data !== null && data !== undefined;
}

/**
 * calculate completion progress for a form
 *
 * @param uiSpec - The UI specification of the form
 * @param formId - The form (viewset) being scored
 * @param data - The form data entries
 * @param visibilityMap - Map of visible fields per section
 * @param isCompleteResolver - Optional per-field-type completeness override
 * @returns Progress fraction 0->1, required/completed counts and the required
 *   fields still incomplete
 */
export function completion({
  uiSpec,
  formId,
  data,
  visibilityMap,
  isCompleteResolver,
}: {
  uiSpec: UiSpecModel;
  formId: string;
  data: FormUpdateData | undefined;
  visibilityMap: FieldVisibilityMap;
  isCompleteResolver?: IsCompleteResolver;
}): CompletionResult {
  let fieldCount = 0;
  const incompleteRequired: string[] = [];

  // Only formId's own sections score, so a wider visibility map cannot leak
  // another form's required fields into this form's progress
  const fieldIds = new Set(
    getViewsForViewSet(uiSpec, formId).flatMap(
      viewId => visibilityMap[viewId] ?? []
    )
  );
  for (const fieldId of fieldIds) {
    const fieldSpec = uiSpec.fields[fieldId];
    if (!fieldSpec) {
      continue; // skip unknown fields
    }
    if (!fieldSpec['component-parameters']?.required) {
      continue; // skip non-required fields
    }
    fieldCount += 1;

    // grab the completion function if defined otherwise use the default
    const completionFunc =
      isCompleteResolver?.({
        namespace: fieldSpec['component-namespace'],
        name: fieldSpec['component-name'],
      }) ?? defaultCompletionFunction;

    const fieldData = data?.[fieldId];
    if (!fieldData || !completionFunc(fieldData)) {
      incompleteRequired.push(fieldId);
    }
  }

  return completionFromIncomplete(fieldCount, incompleteRequired);
}

/** Pulls raw values out of form data, e.g. for visibility evaluation. */
export function formDataToValues(
  data: FormUpdateData | undefined
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data ?? {})) {
    out[k] = v.data;
  }
  return out;
}
