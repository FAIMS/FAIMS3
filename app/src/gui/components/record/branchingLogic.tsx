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
 *  Implement functions to filter fields and views by conditional
 * rules.  Rules are compiled as a function (conditionFn) on the
 * view or field in the uiSpec.   This returns true if the field/view
 * is to be shown.  Here we provide functions to return an array of
 * visible fields/views.
 */
import {ProjectUIModel} from 'faims3-datamodel';
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
    is_controller_field(ui_specification, f)
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
