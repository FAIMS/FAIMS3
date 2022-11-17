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
 * Filename: RelatedInformation.tsx
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
  LocationState,
  Relationship,
} from '../../../../datamodel/core';
import * as ROUTES from '../../../../constants/routes';
import {RecordLinkProps, ParentLinkProps} from './types';
//get parent link when child record been open
export async function getParentLink_from_relationship(
  hrid: string,
  relatioship: any,
  record_id: string,
  project_id: string
) {
  const parent_record = {
    project_id: project_id,
    record_id: relatioship.parent.record_id,
    record_label: relatioship.parent.record_id,
  };
  const {latest_record, revision_id} = await getRecordInformation(
    parent_record
  );
  return {
    location_state: {
      field_id: relatioship.parent.field_id,
      parent: latest_record?.relationship?.parent,
      parent_link: ROUTES.getRecordRoute(
        project_id ?? '',
        (relatioship.parent.record_id || '').toString(),
        (revision_id || '').toString()
      ),
      parent_record_id: relatioship.parent.record_id,
      type: 'Child',
      // relation_type_vocabPair: relatioship.parent.relation_type_vocabPair,
    },
    latest_record: latest_record,
    revision_id: revision_id,
  };
}
export function getParentlinkInfo(
  hrid: string,
  RelationState: any,
  record_id: string
) {
  let is_direct = false;
  let state_parent: LocationState = {};

  if (RelationState === undefined || RelationState === null)
    return {state_parent, is_direct};
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
  if (state_parent.parent_record_id === state_parent.record_id)
    if (
      state_parent.parent === undefined ||
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
  let Relate_parent = RelationState;
  if (Relate_parent === undefined || Relate_parent === null) return parent;
  if (record_id === RelationState.parent_record_id)
    Relate_parent = RelationState.parent;
  if (Relate_parent === undefined || Relate_parent === null) return parent;
  if (Relate_parent.type === undefined) return parent;
  if (Relate_parent.type === 'Child')
    return {
      ...parent,
      parent: {
        record_id: Relate_parent.parent_record_id,
        field_id: Relate_parent.field_id,
        relation_type_vocabPair: ['Child', 'Parent'],
      },
    };
  if (Relate_parent.type === 'Linked') {
    if (parent['linked'] === undefined)
      parent['linked'] = [
        {
          record_id: Relate_parent.parent_record_id,
          field_id: Relate_parent.field_id,
          relation_type_vocabPair: Relate_parent.relation_type_vocabPair,
        },
      ];
    else if (
      !check_if_link_exist(
        parent['linked'],
        Relate_parent.parent_record_id,
        Relate_parent.field_id
      )
    )
      parent['linked'].push({
        record_id: Relate_parent.parent_record_id,
        field_id: Relate_parent.field_id,
        relation_type_vocabPair: Relate_parent.relation_type_vocabPair,
      });
    //get parent
    if (
      Relate_parent.parent !== undefined &&
      Relate_parent.parent.type === 'Child' &&
      Relate_parent.parent.parent_record_id !== record_id //check to confirm
    )
      parent['parent'] = {
        record_id: Relate_parent.parent.parent_record_id,
        field_id: Relate_parent.parent.field_id,
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

async function getRecordInformation(child_record: RecordReference) {
  let latest_record = null;
  let revision_id;
  if (child_record.project_id === undefined)
    return {latest_record, revision_id};
  try {
    revision_id = await getFirstRecordHead(
      child_record.project_id,
      child_record.record_id
    );
    latest_record = await getFullRecordData(
      child_record.project_id,
      child_record.record_id,
      revision_id
    );
  } catch (error) {
    throw Error('Error to get record information');
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
  const records: RecordLinkProps[] = [];
  if (child_records.length === 0) return records;
  const record_id = values['_id'];
  for (const index in child_records) {
    const child_record = child_records[index];

    if (child_record !== null && child_record.record_id !== undefined) {
      let relationLabel = child_record.relation_type_vocabPair;
      if (
        relationLabel === undefined ||
        relationLabel[0] === undefined ||
        relationLabel[0] === ''
      )
        relationLabel = relation_type_vocabPair;
      const hrid = values['hrid' + form_type] ?? record_id;
      try {
        const {latest_record, revision_id} = await getRecordInformation(
          child_record
        );

        if (latest_record !== null)
          child_record['record_label'] =
            latest_record.data['hrid' + related_type];
        if (revision_id !== undefined) {
          const child = generate_RecordLink(
            child_record,
            get_last_updated(
              latest_record?.updated_by ?? '',
              latest_record?.updated
            ),
            ROUTES.getRecordRoute(
              child_record.project_id ?? '',
              (child_record.record_id || '').toString(),
              (revision_id || '').toString()
            ),
            relationLabel,
            record_id,
            hrid,
            form_type ?? '',
            related_type_label ?? related_type,
            '',
            '',
            field_name,
            field_label,
            get_route_for_field(
              child_record.project_id,
              record_id,
              values['_current_revision_id']
            )
          );
          records.push(child);
        }
      } catch (error) {
        child_record['record_label'] =
          child_record['record_label'] ?? '' + '!!BROKEN';
        const child = generate_RecordLink(
          child_record,
          '',
          '',
          relationLabel,
          record_id,
          hrid,
          form_type ?? '',
          related_type_label ?? related_type,
          '',
          '',
          field_name,
          field_label,
          ''
        );
        records.push(child);
        console.error('Error to get child information', child_record.record_id);
      }
    }
  }
  return records;
}

function get_route_for_field(
  project_id: string,
  record_id: string,
  current_revision_id: string
) {
  try {
    return ROUTES.getRecordRoute(
      project_id ?? '',
      (record_id || '').toString(),
      (current_revision_id || '').toString()
    );
  } catch (error) {
    console.log('Parent Route not passed correctly', current_revision_id);
    return project_id + record_id + current_revision_id;
  }
}

function generate_RecordLink(
  child_record: RecordReference,
  lastUpdatedBy: string,
  child_route: string,
  linked_vocab: string[],
  record_id: string,
  hrid: string,
  form_type: string,
  type: string,
  section: string,
  section_label: string,
  field: string,
  field_label: string,
  link_route: string
): RecordLinkProps {
  const child: RecordLinkProps = {
    record_id: child_record.record_id,
    hrid: child_record.record_label,
    type: type,
    route: child_route,
    relation_type_vocabPair: linked_vocab,
    link: {
      record_id: record_id,
      hrid: hrid,
      type: form_type,
      route: link_route,
      section: section,
      section_label: section_label,
      field_id: field,
      field_label: field_label,
    },
    lastUpdatedBy: lastUpdatedBy,
  };
  if (child_record.is_preferred === true) child['relation_preferred'] = true;
  return child;
}

async function get_field_RelatedFields(
  ui_specification: ProjectUIModel,
  fields: fieldSet[],
  newfields: Array<RecordLinkProps>,
  record_id: string,
  form_type: string,
  hrid: string,
  relation_type: string,
  current_revision_id: string,
  is_display = false,
  displayFields: string[] = []
): Promise<Array<RecordLinkProps>> {
  for (const index in fields) {
    const field = fields[index]['field'];
    const child_record = fields[index]['value'];
    const related_type =
      ui_specification['fields'][field]['component-parameters']['related_type'];
    try {
      const {latest_record, revision_id} = await getRecordInformation(
        fields[index]['value']
      );
      if (latest_record !== null && revision_id !== undefined) {
        child_record['record_label'] =
          latest_record.data['hrid' + related_type];

        const linked_vocab =
          child_record['relation_type_vocabPair'] !== null &&
          child_record['relation_type_vocabPair'] !== undefined &&
          child_record['relation_type_vocabPair'].length > 0
            ? child_record['relation_type_vocabPair']
            : relation_type === 'Child'
            ? ['is child of', 'is parent of']
            : ['is related to', 'is related to'];
        const {section, section_label} = get_section(
          ui_specification,
          form_type,
          field
        );
        const child = generate_RecordLink(
          child_record,
          get_last_updated(
            latest_record?.updated_by ?? '',
            latest_record?.updated
          ),
          ROUTES.getRecordRoute(
            child_record.project_id ?? '',
            (child_record.record_id || '').toString(),
            (revision_id || '').toString()
          ),
          linked_vocab,
          record_id,
          hrid,
          form_type,
          ui_specification.viewsets[related_type]['label'] ?? related_type,
          section,
          section_label,
          field,
          get_field_label(ui_specification, field),
          get_route_for_field(
            child_record?.project_id ?? '',
            record_id,
            current_revision_id
          )
        );
        // get the displayed information for the child or link item, this is used by field
        if (is_display && latest_record !== null) {
          console.debug('display values', displayFields);
        }
        newfields.push(child);
      }
    } catch (error) {
      console.error('Error to get record information for field', field, error);
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
      const {section, section_label} = get_section(
        ui_specification,
        latest_record?.type ?? 'FORM1',
        parent_link.field_id
      );
      const child = generate_RecordLink(
        child_record,
        get_last_updated(
          latest_record?.updated_by ?? '',
          latest_record?.updated
        ),
        ROUTES.getRecordRoute(
          child_record.project_id ?? '',
          (child_record.record_id || '').toString(),
          (current_revision_id || '').toString()
        ),
        linked_vocab,
        parent_link.record_id,
        hrid,
        type ?? '',
        form_type,
        section,
        section_label,
        parent_link.field_id,
        get_field_label(ui_specification, parent_link.field_id),
        get_route_for_field(
          child_record.project_id,
          parent_link.record_id,
          revision_id ?? ''
        )
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
  let section_label = '';
  ui_specification['viewsets'][form_type]['views'].map((view: string) =>
    ui_specification['views'][view]['fields'].map((field: string) =>
      field === field_id ? (section = view) : field
    )
  );
  if (section === '') return {section, section_label};
  section_label = ui_specification['views'][section]['label'] ?? section;
  return {section, section_label};
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
      const persistentvalue: {[field_name: string]: any} = {};
      let type = latest_record?.type;

      //get persistent data from parent record not from local DB
      ui_specification.viewsets[type]['views'].map((view: string) =>
        ui_specification.views[view]['fields'].map((field: string) =>
          ui_specification.fields[field]['displayParent'] ||
          ui_specification.fields[field]['persistent']
            ? (persistentvalue[field] = latest_record?.data[field])
            : field
        )
      );

      // const data: Array<{[field_name: string]: any}> = [];

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
          persistentData: {data: persistentvalue},
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
function get_last_updated(updated_by: string, updated: Date | undefined) {
  if (updated === undefined) return updated_by;
  return (
    updated_by +
    ' at ' +
    JSON.stringify(updated)
      .replaceAll('"', '')
      .replaceAll('T', ' ')
      .slice(0, 19)
  );
}
export async function Update_New_Link(
  child_record: RecordReference,
  parent: LinkedRelation,
  field_label: string,
  related_type_label: string,
  form_type: string | undefined,
  hrid: string,
  form_revision_id: string | undefined,
  relation_type: string,
  relation_type_vocabPair: string[],
  is_add: boolean
): Promise<RecordLinkProps | null> {
  let new_child_record: RecordLinkProps = generate_RecordLink(
    child_record,
    '',
    '',
    relation_type_vocabPair,
    parent.record_id,
    hrid,
    form_type ?? '',
    related_type_label,
    '',
    '',
    parent.field_id,
    field_label,
    ''
  );

  try {
    const {latest_record, revision_id} = await getRecordInformation(
      child_record
    );
    let current_revision_id = revision_id;
    const relation = latest_record?.relationship ?? {};
    if (relation_type === 'Child' && is_add) relation['parent'] = parent;
    else if (relation_type === 'Linked' && is_add)
      relation['linked'] = AddLink(relation, parent);
    else if (relation_type === 'Child' && !is_add) delete relation.parent;
    else if (relation_type === 'Linked' && !is_add)
      relation['linked'] = RemoveLink(relation, parent);
    else {
      console.error('Error: not correct Type', relation_type);
      return null;
    }
    const now = new Date();
    if (latest_record !== null && child_record.project_id !== undefined) {
      const new_doc = latest_record;
      new_doc['relationship'] = relation;
      new_doc['updated'] = now;
      current_revision_id = await upsertFAIMSData(
        child_record.project_id,
        new_doc
      );
    }
    let route = ROUTES.getRecordRoute(
      child_record.project_id ?? '',
      (child_record.record_id || '').toString(),
      (current_revision_id || '').toString()
    );
    if (current_revision_id === undefined && is_add) return null;
    if (current_revision_id === undefined && !is_add) route = '';
    new_child_record = generate_RecordLink(
      child_record,
      get_last_updated(latest_record?.updated_by ?? '', now),
      route,
      relation_type_vocabPair,
      parent.record_id,
      hrid,
      form_type ?? '',
      related_type_label,
      '',
      '',
      parent.field_id,
      field_label,
      get_route_for_field(
        child_record.project_id ?? '',
        parent.record_id,
        form_revision_id ?? ''
      )
    );
  } catch (error) {
    console.error('Error to get child record', error);
  }

  return new_child_record;
}

export function remove_link_from_list(
  link_records: RecordLinkProps[],
  child_record: RecordLinkProps
) {
  if (link_records.length === 0) return link_records;
  const new_link_records: RecordLinkProps[] = [];
  link_records.map((linkRecord: RecordLinkProps) =>
    linkRecord.record_id !== child_record.record_id
      ? new_link_records.push(linkRecord)
      : linkRecord
  );
  return new_link_records;
}

export function AddLink(
  relation: Relationship,
  linked: LinkedRelation
): LinkedRelation[] {
  if (relation === undefined || relation.linked === undefined) return [linked];
  if (check_if_link_exist(relation.linked, linked.record_id, linked.field_id))
    return relation.linked;
  const new_linked = relation.linked;
  new_linked.push(linked);
  return new_linked;
}

export function RemoveLink(relation: Relationship, linked: LinkedRelation) {
  if (relation === undefined || relation.linked === undefined) return [];

  const new_linked: LinkedRelation[] = [];
  relation['linked'].map((linkRecord: LinkedRelation) => {
    !(
      linkRecord.record_id === linked.record_id &&
      linkRecord.field_id === linked.field_id
    )
      ? new_linked.push(linkRecord)
      : linkRecord;
  });
  return new_linked;
}
