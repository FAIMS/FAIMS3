import {ConditionType} from '@/designer/components/condition/types';
import {NotebookUISpec} from '../initial';

/**
 * Slugify a string, replacing special characters with less special ones
 * @param str input string
 * @returns url safe version of the string
 * https://ourcodeworld.com/articles/read/255/creating-url-slugs-properly-in-javascript-including-transliteration-for-utf-8
 */
export const slugify = (str: string) => {
  str = str.trim();
  //str = str.toLowerCase();
  // remove accents, swap ñ for n, etc
  const from = 'ãàáäâáº½èéëêìíïîõòóöôùúüûñç·/_,:;';
  const to = 'aaaaaeeeeeiiiiooooouuuunc------';
  for (let i = 0, l = from.length; i < l; i++) {
    str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
  }

  str = str
    .replace(/[^A-Za-z0-9 -]/g, '') // remove invalid chars
    .replace(/\s+/g, '-') // collapse whitespace and replace by -
    .replace(/-+/g, '-'); // collapse dashes

  return str;
};

/**
 * Finds the ID of the viewset (form) that contains a given view (section).
 *
 * @param state - The full notebook UI specification.
 * @param viewId - The ID of the view to search for.
 * @returns The ID of the viewset containing the view, or null if not found.
 */
export const getViewSetForView = (
  state: NotebookUISpec,
  viewId: string
): string | null => {
  // Loop through all viewsets to find the one that includes this view in its list.
  for (const viewSetId in state.viewsets) {
    if (state.viewsets[viewSetId].views.includes(viewId)) {
      return viewSetId;
    }
  }
  return null;
};

/**
 * Removes a field from a specific viewset's summary fields
 * if the field is no longer present in any of the viewset's views.
 *
 * @param state - The full notebook UI specification.
 * @param fieldName - The name of the field to check.
 * @param viewSetId - The ID of the viewset to update.
 */
export const removeFieldFromSummaryForViewset = (
  state: NotebookUISpec,
  fieldName: string,
  viewSetId: string
): void => {
  const viewset = state.viewsets[viewSetId];

  // Only continue if the field is listed as a summary field for this viewset.
  if (viewset.summary_fields?.includes(fieldName)) {
    // Check if the field still exists in any section inside this viewset.
    const isInAnyView = viewset.views.some(
      viewId =>
        state.fviews[viewId]?.fields &&
        state.fviews[viewId].fields.includes(fieldName)
    );

    // If the field is not found in any section, remove it from summary_fields.
    if (!isInAnyView) {
      viewset.summary_fields = viewset.summary_fields.filter(
        f => f !== fieldName
      );
    }
  }
};

/**
 * Removes a field from the summary fields of all viewsets
 * where it is no longer present in any of their views.
 *
 * @param state - The full notebook UI specification.
 * @param fieldName - The name of the field to check and remove.
 */
export const removeFieldFromSummary = (
  state: NotebookUISpec,
  fieldName: string
): void => {
  // Check and remove the field from each viewset's summary fields.
  for (const viewSetId in state.viewsets) {
    removeFieldFromSummaryForViewset(state, fieldName, viewSetId);
  }
};

/**
 * Finds the view ID for a given field name.
 * @param uiSpec The UI specification object.
 * @param fieldName The name of the field to find.
 * @returns The ID of the view containing the field, or null if not found.
 */
export const getViewIDForField = (
  uiSpec: NotebookUISpec,
  fieldName: string
): string | null => {
  for (const viewId in uiSpec.fviews) {
    if (uiSpec.fviews[viewId].fields.includes(fieldName)) {
      return viewId;
    }
  }
  return null;
};

export const replaceFieldInCondition = (
  condition: ConditionType | null | undefined,
  oldId: string,
  newId: string
): ConditionType | null | undefined => {
  if (!condition) return condition;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const node: any = condition;

  if (
    typeof node === 'object' &&
    !Array.isArray(node) &&
    node !== null &&
    'field' in node &&
    node.field === oldId
  ) {
    // Shallow-clone to preserve Immer draft semantics.
    return {...node, field: newId};
  }

  if (
    typeof node === 'object' &&
    'conditions' in node &&
    Array.isArray(node.conditions)
  ) {
    return {
      ...node,
      conditions: node.conditions.map((c: ConditionType) =>
        replaceFieldInCondition(c, oldId, newId)
      ),
    };
  }

  return node as ConditionType;
};
