import {z} from 'zod';
import {UiSpecModel} from '../uiSpecification/types';
import {getViewsForViewSet} from '../uiSpecification/utils';
import {FormDataEntry, FormUpdateData} from './types';

// Map from section -> list of visible fields - section included IFF it's
// visible at all
export type FieldVisibilityMap = Record<string, string[]>;

// Schema so API responses embedding a completion result can reuse it
export const completionResultSchema = z.object({
  progress: z.number(),
  requiredCount: z.number(),
  completedCount: z.number(),
  /** Required fields the user hasn't filled in yet. */
  incompleteRequired: z.array(z.string()),
});
export type CompletionResult = z.infer<typeof completionResultSchema>;

/**
 * Optional per-field-type completeness override, injected by the forms package
 * whose field registry can't live here (it is React-bound).
 */
export type IsCompleteResolver = (fieldType: {
  namespace: string;
  name: string;
}) => ((formData: FormDataEntry) => boolean) | undefined;

/** A field is complete when it has a non-empty string or any non-null data. */
export function defaultCompletionFunction(formData: FormDataEntry): boolean {
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
 * @param formId - The ID of the form/viewset
 * @param data - The form data entries
 * @param visibilityMap - Map of visible fields per section
 * @param isCompleteResolver - Optional per-field-type completeness override
 * @returns Float 0->1 representing completion percentage
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
  let completedCount = 0;
  const incompleteRequired: string[] = [];
  const seen = new Set<string>();

  const allViews = getViewsForViewSet(uiSpec, formId);
  for (const sectionId of allViews) {
    for (const fieldId of visibilityMap[sectionId] ?? []) {
      // A field shown in several sections is still one field
      if (seen.has(fieldId)) {
        continue;
      }
      seen.add(fieldId);

      // Find the field spec
      const fieldSpec = uiSpec.fields[fieldId];
      if (!fieldSpec) {
        continue; // skip unknown fields
      }

      // If the field is required, add to count
      if (!fieldSpec['component-parameters']?.required) {
        continue; // skip non-required fields
      }

      // Count
      fieldCount += 1;

      // grab the completion function if defined otherwise use the default
      const completionFunc =
        isCompleteResolver?.({
          namespace: fieldSpec['component-namespace'],
          name: fieldSpec['component-name'],
        }) ?? defaultCompletionFunction;

      // Get the form data for this field
      const fieldData = data?.[fieldId];
      const isComplete = !!fieldData && completionFunc(fieldData);
      if (isComplete) {
        completedCount += 1;
      } else {
        incompleteRequired.push(fieldId);
      }
    }
  }

  if (fieldCount === 0) {
    // avoid division by zero, consider empty form as complete
    return {
      progress: 1.0,
      requiredCount: 0,
      completedCount: 0,
      incompleteRequired: [],
    };
  }

  return {
    progress: completedCount / fieldCount,
    requiredCount: fieldCount,
    completedCount,
    incompleteRequired,
  };
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
