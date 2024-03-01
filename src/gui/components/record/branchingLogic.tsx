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
 * Filename: branchingLogic.tsx
 * Description:
 *  This is the file is to set the fields and views for branchingLogic, so can only show relevant tabs and fields
 *  the value should be defined only for single field and with equal value or not equal value
 *  default value for field could be empty/ ''/none and etc, no relevant tabs/fields should be displayed for the initial value
 * (which means that all fields and tabs with is_logic setup should not be displayed with initial value unless initial value is included)
 */
import {ProjectUIModel} from 'faims3-datamodel';
import {logError} from '../../../logging';
import {getFieldsForView, getViewsForViewSet} from '../../../uiSpecification';

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
    is_controller_field('field', ui_specification, f)
  );
  const allFields = getFieldsForView(ui_specification, viewName);
  // run the checks if there are modified control fields or the original views are empty
  if (modified.length > 0 || fieldNames.length === 0) {
    // filter the whole set of views
    const result = allFields.filter(field => {
      return ui_specification.fields[field].conditionFn(values);
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
    is_controller_field('field', ui_specification, f)
  );
  const allViews = getViewsForViewSet(ui_specification, viewsetName);
  // run the checks if there are modified control fields or the original views are empty
  if (modified.length > 0 || views.length === 0) {
    // filter the whole set of views
    const result = allViews.filter(view => {
      return ui_specification.views[view].conditionFn(values);
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
function is_controller_field(
  kind: 'field' | 'view',
  ui_specification: ProjectUIModel,
  field: string
) {
  try {
    // why are these returning true?
    if (field === undefined || field === '') return true;

    // get the array of logic_select values, default to empty
    const condition = ui_specification['fields'][field]['logic_select'];
    if (condition !== undefined) return condition['type'].includes(kind);
    else return false;
  } catch (error) {
    logError(error);
    return false;
  }
}
