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

import {getProjectDB} from './sync';
import {ProjectID, FAIMSTypeName} from 'faims3-datamodel';
import {UI_SPECIFICATION_NAME, EncodedProjectUIModel} from 'faims3-datamodel';
import {ProjectUIModel} from 'faims3-datamodel';
import {
  compileExpression,
  compileIsLogic,
  getDependantFields,
} from './conditionals';

export async function getUiSpecForProject(
  project_id: ProjectID
): Promise<ProjectUIModel> {
  try {
    const projdb = await getProjectDB(project_id);
    const encUIInfo: EncodedProjectUIModel = await projdb.get(
      UI_SPECIFICATION_NAME
    );
    const uiSpec = {
      _id: encUIInfo._id,
      _rev: encUIInfo._rev,
      fields: encUIInfo.fields,
      views: encUIInfo.fviews,
      viewsets: encUIInfo.viewsets,
      visible_types: encUIInfo.visible_types,
    };
    compileUiSpecConditionals(uiSpec);
    return uiSpec;
  } catch (err) {
    console.warn('failed to find ui specification for', project_id, err);
    throw Error(`Could not find ui specification for ${project_id}`);
  }
}

export async function setUiSpecForProject(
  project_id: ProjectID,
  uiInfo: ProjectUIModel
) {
  const projdb = await getProjectDB(project_id);
  const encUIInfo: EncodedProjectUIModel = {
    _id: UI_SPECIFICATION_NAME,
    fields: uiInfo.fields,
    fviews: uiInfo.views,
    viewsets: uiInfo.viewsets,
    visible_types: uiInfo.visible_types,
  };
  try {
    const existing_encUIInfo = await projdb.get(encUIInfo._id);
    encUIInfo._rev = existing_encUIInfo._rev;
  } catch (err: any) {
    // Probably no existing UI info
    if (err?.status !== 404) {
      console.debug('Failed to set UI specification for', project_id, err);
    }
  }

  try {
    return await projdb.put(encUIInfo);
  } catch (err) {
    console.warn('failed to set ui specification', err);
    throw Error('failed to set ui specification');
  }
}

// compile all conditional expressions in this UiSpec and store the
// compiled versions as a property `conditionFn` on the field or view
// also collect a Set of field names that are used in condition expressions
// so that we can react to changes in these fields and update the visible
// fields/views
//
export function compileUiSpecConditionals(ui_specification: ProjectUIModel) {
  // conditionals can appear on views or fields
  // compile each one and add compiled fn as a property on the field/view
  // any field/view with no condition will get a conditionFn returning true
  // so we can always just call this fn to filter fields/views

  let depFields: string[] = [];

  for (const field in ui_specification.fields) {
    if (ui_specification.fields[field].is_logic)
      ui_specification.fields[field].conditionFn = compileIsLogic(
        ui_specification.fields[field].is_logic
      );
    else
      ui_specification.fields[field].conditionFn = compileExpression(
        ui_specification.fields[field].condition
      );
    depFields = [
      ...depFields,
      ...getDependantFields(ui_specification.fields[field].condition),
    ];
  }

  for (const view in ui_specification.views) {
    if (ui_specification.views[view].is_logic)
      ui_specification.views[view].conditionFn = compileIsLogic(
        ui_specification.views[view].is_logic
      );
    else
      ui_specification.views[view].conditionFn = compileExpression(
        ui_specification.views[view].condition
      );
    depFields = [
      ...depFields,
      ...getDependantFields(ui_specification.views[view].condition),
    ];
  }
  // add dependant fields as a property on the uiSpec
  ui_specification.conditional_sources = new Set(depFields);
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

export function getFieldsForView(
  ui_specification: ProjectUIModel,
  view_name: string
) {
  if (view_name in ui_specification.views) {
    return ui_specification.views[view_name].fields;
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
  ui_specification: ProjectUIModel,
  viewset_name: string
) {
  return ui_specification.viewsets[viewset_name].views;
}

export function getReturnedTypesForViewSet(
  ui_specification: ProjectUIModel,
  viewset_name: string
): {[field_name: string]: FAIMSTypeName} {
  const fields = getFieldsForViewSet(ui_specification, viewset_name);
  const types: {[field_name: string]: FAIMSTypeName} = {};
  for (const field_name in fields) {
    types[field_name] = fields[field_name]['type-returned'];
  }
  return types;
}

export async function dumpMetadataDBContents(
  project_id: ProjectID
): Promise<object[]> {
  const projdb = await getProjectDB(project_id);
  try {
    const db_contents = await projdb.allDocs({
      include_docs: true,
      attachments: true,
    });
    const docs = [];
    for (const o of db_contents.rows) {
      docs.push(o.doc as object);
    }
    return docs;
  } catch (err) {
    console.warn('failed to dump meta db for', project_id, err);
    throw Error(`failed to dump meta db for ${project_id}`);
  }
}
