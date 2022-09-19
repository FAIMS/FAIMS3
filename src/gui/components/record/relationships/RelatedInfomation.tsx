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
 * Filename: RelatedInfomation.tsx
 * Description:
 *   This is the file is to set the values for persistent state
 */
import {LocationState, Relationship} from '../../../../datamodel/core';
import {getFullRecordData} from '../../../../data_storage';
import {ProjectUIModel} from '../../../../datamodel/ui';
import {listFAIMSRecordRevisions} from '../../../../data_storage';
import * as ROUTES from '../../../../constants/routes';
import {RelationshipsComponentProps, RecordProps} from './types';
import {getUiSpecForProject} from '../../../../uiSpecification';
export function getparentlinkinfo(
  hrid: string,
  RelationState: any,
  record_id: string
) {
  let is_direct = false;
  let state_parent: LocationState = {};

  if (RelationState === undefined) return {state_parent, is_direct};
  if (RelationState.field_id !== undefined) is_direct = true;

  state_parent = {
    field_id: RelationState.field_id,
    record_id: record_id,
    hrid: hrid,
    parent: RelationState.parent,
    parent_link: RelationState.parent_link,
    parent_record_id: RelationState.parent_record_id,
    type: RelationState.type,
  };
  //check if the parent is exist
  if (
    RelationState.parent !== undefined &&
    RelationState.parent.field_id !== undefined
  ) {
    if (
      record_id === RelationState.parent_record_id &&
      RelationState.parent.parent !== undefined
    ) {
      state_parent = {
        field_id: RelationState.parent.field_id,
        record_id: record_id,
        hrid: hrid,
        parent: RelationState.parent.parent,
        parent_link: RelationState.parent.parent_link,
        parent_record_id: RelationState.parent.parent_record_id,
        type: RelationState.parent.type,
      };
    }
  }
  //id the record has same ID as parent and has no parent, then the record is the parent record
  if (
    state_parent.parent_record_id === state_parent.record_id &&
    state_parent.parent.parent_record_id === undefined
  )
    is_direct = false;
  console.error('state parent');
  console.error(state_parent);
  return {state_parent, is_direct};
}

//function to get parent/to be linked information to save in the child
export function getParentInfo(RelationState: any, parent: Relationship) {
  if (RelationState !== undefined && RelationState !== null) {
    if (RelationState.type !== undefined) {
      if (RelationState.type === 'Child')
        parent['parent'] = RelationState.parent_record_id;
      else if (RelationState.type === 'Linked') {
        if (parent['linked'] === undefined)
          parent['linked'] = [RelationState.parent_record_id];
        else if (!parent['linked'].includes(RelationState.parent_record_id))
          parent['linked'].push(RelationState.parent_record_id);
        //get parnet
        if (
          RelationState.parent !== undefined &&
          RelationState.parent.type === 'Child'
        )
          parent['parent'] = RelationState.parent.parent_record_id;
      }
    }
  }
  return parent;
}
type SubRelatedRecord = {
  project_id: string;
  record_id: string;
  record_label: string;
};
//function to get child/linked information to save in parent
export function getChildInfo(child_state: any, project_id: string) {
  let is_related = false;
  let field_id = '';
  let new_record: SubRelatedRecord | null = null;
  if (
    child_state !== undefined &&
    child_state !== null &&
    child_state.record_id !== undefined
  ) {
    //save the sub_record id into initial value
    field_id = child_state.field_id.replace('?', '');
    new_record = {
      project_id: project_id,
      record_id: child_state.record_id,
      record_label: child_state.hrid ?? child_state.record_id,
    };
    is_related = true;
    return {field_id, new_record, is_related};
  }
  return {field_id, new_record, is_related};
}

async function getRecordInformation(childrecord: SubRelatedRecord) {
  const revisions = await listFAIMSRecordRevisions(
    childrecord.project_id,
    childrecord.record_id
  );
  const index = revisions.length > 0 ? revisions.length - 1 : 0;
  const revision_id = revisions[index]; // this need to be updated
  const latest_record = await getFullRecordData(
    childrecord.project_id,
    childrecord.record_id,
    revision_id
  );
  return {latest_record, revision_id};
}

type fieldSet = {
  field: string;
  value: SubRelatedRecord;
};

function get_related_field(
  ui_specification: ProjectUIModel,
  field: string,
  values: {[field_name: string]: any},
  fields: fieldSet[]
) {
  if (ui_specification['fields'][field]['component-parameters']['multiple']) {
    if (values[field].length > 0) {
      values[field].map((value: SubRelatedRecord) => {
        fields.push({field: field, value: value});
      });
    }
  } else {
    //the related is single
    if (values[field]['record_id'] !== undefined) {
      fields.push({field: field, value: values[field]});
    }
  }
  return fields;
}

function get_related_fields(
  ui_specification: ProjectUIModel,
  form_type: string,
  values: {[field_name: string]: any}
) {
  const fields_child: fieldSet[] = [];
  const fields_linked: fieldSet[] = [];
  try {
    ui_specification['viewsets'][form_type]['views'].map((view: string) =>
      ui_specification['views'][view]['fields'].map((field: string) => {
        if (
          ui_specification['fields'][field]['component-name'] ===
          'RelatedRecordSelector'
        ) {
          //value should be Child or Linked
          const relation_type = ui_specification['fields'][field][
            'component-parameters'
          ]['relation_type'].replace('faims-core::', '');
          if (relation_type === 'Child') {
            get_related_field(ui_specification, field, values, fields_child);
          } else {
            get_related_field(ui_specification, field, values, fields_linked);
          }
        }
      })
    );
  } catch (err) {
    console.error(err);
  }
  return {fields_child, fields_linked};
}

// this is the function to get list of fields
function get_dispalyed_fields(
  ui_specification: ProjectUIModel,
  form_type: string
) {
  const fields: string[] = [];
  try {
    ui_specification['viewsets'][form_type]['views'].map((view: string) =>
      ui_specification['views'][view]['fields'].map((field: string) => {
        if (ui_specification['fields'][field]['displayParent']) {
          fields.push(field);
        }
      })
    );
  } catch (err) {
    console.error(err);
  }
  return fields;
}
export async function get_RelatedFields_for_field(
  project_id: string,
  field: string,
  values: {[field_name: string]: any}
) {
  const ui_specification = await getUiSpecForProject(project_id);
  let fields: fieldSet[] = [];
  fields = get_related_field(ui_specification, field, values, fields);
  const type =
    ui_specification['fields'][field]['component-parameters']['related_type'];
  const dispalyFields = get_dispalyed_fields(ui_specification, type);
  const records = await addRelatedFields(
    ui_specification,
    fields,
    [],
    true,
    dispalyFields
  );
  return records;
}
async function addRelatedFields(
  ui_specification: ProjectUIModel,
  fields: fieldSet[],
  newfields: Array<any>,
  is_dispaly = false,
  dispalyFields: string[] = []
) {
  for (const index in fields) {
    const field = fields[index]['field'];
    const {latest_record, revision_id} = await getRecordInformation(
      fields[index]['value']
    );
    const type =
      ui_specification['fields'][field]['component-parameters']['related_type'];

    let children: Array<RecordProps> = [];
    if (latest_record !== null) {
      //get children
      const {fields_child, fields_linked} = get_related_fields(
        ui_specification,
        type,
        latest_record?.data
      );
      children = await addRelatedFields(
        ui_specification,
        fields_child,
        children
      );
    }

    const child: {[field_name: string]: any} = {
      id: parseInt(index) + 1,
      title: fields[index]['value'].record_label,
      lastUpdatedBy: latest_record?.updated_by ?? '',
      route: ROUTES.getRecordRoute(
        fields[index]['value'].project_id,
        (fields[index]['value'].record_id || '').toString(),
        (revision_id || '').toString()
      ),
      type: ui_specification.viewsets[type]['label'],
      children: children,
    };
    if (is_dispaly && latest_record !== null) {
      //add information to child
      dispalyFields.map(
        (fieldName: string) =>
          (child[fieldName] = latest_record.data[fieldName])
      );
    }
    newfields.push(child);
  }
  return newfields;
}

export async function addLinkedRecord(
  ui_specification: ProjectUIModel,
  fields: fieldSet[],
  newfields: Array<any>,
  project_id: string,
  parent: Relationship | null
) {
  //add linked from fields
  if (fields.length > 0)
    newfields = await addRelatedFields(ui_specification, fields, newfields);
  console.error('get parent');
  console.error(parent);
  //add linked from parent
  if (
    parent !== null &&
    parent.linked !== undefined &&
    parent.linked.length > 0
  ) {
    console.error('get parent');
    console.error(parent);

    for (const index in parent.linked) {
      const record_id = parent.linked[index];
      const {latest_record, revision_id} = await getRecordInformation({
        project_id: project_id,
        record_id: record_id,
        record_label: parent.linked[index],
      });
      let type = latest_record?.type;
      if (type !== undefined) type = ui_specification.viewsets[type]['label'];
      console.error(latest_record);
      const child: {[field_name: string]: any} = {
        id: parseInt(index) + 1,
        title: record_id,
        lastUpdatedBy: latest_record?.updated_by ?? '',
        route: ROUTES.getRecordRoute(
          project_id,
          (record_id || '').toString(),
          (revision_id || '').toString()
        ),
        type: type,
        children: [],
      };
      newfields.push(child);
    }
  }

  return newfields;
}

export async function getDetailRelatedInfommation(
  ui_specification: ProjectUIModel,
  form_type: string,
  values: {[field_name: string]: any},
  project_id: string,
  parent: Relationship | null
): Promise<RelationshipsComponentProps> {
  const childrecords: RelationshipsComponentProps = {
    parentRecords: [],
    childRecords: [],
    linkRecords: [],
  };

  // get fields that are related field
  const {fields_child, fields_linked} = get_related_fields(
    ui_specification,
    form_type,
    values
  );

  if (childrecords['childRecords'] !== null && fields_child.length > 0)
    childrecords['childRecords'] = await addRelatedFields(
      ui_specification,
      fields_child,
      childrecords['childRecords']
    );
  if (childrecords['linkRecords'] !== null)
    childrecords['linkRecords'] = await addLinkedRecord(
      ui_specification,
      fields_linked,
      childrecords['linkRecords'],
      project_id,
      parent
    );
  if (parent !== null && parent.parent !== undefined) {
    const revisions = await listFAIMSRecordRevisions(project_id, parent.parent);
    const index = revisions.length > 0 ? revisions.length - 1 : 0;
    const revision = revisions[index];
    childrecords['parentRecords'] = [
      {
        id: 1,
        title: parent.parent ?? '',
        lastUpdatedBy: '',
        route: ROUTES.getRecordRoute(
          project_id,
          (parent.parent || '').toString(),
          (revision || '').toString()
        ),
        type: '',
        children: [],
      },
    ];
  }
  return childrecords;
}
