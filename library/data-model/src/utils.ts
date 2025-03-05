import {HRID_STRING} from './datamodel/core';
import {ProjectUIModel, ProjectUIViewset} from './types';

/**
 * Retrieves a viewset from the UI specification by its ID
 * @param {Object} params - The parameters object
 * @param {ProjectUIModel} params.uiSpecification - The UI specification containing viewsets
 * @param {string} params.viewSetId - The ID of the viewset to retrieve
 * @returns {ProjectUIViewset} The requested viewset
 * @throws {Error} If the viewset ID is not found in the specification
 */
export const getViewsetByViewsetId = ({
  uiSpecification,
  viewSetId,
}: {
  uiSpecification: ProjectUIModel;
  viewSetId: string;
}): ProjectUIViewset => {
  const viewSet = uiSpecification.viewsets[viewSetId];
  if (!viewSet) {
    throw new Error(
      `The viewset ID provided ${viewSetId} is not present in the given ui specification.`
    );
  }
  return viewSet;
};

/**
 * Retrieves a view from the UI specification by its ID
 * @param {Object} params - The parameters object
 * @param {ProjectUIModel} params.uiSpecification - The UI specification containing views
 * @param {string} params.viewId - The ID of the view to retrieve
 * @returns {Object} The requested view
 * @throws {Error} If the view ID is not found in the specification
 */
export const getViewByViewId = ({
  uiSpecification,
  viewId,
}: {
  uiSpecification: ProjectUIModel;
  viewId: string;
}) => {
  const view = uiSpecification.views[viewId];
  if (!view) {
    throw new Error(
      `The view ID provided ${viewId} is not present in the given ui specification.`
    );
  }
  return view;
};

/**
 * Gets the field names associated with a specific view
 * @param {Object} params - The parameters object
 * @param params.uiSpecification - The UI specification containing views
 * @param params.viewId - The ID of the view to get fields from
 * @returns {string[]} Array of field names in the view
 */
export const getFieldNamesForView = ({
  uiSpecification,
  viewId,
}: {
  uiSpecification: ProjectUIModel;
  viewId: string;
}) => {
  return getViewByViewId({uiSpecification, viewId}).fields;
};

/**
 * Gets all field names across all views in a viewset
 * @param {Object} params - The parameters object
 * @param {ProjectUIModel} params.uiSpecification - The UI specification containing viewsets
 * @param {string} params.viewSetId - The ID of the viewset to get fields from
 * @returns {string[]} Combined array of field names from all views in the viewset
 */
export const getFieldNamesForViewset = ({
  uiSpecification,
  viewSetId,
}: {
  uiSpecification: ProjectUIModel;
  viewSetId: string;
}): string[] => {
  const viewset = getViewsetByViewsetId({uiSpecification, viewSetId});
  let fieldNames: string[] = [];
  for (const viewId of viewset.views) {
    fieldNames = [
      ...fieldNames,
      ...getFieldNamesForView({uiSpecification, viewId}),
    ];
  }
  return fieldNames;
};

/**
 * Gets the HRID field name for a viewset, either from explicit configuration or
 * by finding a field that starts with the HRID prefix
 * @param {Object} params - The parameters object
 * @param {ProjectUIModel} params.uiSpecification - The UI specification
 * containing viewsets
 * @param {string} params.viewSetId - The ID of the viewset to search for HRID
 * field
 * @returns {string|undefined} The HRID field name if found, undefined otherwise
 */
export const getHridFieldNameForViewset = ({
  uiSpecification,
  viewSetId,
}: {
  uiSpecification: ProjectUIModel;
  viewSetId: string;
}): string | undefined => {
  // Try and find the viewSet
  const viewSet = getViewsetByViewsetId({uiSpecification, viewSetId});

  // Then test if we have a specific predefined field name
  const specificHridField = viewSet.hridField;
  if (specificHridField) {
    return specificHridField;
  }

  // If not, find all visible field names
  const visibleFieldNames = getFieldNamesForViewset({
    uiSpecification,
    viewSetId,
  });

  // And then find the first matching
  for (const fieldName of visibleFieldNames) {
    if (fieldName.startsWith(HRID_STRING)) {
      return fieldName;
    }
  }

  // Otherwise return undefined and allow parent context to handle this issue
  return undefined;
};

/**
 * Finds the view and viewset IDs that contain a specific field by field name
 * @param {Object} params - The parameters object
 * @param {ProjectUIModel} params.uiSpecification - The UI specification to search
 * @param {string} params.fieldName - The field name to locate
 * @returns {Object} Object containing the matching viewId and viewSetId
 * @throws {Error} If no view contains the field or if no viewset contains the matching view
 */
export const getIdsByFieldName = ({
  uiSpecification,
  fieldName,
}: {
  uiSpecification: ProjectUIModel;
  fieldName: string;
}): {viewId: string; viewSetId: string} => {
  // Get all views
  const views = uiSpecification.views;

  // Iterate through and find which view has the specific field
  let matchingViewId = undefined;
  for (const viewId of Object.keys(views)) {
    const fieldNamesForView = getFieldNamesForView({uiSpecification, viewId});
    if (fieldNamesForView.includes(fieldName)) {
      matchingViewId = viewId;
      break;
    }
  }

  // Now if we can't find it, throw an error
  if (!matchingViewId) {
    throw Error(
      `Could not find a view which contains the field name ${fieldName}!`
    );
  }

  // So we have a matching view - now find which view set it's in
  let matchingViewSetId = undefined;
  const viewSets = uiSpecification.viewsets;
  for (const viewSetId of Object.keys(viewSets)) {
    // Get the views for this view set
    const viewSet = viewSets[viewSetId];
    const views = viewSet.views;
    if (views.includes(matchingViewId)) {
      matchingViewSetId = viewSetId;
      break;
    }
  }

  if (!matchingViewSetId) {
    throw Error(
      `Could not find a viewset which contains the view with ID ${matchingViewId}!`
    );
  }

  return {viewSetId: matchingViewSetId, viewId: matchingViewId};
};

/**
 * Creates a mapping of viewset IDs to their corresponding HRID field names
 * @param {ProjectUIModel} uiSpecification - The UI specification to analyze
 * @returns {Record<string, string|undefined>} Map of viewset IDs to HRID field names
 */
export const getHridFieldMap = (
  uiSpecification: ProjectUIModel
): Record<string, string | undefined> => {
  // Get all viewset IDs from the specification
  const viewSetIds = Object.keys(uiSpecification.viewsets);

  // Create mapping object
  const hridFieldMap: Record<string, string | undefined> = {};

  // Iterate through viewsets and get HRID field for each
  for (const viewSetId of viewSetIds) {
    const hridField = getHridFieldNameForViewset({
      uiSpecification,
      viewSetId,
    });
    hridFieldMap[viewSetId] = hridField;
  }

  return hridFieldMap;
};

/**
 * Creates a mapping of field names to their containing view and viewset IDs
 * @param {ProjectUIModel} uiSpecification - The UI specification to analyze
 * @returns {Record<string, {viewId: string, viewSetId: string}>} Map of field names to their location IDs
 */
export const getFieldToIdsMap = (
  uiSpecification: ProjectUIModel
): Record<string, {viewId: string; viewSetId: string}> => {
  // Initialize the mapping object
  const fieldMap: Record<string, {viewId: string; viewSetId: string}> = {};

  // Get all viewsets
  const viewsetIds = Object.keys(uiSpecification.viewsets);

  // For each viewset, get all fields and map them
  for (const viewSetId of viewsetIds) {
    const fieldNames = getFieldNamesForViewset({
      uiSpecification,
      viewSetId,
    });

    // For each field, find its view ID and add to map
    for (const fieldName of fieldNames) {
      const ids = getIdsByFieldName({
        uiSpecification,
        fieldName,
      });
      fieldMap[fieldName] = ids;
    }
  }

  return fieldMap;
};
