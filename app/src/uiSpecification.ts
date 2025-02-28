/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: uiSpecification.ts
 * Description:
 *   TODO
 */

import {FAIMSTypeName, ProjectUIModel} from '@faims3/data-model';
import {
  compileExpression,
  compileIsLogic,
  getDependantFields,
} from './conditionals';

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
