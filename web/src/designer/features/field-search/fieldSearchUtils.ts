/**
 * @file Builds searchable field entries and resolves which fields are in scope for pickers.
 */

import {getFieldLabel} from '../../components/condition/utils';
import type {FieldType} from '../../state/initial';
import type {
  FieldSearchEntry,
  FieldSearchFilters,
  FieldSearchScope,
} from './types';

type ViewMap = Record<
  string,
  {label: string; fields: string[]; condition?: unknown}
>;
type ViewSetMap = Record<string, {label: string; views: string[]}>;

/** Resolves the containing form and section labels for a field. */
export const resolveFieldLocation = (
  fieldId: string,
  views: ViewMap,
  viewsets: ViewSetMap
): {viewSetLabel: string; sectionLabel: string} => {
  for (const viewset of Object.values(viewsets)) {
    for (const sectionId of viewset.views) {
      const section = views[sectionId];
      if (section?.fields.includes(fieldId)) {
        return {
          viewSetLabel: viewset.label,
          sectionLabel: section.label,
        };
      }
    }
  }
  return {viewSetLabel: '', sectionLabel: ''};
};

/** Builds searchable text properties for a field. */
export const buildFieldSearchEntry = (
  fieldId: string,
  field: FieldType,
  location?: {viewSetLabel: string; sectionLabel: string}
): FieldSearchEntry => {
  const params = field['component-parameters'];
  const label = getFieldLabel(field) || fieldId;
  return {
    fieldId,
    field,
    label,
    id: fieldId,
    helperText: String(params.helperText ?? ''),
    advancedHelperText: String(params.advancedHelperText ?? ''),
    viewSetLabel: location?.viewSetLabel ?? '',
    sectionLabel: location?.sectionLabel ?? '',
  };
};

/** Collects field ids belonging to every section in a viewset. */
export const getViewsetFieldIds = (
  viewsetId: string,
  views: ViewMap,
  viewsets: ViewSetMap
): string[] => {
  const viewset = viewsets[viewsetId];
  if (!viewset) return [];
  return viewset.views.flatMap(sectionId => views[sectionId]?.fields ?? []);
};

/**
 * Resolves which field ids are in scope for selection.
 *
 * - `all`: every field in the design.
 * - `viewset`: fields belonging to one form.
 * - `context`: same form as the editing target, excluding either the current field
 *   (`fieldId`) or all fields in the current section (`sectionId`) — mirrors
 *   condition-editor rules so a field cannot reference itself or its section peers.
 */
export const resolveFieldIdsInScope = (
  allFields: Record<string, FieldType>,
  views: ViewMap,
  viewsets: ViewSetMap,
  scope: FieldSearchScope
): string[] => {
  if (scope.kind === 'all') {
    return Object.keys(allFields);
  }

  if (scope.kind === 'viewset') {
    return getViewsetFieldIds(scope.viewsetId, views, viewsets);
  }

  // Resolve the anchor section from either explicit sectionId or the field's section.
  let sectionId: string | undefined;
  if (scope.sectionId) {
    sectionId = scope.sectionId;
  } else if (scope.fieldId) {
    sectionId = Object.keys(views).find(id =>
      views[id].fields.includes(scope.fieldId!)
    );
  } else {
    return Object.keys(allFields);
  }

  const viewset = Object.values(viewsets).find(
    vs => sectionId !== undefined && vs.views.includes(sectionId)
  );
  // Cannot locate the containing form — return empty rather than leak other forms.
  const formFields = viewset
    ? viewset.views.flatMap(id => views[id]?.fields ?? [])
    : [];

  const ownSectionFields = scope.sectionId
    ? (views[scope.sectionId]?.fields ?? [])
    : [];

  if (scope.fieldId) {
    return formFields.filter(id => id !== scope.fieldId);
  }
  // Section condition: reference fields from other sections in the same form only.
  return formFields.filter(id => !ownSectionFields.includes(id));
};

/** Applies optional filters to a list of candidate field ids. */
export const applyFieldFilters = (
  fieldIds: string[],
  allFields: Record<string, FieldType>,
  filters?: FieldSearchFilters
): string[] => {
  if (!filters) return fieldIds;

  return fieldIds.filter(fieldId => {
    const field = allFields[fieldId];
    if (!field) return false;

    if (filters.excludeFieldIds?.includes(fieldId)) return false;
    if (filters.excludeSectionFieldIds?.includes(fieldId)) return false;

    const componentName = field['component-name'];
    if (
      filters.componentNames?.length &&
      !filters.componentNames.includes(componentName)
    ) {
      return false;
    }
    if (
      filters.excludeComponentNames?.length &&
      filters.excludeComponentNames.includes(componentName)
    ) {
      return false;
    }

    if (
      filters.typeReturned &&
      field['type-returned'] !== filters.typeReturned
    ) {
      return false;
    }

    if (filters.required !== undefined) {
      const isRequired = Boolean(field['component-parameters']?.required);
      if (isRequired !== filters.required) return false;
    }

    if (filters.predicate && !filters.predicate(fieldId, field)) {
      return false;
    }

    return true;
  });
};

/** Maps scoped field ids to entries ready for {@link weightedFieldSearch}. */
export const buildFieldSearchEntries = (
  fieldIds: string[],
  allFields: Record<string, FieldType>,
  views: ViewMap,
  viewsets: ViewSetMap
): FieldSearchEntry[] =>
  fieldIds
    .filter(id => allFields[id] != null)
    .map(id =>
      buildFieldSearchEntry(
        id,
        allFields[id],
        resolveFieldLocation(id, views, viewsets)
      )
    );
