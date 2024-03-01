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

// Return a list of field or view names that should be shown, taking account
// of branching logic.

export function fieldsMatchingCondition(
  ui_specification: ProjectUIModel,
  values: {[field_name: string]: any},
  fieldNames: string[],
  views: string[],
  viewName: string,
  viewsetName: string,
  touched: {[field_name: string]: any}
) {
  // if values.updateField or any of the touched fields
  // is a conditional field, return an array of field names
  // for which the condition function returns true
  // otherwise just return fieldNames
  const modified = [values.updateField, ...Object.keys(touched)].filter(
    (f: string) => is_controller_field('field', ui_specification, f)
  );
  if (modified.length > 0) {
    // get all the fieldNames for this view
    // filter by conditionFn
    // return the array
  }
}

export function update_by_branching_logic(
  ui_specification: ProjectUIModel,
  values: {[field_name: string]: any},
  is_field: boolean,
  fieldNames: string[],
  views: string[],
  viewName: string,
  viewsetName: string,
  touched: {[field_name: string]: any}
) {
  if (is_field)
    console.log(
      '%cupdate_by_branching_logic',
      'background-color: yellow;',
      touched,
      values.updateField
    );
  let returnValue = update_by_check(
    ui_specification,
    values,
    is_field,
    viewName,
    viewsetName,
    values.updateField
  );
  if (returnValue !== null) return returnValue;
  for (const FieldName of Object.keys(touched)) {
    returnValue = update_by_check(
      ui_specification,
      values,
      is_field,
      viewName,
      viewsetName,
      FieldName
    );
    if (returnValue !== null) {
      break;
    }
  }
  if (returnValue !== null) return returnValue;
  if (is_field) return fieldNames;
  else return views;
}

// if fieldName is a controller field for branching logic,
// return a list of field or view names that should be displayed
// based on it's current value
function update_by_check(
  ui_specification: ProjectUIModel,
  values: {[field_name: string]: any},
  is_field: boolean,
  viewName: string,
  viewsetName: string,
  fieldName: string
) {
  // is this field a controller field?
  const is_checked = is_controller_field(
    is_field ? 'field' : 'view',
    ui_specification,
    fieldName
  );
  // if so, return the fields or views that it allows
  if (is_checked) {
    if (is_field) {
      const newFieldNames = get_logic_fields(
        ui_specification,
        values,
        viewName
      );
      return newFieldNames;
    } else {
      const newViews = get_logic_views(ui_specification, viewsetName, values);
      return newViews;
    }
  }
  return null;
}

function XXXXXXX_field(
  ui_specification: ProjectUIModel,
  values: {[field_name: string]: any},
  viewName: string,
  fieldName: string
) {
  // is this field a controller field?
  const is_checked = is_controller_field('field', ui_specification, fieldName);
  // if so, return the fields or views that it allows
  if (is_checked) {
    const newFieldNames = get_logic_fields(ui_specification, values, viewName);
    return newFieldNames;
  }
  return null;
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

// check whether this field is a 'controller' field for branching
// logic, return true if it is, false otherwise
//
// can be either a field or view controller
function check_by_branching_logic(
  ui_specification: ProjectUIModel,
  is_field: boolean,
  field: string
) {
  try {
    if (field === undefined || field === '') return true;

    if (ui_specification['fields'][field]['logic_select'] === undefined)
      return false;

    if (
      is_field &&
      ui_specification['fields'][field]['logic_select']['type'].includes(
        'field'
      )
    )
      return true;

    if (
      !is_field &&
      ui_specification['fields'][field]['logic_select']['type'].includes('view')
    )
      return true;

    return false;
  } catch (error) {
    logError(error);
    return false;
  }
}

// check whether this field/view should be shown according to the branching
// logic rules, return true if it should be shown, false otherwise
//
// if our field_spec includes:
// "is_logic": {
//   "retouched": [
//     "Yes"
//   ]
// }
// we check that the current value of 'retouched' is 'Yes' in 'values'
// we also check that the 'retouched' field is showing, we hide this one
// if 'retouched is hidden (that seems odd)
//
// spec - specification of field or view, may contain 'is_logic'
// values - current values for the view
const check_condition = (
  spec: any,
  values: {[field_name: string]: any},
  ui_specification: ProjectUIModel
) => {
  // if the field has no 'is_logic' clause, then it is shown
  if (spec['is_logic'] === undefined) return true;
  // if there is an 'is_logic' clause, we check whether the condition is true
  // for every field in the clause, check that it's value is included in
  // the values specified
  for (const [name] of Object.entries(spec['is_logic'])) {
    // check that the value is one that we allow
    if (!spec['is_logic'][name].includes(values[name])) {
      return false;
    }
    // if the conditional field is hidden, we are hidden too
    //  a recursive call to check the field 'name' given the current values
    if (
      !check_condition(
        ui_specification['fields'][name],
        values,
        ui_specification
      )
    )
      return false;
  }
  // if we fall out here, we're good
  return true;
};

//function is to get all relevant views/tabs
export function get_logic_views(
  ui_specification: ProjectUIModel,
  form_type: string,
  values: {[field_name: string]: any}
) {
  const views: string[] = [];
  ui_specification['viewsets'][form_type]['views'].map((view: string) => {
    check_condition(ui_specification['views'][view], values, ui_specification)
      ? views.push(view)
      : view;
  });

  return views;
}

export function get_logic_fields(
  ui_specification: ProjectUIModel,
  values: {[field_name: string]: any},
  viewName: string
) {
  const fields: string[] = [];
  // filter the fields in viewName, keeping those where the branching logic
  // says we should display
  ui_specification['views'][viewName]['fields'].map((field: string) =>
    check_condition(ui_specification['fields'][field], values, ui_specification)
      ? fields.push(field)
      : field
  );
  return fields;
}
