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
import {
  upsertFAIMSData,
  getFullRecordData,
  getFirstRecordHead,
} from '../../../../data_storage';
import {ProjectUIModel, RecordReference} from '../../../../datamodel/ui';
import {
  LinkedRelation,
  DEFAULT_REALTION_LINK_VOCAB,
  LocationState,
  Relationship,
} from '../../../../datamodel/core';
import * as ROUTES from '../../../../constants/routes';
import {RecordLinkProps, ParentLinkProps} from './types';
import {get_fieldpersistentdata} from '../../../../datamodel/fieldpersistent';
export function getParentlinkInfo(
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
): Relationship {
  let Relate_perant = RelationState;
  if (Relate_perant === undefined || Relate_perant === null) return parent;
  if (record_id === RelationState.parent_record_id)
    Relate_perant = RelationState.parent;
  if (Relate_perant === undefined || Relate_perant === null) return parent;
  if (Relate_perant.type === undefined) return parent;
  if (Relate_perant.type === 'Child')
    return {
      ...parent,
      parent: {
        record_id: Relate_perant.parent_record_id,
        field_id: Relate_perant.field_id,
        relation_type_vocabPair: ['Child', 'Parent'],
      },
    };
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
      parent['parent'] = {
        record_id: Relate_perant.parent.parent_record_id,
        field_id: Relate_perant.parent.field_id,
        relation_type_vocabPair: [],
      };
  }
  return parent;
}
//function to get child/linked information to save in parent
export function getChildInfo(child_state: any, project_id: string) {
  let is_related = false;
  let field_id = '';
  let new_record: RecordReference | null = null;
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

async function getRecordInformation(childrecord: RecordReference) {
  let latest_record = null;
  let revision_id;
  if (childrecord.project_id === undefined) return {latest_record, revision_id};
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
  value: RecordReference;
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
      values[field].map((value: RecordReference) => {
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
export async function get_RelatedFields_for_field(
  values: {[field_name: string]: any},
  related_type: string,
  relation_type_vocabPair: Array<string>,
  field_name: string,
  field_label: string,
  multiple: boolean,
  related_type_label: string | undefined,
  form_type: string | undefined
) {
  const child_records = multiple ? values[field_name] : [values[field_name]];
  const record_id = values['_id'];
  const records: RecordLinkProps[] = [];
  for (const index in child_records) {
    const child_record = child_records[index];
    const {latest_record, revision_id} = await getRecordInformation(
      child_record
    );
    if (child_record.record_id !== undefined) {
      let relationLabel = child_record.relation_type_vocabPair;
      if (
        relationLabel === undefined ||
        relationLabel[0] === undefined ||
        relationLabel[0] === ''
      )
        relationLabel = relation_type_vocabPair;
      const hrid = values['hrid' + form_type] ?? record_id;
      if (revision_id !== undefined) {
        const child = generate_RecordLink(
          child_record,
          latest_record?.updated_by ?? '',
          revision_id,
          relationLabel,
          record_id,
          hrid,
          form_type ?? '',
          related_type_label ?? related_type,
          field_name,
          '',
          field_label,
          values['_current_revision_id']
        );

        records.push(child);
      }
    }
  }
  return records;
}

function generate_RecordLink(
  chid_record: RecordReference,
  lastUpdatedBy: string,
  revision_id: string,
  linked_vocab: string[],
  record_id: string,
  hrid: string,
  form_type: string,
  type: string,
  section: string,
  field: string,
  field_label: string,
  current_revision_id: string
): RecordLinkProps {
  const child: RecordLinkProps = {
    record_id: chid_record.record_id,
    hrid: chid_record.record_label,
    type: type,
    route: ROUTES.getRecordRoute(
      chid_record.project_id ?? '',
      (chid_record.record_id || '').toString(),
      (revision_id || '').toString()
    ),
    relation_type_vocabPair: linked_vocab,
    link: {
      record_id: record_id,
      hrid: hrid,
      type: form_type,
      route: ROUTES.getRecordRoute(
        chid_record.project_id ?? '',
        (record_id || '').toString(),
        (current_revision_id || '').toString()
      ), //chid_record.project_id+ current_revision_id,
      section: section,
      field_id: field,
      field_label: field_label,
    },
    lastUpdatedBy: lastUpdatedBy,
  };
  return child;
}

async function get_field_RelatedFields(
  ui_specification: ProjectUIModel,
  fields: fieldSet[],
  newfields: Array<RecordLinkProps>,
  record_id: string,
  form_type: string,
  hrid: string,
  reation_type: string,
  current_revision_id: string,
  is_dispaly = false,
  dispalyFields: string[] = []
): Promise<Array<RecordLinkProps>> {
  for (const index in fields) {
    const field = fields[index]['field'];
    const {latest_record, revision_id} = await getRecordInformation(
      fields[index]['value']
    );
    const type =
      ui_specification['fields'][field]['component-parameters']['related_type'];

    // let children: Array<RecordProps> = [];
    if (latest_record !== null && revision_id !== undefined) {
      const childRecord = fields[index]['value'];

      const linked_vocab =
        childRecord['relation_type_vocabPair'] !== null &&
        childRecord['relation_type_vocabPair'] !== undefined &&
        childRecord['relation_type_vocabPair'].length > 0
          ? childRecord['relation_type_vocabPair']
          : reation_type === 'Child'
          ? ['is child of', 'is parent of']
          : ['is related to', 'is related to'];

      const child = generate_RecordLink(
        fields[index]['value'],
        latest_record?.updated_by ?? '',
        revision_id,
        linked_vocab,
        record_id,
        hrid,
        form_type,
        ui_specification.viewsets[type]['label'] ?? type,
        get_section(ui_specification, form_type, field),
        field,
        get_field_label(ui_specification, field),
        current_revision_id
      );
      // get the displayed information for the child or link item, this is used by field
      if (is_dispaly && latest_record !== null) {
        console.debug('display values', dispalyFields);
      }
      newfields.push(child);
    }
  }
  return newfields;
}

export async function addLinkedRecord(
  ui_specification: ProjectUIModel,
  newfields: Array<RecordLinkProps>,
  project_id: string,
  parent: Relationship | null,
  record_id: string,
  form_type: string,
  child_hrid: string,
  current_revision_id: string
): Promise<Array<RecordLinkProps>> {
  let parent_links: Array<LinkedRelation> = [];
  //add linked from parent
  if (
    parent !== null &&
    parent.linked !== undefined &&
    parent.linked.length > 0
  )
    parent_links = parent.linked;
  //get parent from parent
  if (parent !== null && parent.parent !== undefined) {
    parent_links.push({
      ...parent.parent,
      relation_type_vocabPair: ['is child of', 'is parent of'],
    });
  }

  for (const index in parent_links) {
    const parent_link = parent_links[index];
    const {latest_record, revision_id} = await getRecordInformation({
      project_id: project_id,
      record_id: parent_link.record_id,
      record_label: parent_link.record_id,
    });
    if (revision_id !== undefined) {
      const child_record = {
        project_id: project_id,
        record_id: record_id,
        record_label: child_hrid,
      };
      const linked_vocab =
        parent_link['relation_type_vocabPair'] !== null &&
        parent_link['relation_type_vocabPair'] !== undefined &&
        parent_link['relation_type_vocabPair'].length > 0
          ? parent_link['relation_type_vocabPair']
          : ['is related to', 'is related to'];
      let type = latest_record?.type;
      let hrid = record_id;
      if (
        latest_record !== null &&
        latest_record.data['hrid' + type] !== undefined
      )
        hrid = latest_record?.data['hrid' + type] ?? record_id;
      if (type !== undefined) type = ui_specification.viewsets[type]['label'];
      const child = generate_RecordLink(
        child_record,
        latest_record?.updated_by ?? '',
        current_revision_id,
        linked_vocab,
        parent_link.record_id,
        hrid,
        type ?? '',
        form_type,
        get_section(
          ui_specification,
          latest_record?.type ?? 'FORM1',
          parent_link.field_id
        ),
        parent_link.field_id,
        get_field_label(ui_specification, parent_link.field_id),
        revision_id
      );
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

export async function getParentPersistenceData(
  ui_specification: ProjectUIModel,
  project_id: string,
  parent: Relationship | null,
  record_id: string
): Promise<ParentLinkProps[]> {
  let parentRecords: ParentLinkProps[] = [];
  if (parent !== null && parent.parent !== undefined) {
    const {latest_record, revision_id} = await getRecordInformation({
      project_id: project_id,
      record_id: parent.parent.record_id,
      record_label: parent.parent.record_id,
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

      parentRecords = [
        {
          record_id: parent.parent.record_id,
          hrid: parent_hrid,
          lastUpdatedBy: latest_record?.updated_by ?? '',
          section: '',
          field_id: parent.parent.field_id,
          field_label: parent.parent.field_id,
          route: ROUTES.getRecordRoute(
            project_id,
            (parent.parent.record_id || '').toString(),
            (revision_id || '').toString()
          ),
          type: type,
          children: [],
          persistentData: persistentvalue,
        },
      ];
    }
  }
  return parentRecords;
}

export async function getDetailRelatedInformation(
  ui_specification: ProjectUIModel,
  form_type: string,
  values: {[field_name: string]: any},
  project_id: string,
  parent: Relationship | null,
  record_id: string,
  current_revision_id: string
): Promise<RecordLinkProps[]> {
  let record_to_field_links: RecordLinkProps[] = [];
  // get fields that are related field
  const {fields_child, fields_linked} = get_related_valued_fields(
    ui_specification,
    form_type,
    values
  );

  let hrid = values['hrid' + form_type] ?? record_id;
  if (hrid === ' ') hrid = record_id;

  if (record_to_field_links !== null) {
    // get field child records
    record_to_field_links = await get_field_RelatedFields(
      ui_specification,
      fields_child,
      record_to_field_links,
      record_id,
      form_type,
      hrid,
      'Child',
      current_revision_id
    );
    //get field linked records
    record_to_field_links = await get_field_RelatedFields(
      ui_specification,
      fields_linked,
      record_to_field_links,
      record_id,
      form_type,
      hrid,
      'Linked',
      current_revision_id
    );
    // get parent linked information
    record_to_field_links = await addLinkedRecord(
      ui_specification,
      record_to_field_links,
      project_id,
      parent,
      record_id,
      form_type,
      hrid,
      current_revision_id
    );
  }
  //get information for parent
  return record_to_field_links;
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
  preValue.map((preSubrecord: RecordReference) =>
    preArray.push(preSubrecord.record_id)
  );
  const currentArray: string[] = [];
  currentValue.map((currentrecord: RecordReference) =>
    currentArray.push(currentrecord.record_id)
  );
  let is_added = true;
  let updated_value: RecordReference | null = null;
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
  child_record: RecordReference,
  record_id: string,
  relation_type: string,
  is_added: boolean,
  field_id: string
) {
  const {latest_record, revision_id} = await getRecordInformation(child_record);
  console.debug('Get current revision id', revision_id);
  let parent = latest_record?.relationship;
  if (parent === undefined) parent = {};
  if (relation_type === 'Child')
    if (is_added)
      //add parent from child
      parent['parent'] = {
        record_id: record_id,
        field_id: field_id,
        relation_type_vocabPair: [],
      };
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

  if (latest_record !== null && child_record.project_id !== undefined) {
    const new_doc = latest_record;
    new_doc['relationship'] = parent;
    await upsertFAIMSData(child_record.project_id, new_doc);
  }
  return record_id;
}

// const {
//   record_id: record_id,
//   field_id: field_id,
//   relation_type_vocabPair: [],
// }
export function AddParent(relation: Relationship, parent: LinkedRelation) {
  return {...relation, parent: parent};
}

export function RemoveParent(relation: Relationship) {
  const newparent = relation;
  if (newparent.parent !== undefined) delete newparent.parent;
  return newparent;
}

export function AddLink(relation: Relationship, linked: LinkedRelation) {
  if (relation === undefined) return {linked: [linked]};
  if (relation.linked === undefined) return {...relation, linked: [linked]};
  if (check_if_link_exist(relation.linked, linked.record_id, linked.field_id))
    return relation;
  return {...relation, linked: relation.linked.push(linked)};
}

export function RemoveLink(relation: Relationship, linked: LinkedRelation) {
  if (relation === undefined) return relation;
  if (relation.linked === undefined) return relation;
  if (!check_if_link_exist(relation.linked, linked.record_id, linked.field_id))
    return relation;
  const newlinked = relation['linked'];
  newlinked.map((linkRecord: LinkedRelation, index: number) => {
    if (
      linkRecord.record_id === linked.record_id &&
      linkRecord.field_id === linked.field_id &&
      newlinked !== undefined
    )
      newlinked.splice(index, 1);
  });
  return {...relation, linked: newlinked};
}
