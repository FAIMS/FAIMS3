import {HRID_STRING} from '../datamodel';
import {FAIMSTypeName} from '../types';
import {slugify} from '../utils';
import {compileExpression} from './conditionals';
import {
  compileComputedExpression,
  ExprType,
  FAIMS_TYPE_TO_EXPR_TYPE,
} from './expressions';
import {
  CompiledUiSpecModel,
  FieldDefinition,
  HridFieldMap,
  NotebookUiSpec,
  UiSpecModel,
  UiSpecForm,
  ValuesObject,
} from './types';
import {
  compileComputedExpressionForForm,
  fieldIdsForViewset,
} from './parentForms';

/**
 * Retrieves a viewset from the UI specification by its ID
 * @param {Object} params - The parameters object
 * @param {UiSpecModel} params.uiSpecification - The UI specification containing viewsets
 * @param {string} params.viewSetId - The ID of the viewset to retrieve
 * @returns {UiSpecForm} The requested viewset
 * @throws {Error} If the viewset ID is not found in the specification
 */
export const getViewsetByViewsetId = ({
  uiSpecification,
  viewSetId,
}: {
  uiSpecification: UiSpecModel;
  viewSetId: string;
}): UiSpecForm => {
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
 * @param {UiSpecModel} params.uiSpecification - The UI specification containing views
 * @param {string} params.viewId - The ID of the view to retrieve
 * @returns {Object} The requested view
 * @throws {Error} If the view ID is not found in the specification
 */
export const getViewByViewId = ({
  uiSpecification,
  viewId,
}: {
  uiSpecification: UiSpecModel;
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
  uiSpecification: UiSpecModel;
  viewId: string;
}) => {
  return getViewByViewId({uiSpecification, viewId}).fields;
};

/**
 * Gets all field names across all views in a viewset. Validates the ids, then
 * delegates enumeration to {@link fieldIdsForViewset} so the strict and
 * tolerant listings cannot drift apart.
 * @param {Object} params - The parameters object
 * @param {UiSpecModel} params.uiSpecification - The UI specification containing viewsets
 * @param {string} params.viewSetId - The ID of the viewset to get fields from
 * @returns {string[]} Combined array of field names from all views in the viewset
 * @throws {Error} If the viewset ID or one of its view IDs is not in the specification
 */
export const getFieldNamesForViewset = ({
  uiSpecification,
  viewSetId,
}: {
  uiSpecification: UiSpecModel;
  viewSetId: string;
}): string[] => {
  for (const viewId of getViewsetByViewsetId({uiSpecification, viewSetId})
    .views) {
    getViewByViewId({uiSpecification, viewId});
  }
  return fieldIdsForViewset(uiSpecification, viewSetId);
};

/**
 * Gets the HRID field name for a viewset, either from explicit configuration or
 * by finding a field that starts with the HRID prefix
 * @param {Object} params - The parameters object
 * @param {UiSpecModel} params.uiSpecification - The UI specification
 * containing viewsets
 * @param {string} params.viewSetId - The ID of the viewset to search for HRID
 * field
 * @returns {string|undefined} The HRID field name if found, undefined otherwise
 */
export const getHridFieldNameForViewset = ({
  uiSpecification,
  viewSetId,
}: {
  uiSpecification: UiSpecModel;
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
 * @param {UiSpecModel} params.uiSpecification - The UI specification to search
 * @param {string} params.fieldName - The field name to locate
 * @returns {Object} Object containing the matching viewId and viewSetId
 * @throws {Error} If no view contains the field or if no viewset contains the matching view
 */
export const getIdsByFieldName = ({
  uiSpecification,
  fieldName,
}: {
  uiSpecification: UiSpecModel;
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
 * @param {UiSpecModel} uiSpecification - The UI specification to analyze
 * @returns {Record<string, string|undefined>} Map of viewset IDs to HRID field names
 */
export const getHridFieldMap = (uiSpecification: UiSpecModel): HridFieldMap => {
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
 * @param {UiSpecModel} uiSpecification - The UI specification to analyze
 * @returns {Record<string, {viewId: string, viewSetId: string}>} Map of field names to their location IDs
 */
export const getFieldToIdsMap = (
  uiSpecification: UiSpecModel
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
  /** Component namespace from the UI spec (e.g. "faims-custom", "mapping-plugin"). */
  componentNamespace: string;
  /** Component name from the UI spec (e.g. "TakePoint", "AddressField"). */
  componentName: string;
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
  uiSpecification: UiSpecModel;
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
        componentNamespace: fieldInfo['component-namespace'] ?? '',
        componentName: fieldInfo['component-name'],
        type: fieldInfo['type-returned'],
        viewsetId: viewID,
        viewId: view,
        // include a hint as to whether this is a spatial field
        isSpatial: SPATIAL_FIELDS.some(f => f === fieldInfo['component-name']),
        annotation: fieldInfo.meta?.annotation.include
          ? slugify(fieldInfo.meta.annotation.label)
          : '',
        uncertainty: fieldInfo.meta?.uncertainty.include
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
  uiSpecification: UiSpecModel;
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
  uiSpecification: UiSpecModel;
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
  uiSpec: CompiledUiSpecModel;
  values: ValuesObject;
  viewsetId: string;
}) => {
  return getViewsMatchingCondition(uiSpec, values, viewsetId);
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
  uiSpec: CompiledUiSpecModel;
  values: ValuesObject;
  viewsetId: string;
}) => {
  // Build a set of visible fields within visible views
  const views = currentlyVisibleViews({values, uiSpec, viewsetId});
  const visibleFields: string[] = [];
  for (const v of views) {
    const fieldsMatching = getFieldsMatchingCondition(uiSpec, values, v);
    // Add all fields to visible fields set
    for (const f of fieldsMatching) {
      visibleFields.push(f);
    }
  }
  return visibleFields;
};

// Map from section -> list of visible fields - section included IFF it's
// visible at all
export type FieldVisibilityMap = Record<string, string[]>;

/** Distinct visible fields: a field listed in several visible sections is still one field. */
export function visibleFieldSet(
  visibilityMap: FieldVisibilityMap
): Set<string> {
  return new Set(Object.values(visibilityMap).flat());
}

/**
 * For the given ui spec, viewset and current form values, considers conditional
 * rendering, visibility etc to provide a set of visible views and fields
 * @returns  Record mapping view -> fields (only includes view if visible)
 */
export const currentlyVisibleMap = ({
  values,
  uiSpec,
  viewsetId,
  includeStaticallyHidden,
}: {
  uiSpec: CompiledUiSpecModel;
  values: ValuesObject;
  viewsetId: string;
  /** Also include condition-visible fields that are statically hidden. */
  includeStaticallyHidden?: boolean;
}): FieldVisibilityMap => {
  // Build a set of visible fields within visible views
  const views = currentlyVisibleViews({values, uiSpec, viewsetId});
  const visibleMap: FieldVisibilityMap = {};
  for (const v of views) {
    visibleMap[v] = getFieldsMatchingCondition(uiSpec, values, v, {
      includeStaticallyHidden,
    });
  }
  return visibleMap;
};

/**
 * Retrieves the keys of fields that are marked as required from the given project UI model.
 * @param {string} viewset - name of the viewset we are interested in
 * @param {UiSpecModel} uiSpec - The project UI Spec
 * @returns {string[]} An array of keys representing the fields that are marked as required.
 */
export const requiredFields = (
  viewset: string,
  uiSpec: CompiledUiSpecModel,
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

/** Hidden explicitly in element props - e.g. templated field */
export const isFieldStaticallyHidden = (
  field: FieldDefinition | undefined
): boolean => !!field?.['component-parameters']?.hidden;

// Return a list of field or view names that should be shown, taking account
// of branching logic.

export function getFieldsMatchingCondition(
  uiSpec: CompiledUiSpecModel,
  values: {[field_name: string]: any},
  viewName: string,
  options?: {includeStaticallyHidden?: boolean}
) {
  return getFieldsForView(uiSpec, viewName).filter(field => {
    const fieldDetails = uiSpec.fields[field];
    // A stale id in the view's field list (field since deleted) is not visible
    if (!fieldDetails) {
      return false;
    }
    // Visibility condition function (compiled specs always set one; default
    // to visible if absent, mirroring getViewsMatchingCondition).
    const visibleByCondition = fieldDetails.conditionFn
      ? fieldDetails.conditionFn(values)
      : true;
    return (
      visibleByCondition &&
      (options?.includeStaticallyHidden ||
        !isFieldStaticallyHidden(fieldDetails))
    );
  });
}

export function getViewsMatchingCondition(
  uiSpec: CompiledUiSpecModel,
  values: {[field_name: string]: any},
  viewsetName: string
) {
  return getViewsForViewSet(uiSpec, viewsetName).filter(view => {
    // A stale id in the viewset's view list (section since deleted) is not visible
    const viewDetails = uiSpec.views[view];
    if (!viewDetails) {
      return false;
    }
    const fn = viewDetails.conditionFn;
    if (fn !== undefined) return fn(values);
    else return true;
  });
}

// compile all conditional expressions in this UiSpec and store the
// compiled versions as a property `conditionFn` on the field or view
export function compileUiSpecConditionals(
  uiSpecification: UiSpecModel | NotebookUiSpec
) {
  // conditionals can appear on views or fields
  // compile each one and add compiled fn as a property on the field/view
  // any field/view with no condition will get a conditionFn returning true
  // so we can always just call this fn to filter fields/views

  // Compiled functions are attached in place: callers may read the passed-in
  // spec directly rather than the (typed) return value.
  const expressionFieldTypes = new Map<string, ExprType>();
  for (const field in uiSpecification.fields) {
    const t =
      FAIMS_TYPE_TO_EXPR_TYPE[uiSpecification.fields[field]['type-returned']];
    if (t) expressionFieldTypes.set(field, t);
  }

  // Required return type per computed field component.
  const COMPUTED_RETURN_TYPES: {[componentName: string]: ExprType} = {
    ComputedNumber: 'number',
    ComputedText: 'string',
  };

  for (const field in uiSpecification.fields) {
    const fieldDef = uiSpecification.fields[field];
    fieldDef.conditionFn = compileExpression(fieldDef.condition);

    // Compile computed field expressions at notebook load, attaching the
    // evaluator and its references in place (mirrors conditionFn above).
    // The expression is type checked against the other fields' types and
    // must produce the component's declared return type.
    const requiredType = COMPUTED_RETURN_TYPES[fieldDef['component-name']];
    if (requiredType) {
      const expr = fieldDef['component-parameters']?.expression;
      if (typeof expr === 'string' && expr.trim() !== '') {
        try {
          // Per-form compile so parent.<Field-ID> references type against
          // this form's possible parent forms.
          const compiled = compileComputedExpressionForForm({
            source: expr,
            uiSpecification: uiSpecification as UiSpecModel,
            formId:
              getViewsetForField(uiSpecification as UiSpecModel, field) ?? '',
            requiredType,
          });
          fieldDef.expressionFn = compiled.evaluate;
          fieldDef.expressionRefs = compiled.references;
        } catch (e) {
          // Invalid expression: leave unset so recompute yields a blank value.
          console.warn(
            `Computed field "${field}" has an invalid expression`,
            e
          );
        }
      }
    }
  }

  for (const view in uiSpecification.views) {
    const viewDef = uiSpecification.views[view];
    viewDef.conditionFn = compileExpression(viewDef.condition);
  }
}

export function getFieldsForViewSet(
  ui_specification: UiSpecModel,
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

export function getFieldLabel(uiSpec: UiSpecModel, fieldName: string) {
  if (fieldName in uiSpec.fields) {
    return uiSpec.fields[fieldName]['component-parameters'].label ?? fieldName;
  } else {
    return fieldName;
  }
}

export function getFormLabel({
  uiSpec,
  formId,
}: {
  uiSpec: UiSpecModel;
  formId: string;
}) {
  if (formId in uiSpec.viewsets) {
    return uiSpec.viewsets[formId].label ?? formId;
  } else {
    return formId;
  }
}

export function getVisibleTypes(ui_specification: UiSpecModel) {
  if (ui_specification)
    return (
      ui_specification.visible_types ||
      Object.getOwnPropertyNames(ui_specification.viewsets)
    );
  else return [];
}

/** Whether a form type's records should appear on the notebook overview map. */
export function isFormDisplayedInOverviewMap(
  uiSpec: UiSpecModel,
  formId: string
): boolean {
  if (!uiSpec || !(formId in uiSpec.viewsets)) {
    return false;
  }
  return uiSpec.viewsets[formId].displayInOverviewMap !== false;
}

/** Form type ids whose records should appear on the notebook overview map. */
export function getOverviewMapTypes(ui_specification: UiSpecModel): string[] {
  if (!ui_specification) {
    return [];
  }
  return Object.getOwnPropertyNames(ui_specification.viewsets).filter(formId =>
    isFormDisplayedInOverviewMap(ui_specification, formId)
  );
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
  uiSpecification: UiSpecModel,
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

/**
 * Values of a form's summary_fields for display, keyed by field id in
 * summary_fields order. Condition-hidden fields drop out (their leftover
 * values are stale); statically hidden ones stay, since templating recomputes
 * them at save. A missing value maps to null so JSON serialization keeps the
 * key. The one definition of summary-value selection, shared by the record
 * list and the record Status tab.
 */
export function getSummaryValues({
  uiSpec,
  formId,
  values,
  visibleFields,
}: {
  uiSpec: CompiledUiSpecModel;
  formId: string;
  values: ValuesObject;
  /** Precomputed includeStaticallyHidden visible set, for a caller that
   * already ran that pass (the status walk); computed here when absent. */
  visibleFields?: ReadonlySet<string>;
}): Record<string, unknown> {
  const {fieldNames} = getSummaryFieldInformation(uiSpec, formId);
  if (fieldNames.length === 0) {
    return {};
  }
  const visible =
    visibleFields ??
    visibleFieldSet(
      currentlyVisibleMap({
        values,
        uiSpec,
        viewsetId: formId,
        includeStaticallyHidden: true,
      })
    );
  const summaryValues: Record<string, unknown> = {};
  for (const fieldName of fieldNames) {
    if (!visible.has(fieldName)) continue;
    summaryValues[fieldName] = values[fieldName] ?? null;
  }
  return summaryValues;
}

export function getFieldsForView(uiSpecification: UiSpecModel, viewId: string) {
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
  uiSpecification: UiSpecModel,
  viewsetId: string
) {
  return uiSpecification.viewsets[viewsetId].views;
}

export function getViewsetForField(
  uiSpecification: UiSpecModel,
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
  uiSpecification: UiSpecModel,
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
