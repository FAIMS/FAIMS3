/**
 * @file Pure helpers for UI-spec ids, viewset membership, summary fields, and condition rewrites.
 */

import {ConditionType} from '../../types/condition';
import {replaceFieldInCondition as replaceFieldInConditionDomain} from '../../domain/conditions/conditionReferences';
import {NotebookUISpec} from '../initial';

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

/**
 * Re-exports domain traversal helper for reducers that should not import UI layers.
 *
 * @param condition - Condition subtree.
 * @param oldId - Field id before rename.
 * @param newId - Field id after rename.
 * @returns Updated condition or undefined/null passthrough.
 */
export const replaceFieldInCondition = (
  condition: ConditionType | null | undefined,
  oldId: string,
  newId: string
): ConditionType | null | undefined =>
  replaceFieldInConditionDomain(condition, oldId, newId);
