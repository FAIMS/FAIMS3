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
import {ProjectUIModel} from '../../../datamodel/ui';

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

function update_by_check(
  ui_specification: ProjectUIModel,
  values: {[field_name: string]: any},
  is_field: boolean,
  viewName: string,
  viewsetName: string,
  fieldName: string
) {
  const is_checked = check_by_branching_logic(
    ui_specification,
    is_field,
    fieldName
  );
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
//function is to get all relevant fields
function check_by_branching_logic(
  ui_specification: ProjectUIModel,
  is_field: boolean,
  field: string
) {
  if (field === undefined || field === '') return true;

  if (ui_specification['fields'][field]['logic_select'] === undefined)
    return false;

  if (
    is_field &&
    ui_specification['fields'][field]['logic_select']['type'].includes('field')
  )
    return true;

  if (
    !is_field &&
    ui_specification['fields'][field]['logic_select']['type'].includes('view')
  )
    return true;

  return false;
}

export function get_logic_fields(
  ui_specification: ProjectUIModel,
  values: {[field_name: string]: any},
  viewName: string
) {
  const fields: string[] = [];
  ui_specification['views'][viewName]['fields'].map((field: string) =>
    get_field(ui_specification['fields'][field], values, ui_specification)
      ? fields.push(field)
      : field
  );
  return fields;
}

const get_field = (
  value: any,
  values: {[field_name: string]: any},
  ui_specification: ProjectUIModel
) => {
  if (value['is_logic'] === undefined) return true;
  let is_display = true;
  for (const [name] of Object.entries(value['is_logic'])) {
    if (!value['is_logic'][name].includes(values[name])) {
      is_display = false;
      return is_display;
    }
    //check the upper level to not display the not relevant value in loop
    if (!get_field(ui_specification['fields'][name], values, ui_specification))
      return false;
  }
  return is_display;
};

//function is to get all relevant views/tabs
export function get_logic_views(
  ui_specification: ProjectUIModel,
  form_type: string,
  values: {[field_name: string]: any}
) {
  const views: string[] = [];
  ui_specification['viewsets'][form_type]['views'].map((view: string) =>
    get_field(ui_specification['views'][view], values, ui_specification)
      ? views.push(view)
      : view
  );

  return views;
}
