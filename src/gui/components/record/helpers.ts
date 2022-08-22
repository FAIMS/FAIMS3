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
 * Filename: helpers.ts
 * Description:
 *   TODO
 */
import {ProjectUIModel} from '../../../datamodel/ui';
/**
 * Given a list of values, returns the first from the list that isn't null/undefined
 * This is to be used instead of list[0] || list[1] || list[2]
 * in the case that list can contain the number 0
 *
 * @param list List of undefineds, nulls, or anything else
 * @returns Always returns null or a defined value, this never returns undefined.
 */
export function firstDefinedFromList<T>(
  list: NonNullable<T>[]
): NonNullable<T> | null {
  if (list.length === 0) {
    return null;
  } else if (list[0] === undefined || list[0] === null) {
    return firstDefinedFromList(list.slice(1));
  } else {
    return list[0];
  }
}

export function getlogicUiSpefic(
  ui_specification: ProjectUIModel,
  form_type: string,
  values: any
) {
  let newui = ui_specification;
  ui_specification['viewsets'][form_type]['views'].map((view: string) => {
    ui_specification['views'][view]['fields'].map(
      (field: string) =>
        (newui = getfield(newui, values, field, view, form_type))
    );
  });
  return newui;
}

const getfield = (
  ui_specification: ProjectUIModel,
  values: any,
  field: string,
  view: string,
  form_type: string
) => {
  if (ui_specification['fields'][field]['logic_select'] === undefined)
    return ui_specification;
  if (ui_specification['fields'][field]['logic_select'] === 'none')
    return ui_specification;
  const fields = ui_specification['fields'][field]['logic_select'];

  if (ui_specification['fields'][field]['logic_select']['type'] === 'field') {
    for (const [name] of Object.entries(fields)) {
      if (name === 'type') {
        //pass if name is type
      } else if (values[field] !== name) {
        const index = ui_specification['views'][view]['fields'].indexOf(
          ui_specification['fields'][field]['logic_select'][name]
        );
        if (index > -1) {
          ui_specification['views'][view]['fields'].splice(index, 1);
        }
      } else if (
        values[field] === name &&
        !ui_specification['views'][view]['fields'].includes(
          ui_specification['fields'][field]['logic_select'][name]
        )
      ) {
        const index = ui_specification['views'][view]['fields'].indexOf(field);
        ui_specification['views'][view]['fields'].splice(
          index + 1,
          0,
          ui_specification['fields'][field]['logic_select'][name]
        );

        console.log(name);
      }
    }
    return ui_specification;
  }
  if (ui_specification['fields'][field]['logic_select']['type'] === 'section') {
    for (const [name] of Object.entries(fields)) {
      if (name === 'type') {
        //pass if name is type
      } else if (values[field] !== name) {
        const viewname =
          ui_specification['fields'][field]['logic_select'][name];
        const index = ui_specification['viewsets'][form_type]['views'].indexOf(
          viewname
        );
        if (index > -1) {
          ui_specification['viewsets'][form_type]['views'].splice(index, 1);
        }
      } else if (
        values[field] === name &&
        !ui_specification['viewsets'][form_type]['views'].includes(
          ui_specification['fields'][field]['logic_select'][name]
        )
      ) {
        const viewname =
          ui_specification['fields'][field]['logic_select'][name];
        const index = ui_specification['viewsets'][form_type]['views'].indexOf(
          view
        );
        ui_specification['viewsets'][form_type]['views'].splice(
          index + 1,
          0,
          viewname
        );
      }
    }
    console.log(ui_specification['viewsets'][form_type]['views']);
    return ui_specification;
  }
  return ui_specification;
};
