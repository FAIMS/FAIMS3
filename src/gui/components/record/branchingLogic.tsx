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
 *   This is the file is to set the fields and views for branchingLogic
 */
import {ProjectUIModel} from '../../../datamodel/ui';
export function get_logic_fields(
  ui_specification: ProjectUIModel,
  values: any,
  viewName: string
) {
  const fields: string[] = [];
  ui_specification['views'][viewName]['fields'].map((field: string) =>
    get_field(ui_specification['fields'][field], values)
      ? fields.push(field)
      : field
  );
  return fields;
}

const get_field = (value: any, values: any) => {
  if (value['is_logic'] === undefined) return true;
  let is_display = true;
  for (const [name] of Object.entries(value['is_logic'])) {
    if (!value['is_logic'][name].includes(values[name])) {
      is_display = false;
      return is_display;
    }
  }
  return is_display;
};

export function get_logic_views(
  ui_specification: ProjectUIModel,
  form_type: string,
  values: any
) {
  const views: string[] = [];
  ui_specification['viewsets'][form_type]['views'].map((view: string) =>
    get_field(ui_specification['views'][view], values) ? views.push(view) : view
  );

  return views;
}
