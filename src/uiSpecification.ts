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
import {ProjectID, FAIMSTypeName} from './datamodel/core';
import {
  UI_SPECIFICATION_NAME,
  EncodedProjectUIModel,
} from './datamodel/database';
import {ProjectUIModel} from './datamodel/ui';

export async function getUiSpecForProject(
  project_id: ProjectID
): Promise<ProjectUIModel> {
  try {
    const projdb = await getProjectDB(project_id);
    const encUIInfo: EncodedProjectUIModel = await projdb.get(
      UI_SPECIFICATION_NAME
    );
    return {
      _id: encUIInfo._id,
      _rev: encUIInfo._rev,
      fields: encUIInfo.fields,
      views: encUIInfo.fviews,
      viewsets: encUIInfo.viewsets,
      visible_types: encUIInfo.visible_types,
    };
  } catch (err) {
    console.warn(err);
    throw Error(`failed to find ui specification for ${project_id}`);
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
      console.debug(err);
    }
  }

  try {
    return await projdb.put(encUIInfo);
  } catch (err) {
    console.warn(err);
    throw Error('failed to set ui specification');
  }
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

export function getFieldNamesFromFields(fields: {
  [key: string]: {[key: string]: any};
}): string[] {
  return Object.keys(fields);
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
    console.warn(err);
    throw Error(`failed to dump meta db for ${project_id}`);
  }
}
