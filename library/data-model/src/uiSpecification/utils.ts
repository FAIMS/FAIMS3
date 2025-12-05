import {HRID_STRING} from '../datamodel';
import {ProjectUIModel, ProjectUIViewset, FAIMSTypeName} from '../types';
import {slugify} from '../utils';
import {
  compileIsLogic,
  compileExpression,
  getDependantFields,
} from './conditionals';
import {HridFieldMap, ValuesObject} from './types';

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
): HridFieldMap => {
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

// Maintain this list of spatially relevant fields
export const SPATIAL_FIELDS = ['MapFormField', 'TakePoint'];

export type FieldSummary = {
  name: string;
  type: string;
  annotation?: string;
  viewId: string;
  viewsetId: string;
  uncertainty?: string;
  isSpatial?: boolean;
};

/**
 * Get a list of fields for a notebook with relevant information
 * on each for the export

 * @param uiSpecification UI Specification (decoded)
 * @param viewID View ID
 * @returns an array of FieldSummary objects
 */
export const getNotebookFieldTypes = ({
  uiSpecification,
  viewID,
}: {
  uiSpecification: ProjectUIModel;
  viewID: string;
}) => {
  if (!(viewID in uiSpecification.viewsets)) {
    throw new Error(
      `invalid form ${viewID} not found in notebook. Available viewsets = ${Array.from(
        Object.keys(uiSpecification.viewsets)
      )}.`
    );
  }
  const views = uiSpecification.viewsets[viewID].views;
  const fields: FieldSummary[] = [];

  views.forEach((view: string) => {
    uiSpecification.views[view].fields.forEach((field: any) => {
      const fieldInfo = uiSpecification.fields[field];
      fields.push({
        name: field,
        type: fieldInfo['type-returned'],
        viewsetId: viewID,
        viewId: view,
        // include a hint as to whether this is a spatial field
        isSpatial: SPATIAL_FIELDS.some(f => f === fieldInfo['component-name']),
        annotation: fieldInfo.meta.annotation.include
          ? slugify(fieldInfo.meta.annotation.label)
          : '',
        uncertainty: fieldInfo.meta.uncertainty.include
          ? slugify(fieldInfo.meta.uncertainty.label)
          : '',
      });
    });
  });
  return fields;
};

/**
 * Builds a mapping of viewset IDs to their respective field summaries
 * @param uiSpecification - The UI specification containing viewsets and fields
 * @returns Map of viewset IDs to arrays of FieldSummary objects
 */
export const buildViewsetFieldSummaries = ({
  uiSpecification,
}: {
  uiSpecification: ProjectUIModel;
}): Record<string, FieldSummary[]> => {
  // Get all view IDs
  const allViewIds = Array.from(Object.keys(uiSpecification.viewsets));

  // Collate map of viewset -> list of fields
  const viewFieldsMap: Record<string, FieldSummary[]> = {};

  // First do validation to ensure spatial elements are present
  for (const viewID of allViewIds) {
    // Get field info for view
    const fields = getNotebookFieldTypes({uiSpecification, viewID});

    // Collect
    viewFieldsMap[viewID] = fields;
  }

  return viewFieldsMap;
};

/**
 * Determines if any viewset in the UI specification contains spatial fields
 * @param uiSpecification - The UI specification to analyze
 * @returns True if any viewset has spatial fields, false otherwise
 */
export const isValidForSpatialExport = ({
  uiSpecification,
}: {
  uiSpecification: ProjectUIModel;
}): boolean => {
  const viewInfo = buildViewsetFieldSummaries({uiSpecification});
  let hasSpatial = false;
  for (const viewID of Object.keys(viewInfo)) {
    const fields = viewInfo[viewID];
    if (fields.some(f => f.isSpatial)) {
      hasSpatial = true;
      break;
    }
  }
  return hasSpatial;
};

/**
 * For the given ui spec, viewset and current form values, considers conditional
 * rendering, visibility etc to provide a set of visible views (sections).
 * @returns  List of visible views/sections
 */
export const currentlyVisibleViews = ({
  values,
  uiSpec,
  viewsetId,
}: {
  uiSpec: ProjectUIModel;
  values: ValuesObject;
  viewsetId: string;
}) => {
  // Build a set of visible fields within visible views
  return getViewsMatchingCondition(uiSpec, values, [], viewsetId, {});
};

/**
 * For the given ui spec, viewset and current form values, considers conditional
 * rendering, visibility etc to provide a set of visible fields.
 * @returns  List of visible fields
 */
export const currentlyVisibleFields = ({
  values,
  uiSpec,
  viewsetId,
}: {
  uiSpec: ProjectUIModel;
  values: ValuesObject;
  viewsetId: string;
}) => {
  // Build a set of visible fields within visible views
  const views = currentlyVisibleViews({values, uiSpec, viewsetId});
  const visibleFields: string[] = [];
  for (const v of views) {
    const fieldsMatching = getFieldsMatchingCondition(
      uiSpec,
      values,
      [],
      v,
      {}
    );
    // Add all fields to visible fields set
    for (const f of fieldsMatching) {
      visibleFields.push(f);
    }
  }
  return visibleFields;
};

/**
 * For the given ui spec, viewset and current form values, considers conditional
 * rendering, visibility etc to provide a set of visible views and fields
 * @returns  Record mapping view -> fields (only includes view if visible)
 */
export const currentlyVisibleMap = ({
  values,
  uiSpec,
  viewsetId,
}: {
  uiSpec: ProjectUIModel;
  values: ValuesObject;
  viewsetId: string;
}) => {
  // Build a set of visible fields within visible views
  const views = currentlyVisibleViews({values, uiSpec, viewsetId});
  const visibleMap: Record<string, string[]> = {};
  for (const v of views) {
    visibleMap[v] = getFieldsMatchingCondition(uiSpec, values, [], v, {});
  }
  return visibleMap;
};

/**
 * Retrieves the keys of fields that are marked as required from the given project UI model.
 * @param {string} viewset - name of the viewset we are interested in
 * @param {ProjectUIModel} uiSpec - The project UI Spec
 * @returns {string[]} An array of keys representing the fields that are marked as required.
 */
export const requiredFields = (
  viewset: string,
  uiSpec: ProjectUIModel,
  values: ValuesObject
): string[] => {
  const visibleFields = currentlyVisibleFields({
    uiSpec,
    viewsetId: viewset,
    values,
  });
  return visibleFields.filter(
    (fieldname: string) =>
      uiSpec.fields[fieldname]['component-parameters'].required
  );
};

// Return a list of field or view names that should be shown, taking account
// of branching logic.

export function getFieldsMatchingCondition(
  ui_specification: ProjectUIModel,
  values: {[field_name: string]: any},
  fieldNames: string[],
  viewName: string,
  touched: {[field_name: string]: any}
) {
  let modified = Object.keys(touched);
  if (values.updateField) modified.push(values.updateField);
  modified = modified.filter((f: string) =>
    is_controller_field(ui_specification, f)
  );
  const allFields = getFieldsForView(ui_specification, viewName);
  // run the checks if there are modified control fields or the original views are empty
  if (modified.length > 0 || fieldNames.length === 0) {
    // filter the whole set of views
    const result = allFields.filter(field => {
      const fieldDetails = ui_specification.fields[field];
      return (
        // Visibility condition function
        fieldDetails.conditionFn(values) &&
        // Hidden explicitly in element props - e.g. templated field
        !fieldDetails['component-parameters']?.hidden
      );
    });
    return result;
  } else {
    // shortcut return the existing set of fieldNames
    return fieldNames;
  }
}

export function getViewsMatchingCondition(
  ui_specification: ProjectUIModel,
  values: {[field_name: string]: any},
  views: string[],
  viewsetName: string,
  touched: {[field_name: string]: any} = {}
) {
  let modified = Object.keys(touched);
  if (values.updateField) modified.push(values.updateField);
  modified = modified.filter((f: string) =>
    is_controller_field(ui_specification, f)
  );
  const allViews = getViewsForViewSet(ui_specification, viewsetName);
  // run the checks if there are modified control fields or the original views are empty
  if (modified.length > 0 || views.length === 0) {
    // filter the whole set of views
    const result = allViews.filter(view => {
      const fn = ui_specification.views[view].conditionFn;
      if (fn !== undefined) return fn(values);
      else return true;
    });
    return result;
  } else {
    // shortcut return the existing set of views
    return views;
  }
}

// check whether this field is a 'controller' field for branching
// logic, return true if it is, false otherwise
//
function is_controller_field(ui_specification: ProjectUIModel, field: string) {
  // we have two possible sources
  // - old logic_select property on the field
  // - new conditional_sources property on the ui_specification

  // check that this is a field, touched can contain non-field stuff
  if (ui_specification.fields[field] === undefined) {
    return false;
  }

  // here we return true if there is any logic_select property
  // which might be a false positive but shouldn't cost too much
  if ('logic_select' in ui_specification.fields[field]) return true;
  else if (
    ui_specification.conditional_sources &&
    ui_specification.conditional_sources.has(field)
  )
    return true;
  else return false;
}

// compile all conditional expressions in this UiSpec and store the
// compiled versions as a property `conditionFn` on the field or view
// also collect a Set of field names that are used in condition expressions
// so that we can react to changes in these fields and update the visible
// fields/views
//
export function compileUiSpecConditionals(uiSpecification: ProjectUIModel) {
  // conditionals can appear on views or fields
  // compile each one and add compiled fn as a property on the field/view
  // any field/view with no condition will get a conditionFn returning true
  // so we can always just call this fn to filter fields/views

  let depFields: string[] = [];

  for (const field in uiSpecification.fields) {
    if (uiSpecification.fields[field].is_logic)
      uiSpecification.fields[field].conditionFn = compileIsLogic(
        uiSpecification.fields[field].is_logic
      );
    else
      uiSpecification.fields[field].conditionFn = compileExpression(
        uiSpecification.fields[field].condition
      );
    depFields = [
      ...depFields,
      ...getDependantFields(uiSpecification.fields[field].condition),
    ];
  }

  for (const view in uiSpecification.views) {
    if (uiSpecification.views[view].is_logic)
      uiSpecification.views[view].conditionFn = compileIsLogic(
        uiSpecification.views[view].is_logic
      );
    else
      uiSpecification.views[view].conditionFn = compileExpression(
        uiSpecification.views[view].condition
      );
    depFields = [
      ...depFields,
      ...getDependantFields(uiSpecification.views[view].condition),
    ];
  }
  // add dependant fields as a property on the uiSpec
  uiSpecification.conditional_sources = new Set(depFields);
}

export function getFieldsForViewSet(
  ui_specification: ProjectUIModel,
  viewset_name: string
): {[key: string]: {[key: string]: any}} {
  const views = ui_specification.viewsets[viewset_name].views;
  const fields: {[key: string]: {[key: string]: any}} = {};
  for (const view of views) {
    const field_names = ui_specification.views[view].fields;
    for (const field_name of field_names) {
      fields[field_name] = ui_specification.fields[field_name];
    }
  }
  return fields;
}

export function getFieldLabel(
  ui_specification: ProjectUIModel,
  field_name: string
) {
  if (field_name in ui_specification.fields) {
    return ui_specification.fields[field_name]['component-parameters'].label;
  } else {
    return field_name;
  }
}

export function getVisibleTypes(ui_specification: ProjectUIModel) {
  if (ui_specification)
    return (
      ui_specification.visible_types ||
      Object.getOwnPropertyNames(ui_specification.viewsets)
    );
  else return [];
}

/**
 * Retrieves and processes summary field information for a specific viewset
 *
 * @param uiSpecification - The UI specification model containing viewset configurations
 * @param viewsetId - The identifier of the viewset to analyze
 * @returns An object containing:
 *          - enabled: boolean indicating if summary fields are configured
 *          - fieldNames: array of field names configured for summary display
 *          vertical stack display
 */
export function getSummaryFieldInformation(
  uiSpecification: ProjectUIModel,
  viewsetId: string
): {
  enabled: boolean;
  fieldNames: string[];
} {
  // Check if viewset exists
  if (!uiSpecification.viewsets || !(viewsetId in uiSpecification.viewsets)) {
    return {
      enabled: false,
      fieldNames: [],
    };
  }

  const viewset = uiSpecification.viewsets[viewsetId];
  const summaryFields = viewset.summary_fields || [];
  const enabled = summaryFields.length > 0;

  return {
    enabled,
    fieldNames: enabled ? summaryFields : [],
  };
}

export function getFieldsForView(
  uiSpecification: ProjectUIModel,
  viewId: string
) {
  if (viewId in uiSpecification.views) {
    return uiSpecification.views[viewId].fields;
  } else {
    return [];
  }
}

export function getFieldNamesFromFields(fields: {
  [key: string]: {[key: string]: any};
}): string[] {
  return Object.keys(fields);
}

export function getViewsForViewSet(
  uiSpecification: ProjectUIModel,
  viewsetId: string
) {
  return uiSpecification.viewsets[viewsetId].views;
}

export function getViewsetForField(
  uiSpecification: ProjectUIModel,
  fieldName: string
) {
  // find which section (view) it is in
  for (const section in uiSpecification.views) {
    if (uiSpecification.views[section].fields.indexOf(fieldName) >= 0) {
      // now which form (viewset) is that part of
      for (const form in uiSpecification.viewsets) {
        if (uiSpecification.viewsets[form].views.indexOf(section) >= 0) {
          return form;
        }
      }
    }
  }
  return undefined;
}

export function getReturnedTypesForViewSet(
  uiSpecification: ProjectUIModel,
  viewsetId: string
): {[field_name: string]: FAIMSTypeName} {
  const fields = getFieldsForViewSet(uiSpecification, viewsetId);
  const types: {[field_name: string]: FAIMSTypeName} = {};
  for (const field_name in fields) {
    if (fields[field_name]) {
      types[field_name] = fields[field_name]['type-returned'];
    } else {
      console.warn(
        'UI Spec had an undefined field with name: ',
        field_name,
        '. Ignoring...'
      );
      continue;
    }
  }
  return types;
}
