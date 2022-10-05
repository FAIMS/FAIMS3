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
import {
  LinkedRelation,
  DEFAULT_REALTION_LINK_VOCAB,
} from '../../../../datamodel/core';
import * as ROUTES from '../../../../constants/routes';
import {RelatedType} from './types';
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
    relation_type_vocabPair: RelationState.relation_type_vocabPair,
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
        relation_type_vocabPair: RelationState.parent.relation_type_vocabPair,
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

const check_if_link_exist = (
  linkRecords: Array<LinkedRelation>,
  parent_record_id: string,
  field_id: string
) => {
  //get all linked record_id
  if (linkRecords.length === 0) return false;
  let is_linked = false;
  linkRecords.map((linkRecord: LinkedRelation) =>
    linkRecord.record_id === parent_record_id &&
    linkRecord.field_id === field_id
      ? (is_linked = true)
      : linkRecord
  );
  return is_linked;
};

//function to get parent/to be linked information to save in the child
export function getParentInfo(
  RelationState: any,
  parent: Relationship,
  record_id: string
) {
  let Relate_perant = RelationState;
  if (Relate_perant === undefined || Relate_perant === null) return parent;
  if (record_id === RelationState.parent_record_id)
    Relate_perant = RelationState.parent;
  if (Relate_perant === undefined || Relate_perant === null) return parent;
  if (Relate_perant.type === undefined) return parent;
  if (Relate_perant.type === 'Child')
    return {...parent, parent: Relate_perant.parent_record_id};
  if (Relate_perant.type === 'Linked') {
    if (parent['linked'] === undefined)
      parent['linked'] = [
        {
          record_id: Relate_perant.parent_record_id,
          field_id: Relate_perant.field_id,
          relation_type_vocabPair: Relate_perant.relation_type_vocabPair,
        },
      ];
    else if (
      !check_if_link_exist(
        parent['linked'],
        Relate_perant.parent_record_id,
        Relate_perant.field_id
      )
    )
      parent['linked'].push({
        record_id: Relate_perant.parent_record_id,
        field_id: Relate_perant.field_id,
        relation_type_vocabPair: Relate_perant.relation_type_vocabPair,
      });
    //get parnet
    if (
      Relate_perant.parent !== undefined &&
      Relate_perant.parent.type === 'Child' &&
      Relate_perant.parent.parent_record_id !== record_id //check to confirm
    )
      parent['parent'] = Relate_perant.parent.parent_record_id;
  }
  return parent;
}
type SubRelatedRecord = {
  project_id: string;
  record_id: string;
  record_label: string;
  relation_type_vocabPair?: string[] | null;
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
      relation_type_vocabPair: child_state.relation_type_vocabPair ?? null,
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
    console.error('Error to get related value of fields', err);
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
  values: {[field_name: string]: any},
  record_id: string
) {
  const ui_specification = await getUiSpecForProject(project_id);
  let fields: fieldSet[] = [];
  fields = get_related_valued_field(ui_specification, field, values, fields);
  const type =
    ui_specification['fields'][field]['component-parameters']['related_type'];
  const dispalyFields = get_displayed_fields(ui_specification, type);
  const form_type = 'FORM1'; // this value will not been used
  let hrid = values['hrid' + form_type] ?? record_id;
  if (hrid === ' ') hrid = record_id;

  const records = await addRelatedFields(
    ui_specification,
    fields,
    [],
    record_id,
    form_type,
    hrid,
    ui_specification['fields'][field]['component-parameters'][
      'relation_type'
    ].replace('faims-core::', ''),
    true,
    dispalyFields
  );
  return records;
}
async function addRelatedFields(
  ui_specification: ProjectUIModel,
  fields: fieldSet[],
  newfields: Array<any>,
  record_id: string,
  form_type: string,
  hrid: string,
  reation_type: string,
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

    // let children: Array<RecordProps> = [];
    if (latest_record !== null && revision_id !== undefined) {
      //add and defined the child/link item when the inforamtion been added correctly
      const {fields_child, fields_linked} = get_related_valued_fields(
        ui_specification,
        type,
        latest_record?.data
      );
      // children = await addRelatedFields(
      //   ui_specification,
      //   fields_child,
      //   children
      // );

      const childRecord = fields[index]['value'];

      const linked_vocab =
        childRecord['relation_type_vocabPair'] !== null &&
        childRecord['relation_type_vocabPair'] !== undefined
          ? childRecord['relation_type_vocabPair']
          : reation_type === 'Child'
          ? ['Child', 'Parent']
          : ['is related to', 'is related to'];

      const child: {[field_name: string]: any} = {
        recordA_id: record_id,
        recordA_hrid: hrid,
        recordA_type: form_type,
        recordA_section: get_section(ui_specification, form_type, field),
        recordA_field_id: field,
        recordA_field_label: get_field_label(ui_specification, field),

        recordB_id: fields[index]['value'].record_id,
        recordB_hrid: fields[index]['value'].record_label,
        recordB_type: ui_specification.viewsets[type]['label'],
        recordB_route: ROUTES.getRecordRoute(
          fields[index]['value'].project_id,
          (fields[index]['value'].record_id || '').toString(),
          (revision_id || '').toString()
        ),
        recordB_lastUpdatedBy: latest_record?.updated_by ?? '',
        relation_type_vocabPair: linked_vocab,
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
  parent: Relationship | null,
  record_id: string,
  form_type: string,
  hrid: string
) {
  //add linked from fields
  if (fields.length > 0)
    newfields = await addRelatedFields(
      ui_specification,
      fields,
      newfields,
      record_id,
      form_type,
      hrid,
      'Linked'
    );

  //add linked from parent
  if (
    parent !== null &&
    parent.linked !== undefined &&
    parent.linked.length > 0
  ) {
    for (const index in parent.linked) {
      const record_id = parent.linked[index]['record_id'];
      const {latest_record, revision_id} = await getRecordInformation({
        project_id: project_id,
        record_id: record_id,
        record_label: record_id,
      });
      let type = latest_record?.type;
      let hrid = record_id;
      if (
        latest_record !== null &&
        latest_record.data['hrid' + type] !== undefined
      )
        hrid = latest_record?.data['hrid' + type] ?? record_id;
      if (type !== undefined) type = ui_specification.viewsets[type]['label'];

      const linked_vocab =
        parent.linked[index]['relation_type_vocabPair'] !== null &&
        parent.linked[index]['relation_type_vocabPair'] !== undefined
          ? parent.linked[index]['relation_type_vocabPair']
          : ['is related to', 'is related to'];

      const child: {[field_name: string]: any} = {
        recordA_id: parent.linked[index]['record_id'],
        recordA_hrid: parent.linked[index]['record_id'],
        recordA_type: form_type,
        recordA_section: get_section(
          ui_specification,
          latest_record?.type ?? 'FORM1',
          parent.linked[index]['field_id']
        ),
        recordA_field_id: parent.linked[index]['field_id'],
        recordA_field_label: get_field_label(
          ui_specification,
          parent.linked[index]['field_id']
        ),

        recordB_id: record_id,
        recordB_hrid: hrid,
        recordB_type: type,
        recordB_route: ROUTES.getRecordRoute(
          project_id,
          (record_id || '').toString(),
          (revision_id || '').toString()
        ),
        recordB_lastUpdatedBy: latest_record?.updated_by ?? '',
        relation_type_vocabPair: linked_vocab,
      };
      newfields.push(child);
    }
  }

  return newfields;
}

function get_section(
  ui_specification: ProjectUIModel,
  form_type: string,
  field_id: string
) {
  let section = '';
  ui_specification['viewsets'][form_type]['views'].map((view: string) =>
    ui_specification['views'][view]['fields'].map((field: string) =>
      field === field_id ? (section = view) : field
    )
  );
  if (section === '') return section;
  section = ui_specification['views'][section]['label'] ?? '';
  return section;
}

function get_field_label(ui_specification: ProjectUIModel, field: string) {
  if (
    ui_specification['fields'][field]['component-parameters'][
      'InputLabelProps'
    ]['label']
  )
    return ui_specification['fields'][field]['component-parameters'][
      'InputLabelProps'
    ]['label'];
  return field;
}

export async function getDetailRelatedInfommation(
  ui_specification: ProjectUIModel,
  form_type: string,
  values: {[field_name: string]: any},
  project_id: string,
  parent: Relationship | null,
  record_id: string
): Promise<RelatedType> {
  const childrecords: RelatedType = {
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

  let hrid = values['hrid' + form_type] ?? record_id;
  if (hrid === ' ') hrid = record_id;

  if (childrecords['childRecords'] !== null && fields_child.length > 0)
    childrecords['childRecords'] = await addRelatedFields(
      ui_specification,
      fields_child,
      childrecords['childRecords'],
      record_id,
      form_type,
      hrid,
      'Child'
    );
  childrecords['linkRecords'] = await addLinkedRecord(
    ui_specification,
    fields_linked,
    [],
    project_id,
    parent,
    record_id,
    form_type,
    hrid
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
      let type = latest_record?.type;
      let parent_hrid = latest_record?.data['hrid' + type] ?? record_id;
      if (parent_hrid === ' ') parent_hrid = record_id;
      if (
        latest_record !== null &&
        type !== undefined &&
        ui_specification.viewsets[type] !== undefined &&
        ui_specification.viewsets[type]['label'] !== undefined
      )
        type = ui_specification.viewsets[type]['label'] ?? '';

      childrecords['parentRecords'] = [
        {
          record_id: parent.parent,
          hrid: parent_hrid,
          lastUpdatedBy: latest_record?.updated_by ?? '',
          section: '',
          field_id: '',
          field_label: '',
          route: ROUTES.getRecordRoute(
            project_id,
            (parent.parent || '').toString(),
            (revision_id || '').toString()
          ),
          type: type,
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
      relation_type,
      field
    );
  }
}

async function updateChildRecord(
  preValue: any,
  currentValue: any,
  is_multiple: boolean,
  record_id: string,
  relation_type: string,
  field_id: string
) {
  if (!is_multiple && preValue !== currentValue)
    return await updateRecords(
      currentValue,
      record_id,
      relation_type,
      true,
      field_id
    );
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
            is_added,
            field_id
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
            is_added,
            field_id
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
  is_added: boolean,
  field_id: string
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
      if (is_added)
        parent['linked'] = [
          {
            record_id: record_id,
            field_id: field_id,
            relation_type_vocabPair: child_record.relation_type_vocabPair ?? [
              DEFAULT_REALTION_LINK_VOCAB,
              DEFAULT_REALTION_LINK_VOCAB,
            ],
          },
        ];
    } else if (
      !check_if_link_exist(parent['linked'], record_id, field_id) &&
      is_added
    ) {
      //add the link item if not in record
      parent['linked'].push({
        record_id: record_id,
        field_id: field_id,
        relation_type_vocabPair: child_record.relation_type_vocabPair ?? [
          DEFAULT_REALTION_LINK_VOCAB,
          DEFAULT_REALTION_LINK_VOCAB,
        ],
      });
    } else if (
      check_if_link_exist(parent['linked'], record_id, field_id) &&
      !is_added
    ) {
      // remove the link item if it's in record
      parent['linked'].map((linkRecord: LinkedRelation, index: number) => {
        if (
          linkRecord.record_id === record_id &&
          linkRecord.field_id === field_id &&
          parent !== undefined &&
          parent['linked'] !== undefined
        )
          parent['linked'].splice(index, 1);
      });
    }
  }

  if (latest_record !== null) {
    const new_doc = latest_record;
    new_doc['relationship'] = parent;
    await upsertFAIMSData(child_record.project_id, new_doc);
  }
  return record_id;
}

export async function deleteLinkedRecord(
  child_record: SubRelatedRecord,
  record_id: string,
  relation_type: string,
  field_id: string
) {
  const {latest_record, revision_id} = await getRecordInformation(child_record);
  const parent = latest_record?.relationship;
  if (
    parent === undefined ||
    parent['linked'] === undefined ||
    latest_record === null
  )
    return true; // return when the link is not exist
  // remove the link for linked record
  const if_exist = check_if_link_exist(parent['linked'], record_id, field_id);
  if (!if_exist) return true; // return when the link is not exist
  if (parent['linked'] !== undefined && if_exist) {
    // remove the link item if it's in record
    parent['linked'].map((linkRecord: LinkedRelation, index: number) => {
      if (
        linkRecord.record_id === record_id &&
        linkRecord.field_id === field_id &&
        parent !== undefined &&
        parent['linked'] !== undefined
      )
        parent['linked'].splice(index, 1);
    });

    const new_doc = latest_record;
    new_doc['relationship'] = parent;
    await upsertFAIMSData(child_record.project_id, new_doc);
  }

  //remove the information from current form field??

  return true;
}
