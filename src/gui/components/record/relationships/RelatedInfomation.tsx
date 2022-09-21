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
import {
  upsertFAIMSData,
  getFullRecordData,
  getFirstRecordHead,
} from '../../../../data_storage';
import {ProjectUIModel} from '../../../../datamodel/ui';
import {listFAIMSRecordRevisions} from '../../../../data_storage';
import * as ROUTES from '../../../../constants/routes';
import {RelationshipsComponentProps, RecordProps} from './types';
import {getUiSpecForProject} from '../../../../uiSpecification';
import {get_fieldpersistentdata} from '../../../../datamodel/fieldpersistent';
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

  return {state_parent, is_direct};
}

//function to get parent/to be linked information to save in the child
export function getParentInfo(
  RelationState: any,
  parent: Relationship,
  record_id: string
) {
  if (RelationState === undefined || RelationState === null) return parent;
  if (record_id === RelationState.parent_record_id) return parent;
  if (RelationState.type === undefined) return parent;
  if (RelationState.type === 'Child')
    return {...parent, parent: RelationState.parent_record_id};
  if (RelationState.type === 'Linked') {
    if (parent['linked'] === undefined)
      parent['linked'] = [RelationState.parent_record_id];
    else if (!parent['linked'].includes(RelationState.parent_record_id))
      parent['linked'].push(RelationState.parent_record_id);
    //get parnet
    if (
      RelationState.parent !== undefined &&
      RelationState.parent.type === 'Child' &&
      RelationState.parent.parent_record_id !== record_id //check to confirm
    )
      parent['parent'] = RelationState.parent.parent_record_id;
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
  let latest_record = null;
  let revision_id;
  try {
    // const revisions = await listFAIMSRecordRevisions(
    //   childrecord.project_id,
    //   childrecord.record_id
    // );
    // revision_id = revisions[0]; // this need to be updated, should get the latest revision ID
    revision_id = await getFirstRecordHead(
      childrecord.project_id,
      childrecord.record_id
    );
    latest_record = await getFullRecordData(
      childrecord.project_id,
      childrecord.record_id,
      revision_id
    );
  } catch (error) {
    console.error('Error to get Full record with revision', error);
  }
  return {latest_record, revision_id};
}

type fieldSet = {
  field: string;
  value: SubRelatedRecord;
};

function get_related_valued_field(
  ui_specification: ProjectUIModel,
  field: string,
  values: {[field_name: string]: any},
  fields: fieldSet[]
) {
  if (values[field] === undefined || values[field] === null) return fields;
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

function get_related_valued_fields(
  ui_specification: ProjectUIModel,
  form_type: string,
  values: {[field_name: string]: any}
) {
  let fields_child: fieldSet[] = [];
  let fields_linked: fieldSet[] = [];
  try {
    getRelatedFields(ui_specification, form_type).map((field: string) => {
      const relation_type = ui_specification['fields'][field][
        'component-parameters'
      ]['relation_type'].replace('faims-core::', '');
      if (relation_type === 'Child') {
        fields_child = get_related_valued_field(
          ui_specification,
          field,
          values,
          fields_child
        );
      } else {
        fields_linked = get_related_valued_field(
          ui_specification,
          field,
          values,
          fields_linked
        );
      }
    });
  } catch (err) {
    console.error(err);
  }
  return {fields_child, fields_linked};
}

function getRelatedFields(
  ui_specification: ProjectUIModel,
  form_type: string
): string[] {
  const fields: string[] = [];
  ui_specification['viewsets'][form_type]['views'].map((view: string) =>
    ui_specification['views'][view]['fields'].map((field: string) => {
      if (
        ui_specification['fields'][field]['component-name'] ===
        'RelatedRecordSelector'
      ) {
        fields.push(field);
      }
    })
  );
  return fields;
}

// get list of fields for child/linked
function get_displayed_fields(
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
    console.error('get list of fields from child ', err);
  }
  return fields;
}
//get defailed information for child/linked
export async function get_RelatedFields_for_field(
  project_id: string,
  field: string,
  values: {[field_name: string]: any}
) {
  const ui_specification = await getUiSpecForProject(project_id);
  let fields: fieldSet[] = [];
  fields = get_related_valued_field(ui_specification, field, values, fields);
  const type =
    ui_specification['fields'][field]['component-parameters']['related_type'];
  const dispalyFields = get_displayed_fields(ui_specification, type);
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
    if (latest_record !== null && revision_id !== undefined) {
      //add and defined the child/link item when the inforamtion been added correctly
      const {fields_child, fields_linked} = get_related_valued_fields(
        ui_specification,
        type,
        latest_record?.data
      );
      children = await addRelatedFields(
        ui_specification,
        fields_child,
        children
      );

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
      // get the displayed information for the child or link item, this is used by field
      if (is_dispaly && latest_record !== null) {
        dispalyFields.map(
          (fieldName: string) =>
            (child[fieldName] = latest_record.data[fieldName])
        );
      }
      newfields.push(child);
    }
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

  //add linked from parent
  if (
    parent !== null &&
    parent.linked !== undefined &&
    parent.linked.length > 0
  ) {
    for (const index in parent.linked) {
      const record_id = parent.linked[index];
      const {latest_record, revision_id} = await getRecordInformation({
        project_id: project_id,
        record_id: record_id,
        record_label: parent.linked[index],
      });
      let type = latest_record?.type;
      if (type !== undefined) type = ui_specification.viewsets[type]['label'];
      const child: {[field_name: string]: any} = {
        id: newfields.length + 1,
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
    linkRecords: null,
  };

  // get fields that are related field
  const {fields_child, fields_linked} = get_related_valued_fields(
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
  childrecords['linkRecords'] = await addLinkedRecord(
    ui_specification,
    fields_linked,
    [],
    project_id,
    parent
  );
  //get information for parent
  if (parent !== null && parent.parent !== undefined) {
    const {latest_record, revision_id} = await getRecordInformation({
      project_id: project_id,
      record_id: parent.parent,
      record_label: parent.parent,
    });

    if (latest_record !== null) {
      const persistentvalue = await get_fieldpersistentdata(
        project_id,
        latest_record?.type
      );

      // const data: Array<{[field_name: string]: any}> = [];
      let hrid =
        latest_record.data['hrid' + latest_record?.type] ?? parent.parent;
      if (hrid === ' ') hrid = parent.parent;
      // Object.keys(persistentvalue.data).map((key: string, index: number) => {
      //   const persistentData = {
      //     id: index + 1,
      //     title: key,
      //     value: persistentvalue.data[key],
      //   };
      //   data.push(persistentData);
      // });

      childrecords['parentRecords'] = [
        {
          id: 1,
          title: hrid,
          lastUpdatedBy: '',
          route: ROUTES.getRecordRoute(
            project_id,
            (parent.parent || '').toString(),
            (revision_id || '').toString()
          ),
          type: latest_record?.type ?? '',
          children: [],
          persistentData: persistentvalue,
        },
      ];
    }
  }
  return childrecords;
}
export async function updateChildRecords(
  ui_specification: ProjectUIModel,
  form_type: string,
  record_id: string, // this is the current parent/link record ID
  preValues: {[field_name: string]: any},
  currentValues: {[field_name: string]: any}
) {
  const fields = getRelatedFields(ui_specification, form_type);
  for (const index in fields) {
    const field = fields[index];
    const is_mulptile =
      ui_specification['fields'][field]['component-parameters']['multiple'] ??
      false;
    const relation_type = ui_specification['fields'][field][
      'component-parameters'
    ]['relation_type'].replace('faims-core::', '');
    await updateChildRecord(
      preValues[field],
      currentValues[field],
      is_mulptile,
      record_id,
      relation_type
    );
  }
}
async function updateChildRecord(
  preValue: any,
  currentValue: any,
  is_multiple: boolean,
  record_id: string,
  relation_type: string
) {
  if (!is_multiple && preValue !== currentValue)
    return await updateRecords(currentValue, record_id, relation_type, true);
  if (!is_multiple && preValue === currentValue) return record_id;
  if (is_multiple && JSON.stringify(preValue) === JSON.stringify(currentValue))
    return record_id;
  const preArray: string[] = [];
  preValue.map((preSubrecord: SubRelatedRecord) =>
    preArray.push(preSubrecord.record_id)
  );
  const currentArray: string[] = [];
  currentValue.map((currentrecord: SubRelatedRecord) =>
    currentArray.push(currentrecord.record_id)
  );
  let is_added = true;
  let updated_value: SubRelatedRecord | null = null;
  if (preValue.length > currentValue.length) {
    //remove items in array
    for (const index in preArray) {
      if (!currentArray.includes(preArray[index])) {
        updated_value = preValue[index];
        is_added = false;
        if (updated_value !== null)
          await updateRecords(
            updated_value,
            record_id,
            relation_type,
            is_added
          );
      }
    }
  } else {
    for (const index in currentArray) {
      if (!preArray.includes(currentArray[index])) {
        updated_value = currentValue[index];
        if (updated_value !== null)
          await updateRecords(
            updated_value,
            record_id,
            relation_type,
            is_added
          );
      }
    }
  }
  return record_id;
}

async function updateRecords(
  child_record: SubRelatedRecord,
  record_id: string,
  relation_type: string,
  is_added: boolean
) {
  const {latest_record, revision_id} = await getRecordInformation(child_record);

  let parent = latest_record?.relationship;
  if (parent === undefined) parent = {};
  if (relation_type === 'Child')
    if (is_added)
      //add parent from child
      parent['parent'] = record_id;
    //remove parent from child
    else delete parent['parent'];
  else if (relation_type === 'Linked') {
    if (parent['linked'] === undefined) {
      if (is_added) parent['linked'] = [record_id];
    } else if (!parent['linked'].includes(record_id) && is_added) {
      //add the link item if not in record
      parent['linked'].push(record_id);
    } else if (parent['linked'].includes(record_id) && !is_added) {
      // remove the link item if it's in record
      const index = parent['linked'].indexOf(record_id);
      if (index > -1) {
        parent['linked'].splice(index, 1);
      }
    }
  }

  if (latest_record !== null) {
    const new_doc = latest_record;
    new_doc['relationship'] = parent;
    await upsertFAIMSData(child_record.project_id, new_doc);
  }
  return record_id;
}
