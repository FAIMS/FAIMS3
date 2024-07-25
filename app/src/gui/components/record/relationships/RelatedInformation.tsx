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
  ProjectUIModel,
  RecordReference,
  LinkedRelation,
  LocationState,
  Relationship,
} from 'faims3-datamodel';
import * as ROUTES from '../../../../constants/routes';
import {RecordLinkProps, ParentLinkProps} from './types';
import getLocalDate from '../../../fields/LocalDate';
import {logError} from '../../../../logging';

/**
 * Generate an object containing information to be stored in
 *   `location.state` to persist between page views.
 * @param parentLink - details of the linked (parent) record
 * @param project_id - current project id
 * @returns {location_state, latest_record, revision_id}
 */
export async function generateLocationState(
  parentLink: LinkedRelation,
  project_id: string
) {
  const parent_record = {
    project_id: project_id,
    record_id: parentLink.record_id,
    record_label: parentLink.record_id,
  };
  const {latest_record, revision_id} = await getRecordInformation(
    parent_record
  );
  return {
    location_state: {
      field_id: parentLink.field_id,
      parent: latest_record?.relationship?.parent,
      parent_link: ROUTES.getRecordRoute(
        project_id ?? '',
        (parentLink.record_id || '').toString(),
        (revision_id || '').toString()
      ),
      parent_record_id: parentLink.record_id,
      type: 'Child',
      // relation_type_vocabPair: relationship.parent.relation_type_vocabPair,
    },
    latest_record: latest_record,
    revision_id: revision_id,
  };
}

/**
 * getParentLinkInfo - get information about whether a new record is a child of some parent record
 * @param hrid - the HRID or revision_id of a record
 * @param relationState - stored relation state
 * @param record_id - the id of the record
 * @returns {state_parent, is_direct} - `is_direct` is true if the record is a child record, false if
 *          not.  `state_parent` contains details about the parent record or `{}` if none.
 */
export function getParentLinkInfo(
  hrid: string,
  relationState: any,
  record_id: string
) {
  let is_direct = false;
  let state_parent: LocationState = {};

  if (relationState === undefined || relationState === null)
    return {state_parent, is_direct};
  if (relationState.field_id !== undefined) is_direct = true;

  state_parent = {
    field_id: relationState.field_id,
    record_id: record_id,
    hrid: hrid,
    parent: relationState.parent,
    parent_link: relationState.parent_link,
    parent_record_id: relationState.parent_record_id,
    type: relationState.type,
    relation_type_vocabPair: relationState.relation_type_vocabPair,
  };
  //check if the parent exists in the relationState record
  if (
    relationState.parent !== undefined &&
    relationState.parent.field_id !== undefined
  ) {
    if (
      record_id === relationState.parent_record_id &&
      relationState.parent.parent !== undefined
    ) {
      state_parent = {
        field_id: relationState.parent.field_id,
        record_id: record_id,
        hrid: hrid,
        parent: relationState.parent.parent,
        parent_link: relationState.parent.parent_link,
        parent_record_id: relationState.parent.parent_record_id,
        type: relationState.parent.type,
        relation_type_vocabPair: relationState.parent.relation_type_vocabPair,
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

/**
 * Generate a Relationship object to represent a relation between records
 * @param location_state - existing location.state object
 * @param parent - details of parent relationship
 * @param record_id - current record id
 * @returns a Relationship object
 */
export function generateRelationship(
  location_state: any,
  parent: Relationship,
  record_id: string
): Relationship {
  let state = location_state;
  if (state === undefined || state === null) return parent;
  if (record_id === location_state.parent_record_id)
    state = location_state.parent;
  if (state === undefined || state === null) return parent;
  if (state.type === undefined) return parent;
  if (state.type === 'Child')
    return {
      ...parent,
      parent: {
        record_id: state.parent_record_id,
        field_id: state.field_id,
        relation_type_vocabPair: ['Child', 'Parent'],
      },
    };
  if (state.type === 'Linked') {
    if (parent['linked'] === undefined)
      parent['linked'] = [
        {
          record_id: state.parent_record_id,
          field_id: state.field_id,
          relation_type_vocabPair: state.relation_type_vocabPair,
        },
      ];
    else if (
      !linkExists(parent['linked'], state.parent_record_id, state.field_id)
    )
      parent['linked'].push({
        record_id: state.parent_record_id,
        field_id: state.field_id,
        relation_type_vocabPair: state.relation_type_vocabPair,
      });
    //get parent
    if (
      state.parent !== undefined &&
      state.parent.type === 'Child' &&
      state.parent.parent_record_id !== record_id //check to confirm
    )
      parent['parent'] = {
        record_id: state.parent.parent_record_id,
        field_id: state.parent.field_id,
        relation_type_vocabPair: [],
      };
  }
  return parent;
}

/**
 * Check whether a link exists to a parent
 * @param linkRecords - an array of link records
 * @param parent_record_id - parent record
 * @param field_id - relation field id
 * @returns true if there is a link to this record
 */
const linkExists = (
  linkRecords: Array<LinkedRelation>,
  parent_record_id: string,
  field_id: string
) => {
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
      revision_id,
      false
    );
  } catch (error) {
    throw Error('Error to get record information' + child_record.project_id);
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
    logError(err); // Error to get related value of fields
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
  form_type: string | undefined,
  realtion_type: string
) {
  const child_records = multiple ? values[field_name] : [values[field_name]];
  const records: RecordLinkProps[] = [];
  if (child_records && child_records.length === 0) return records;
  const record_id = values['_id'];
  for (const index in child_records) {
    const child_record = child_records[index];

    if (child_record && child_record.record_id) {
      let relationLabel = child_record.relation_type_vocabPair;
      if (
        relationLabel === undefined ||
        relationLabel[0] === undefined ||
        relationLabel[0] === ''
      )
        relationLabel = relation_type_vocabPair;
      const hrid = getHRIDValue(record_id, values);
      try {
        const {latest_record, revision_id} = await getRecordInformation(
          child_record
        );

        if (latest_record !== null)
          child_record['record_label'] = getHRIDValue(
            child_record['record_id'],
            latest_record.data
          );

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
            ),
            realtion_type,
            latest_record?.deleted ?? false
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
          '',
          realtion_type
        );
        records.push(child);
        logError(error);
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
  link_route: string,
  relation_type: string,
  record_deleted = false,
  parent_deleted = false
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
      deleted: parent_deleted,
    },
    lastUpdatedBy: lastUpdatedBy,
    deleted: record_deleted,
    relation_type: relation_type,
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
  current_revision_id: string
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
        child_record['record_label'] = getHRIDValue(
          child_record['record_id'],
          latest_record.data
        );

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
        const {field_name, is_deleted} = get_field_label(
          ui_specification,
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
          field_name,
          get_route_for_field(
            child_record?.project_id ?? '',
            record_id,
            current_revision_id
          ),
          relation_type,
          latest_record?.deleted ?? false,
          is_deleted
        );
        newfields.push(child);
      }
    } catch (error) {
      logError(error);
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
  let has_parent = false;
  if (parent !== null && parent.parent !== undefined) {
    has_parent = true;
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
      const hrid = getHRIDValue(parent_link.record_id, latest_record?.data);

      if (type !== undefined) type = ui_specification.viewsets[type]['label'];
      const {section, section_label} = get_section(
        ui_specification,
        latest_record?.type ?? 'FORM1',
        parent_link.field_id
      );
      const {field_name, is_deleted} = get_field_label(
        ui_specification,
        parent_link.field_id
      );
      const is_parent_deleted =
        latest_record?.deleted === true ? true : is_deleted;
      const child = generate_RecordLink(
        child_record,
        get_last_updated(
          latest_record?.updated_by ?? '',
          latest_record?.updated
        ),
        latest_record?.deleted === true
          ? ''
          : ROUTES.getRecordRoute(
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
        field_name,
        latest_record?.deleted === true
          ? ''
          : get_route_for_field(
              child_record.project_id,
              parent_link.record_id,
              revision_id ?? ''
            ),
        has_parent === true && index === '0' ? 'Child' : 'Linked',
        false,
        is_parent_deleted
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
  //TODO:if field not exist, should the link be deleted??? Currently it's saved
  let field_name = field;
  let is_deleted = false;
  if (ui_specification['fields'][field] === undefined) {
    is_deleted = true;
    return {field_name, is_deleted};
  }
  try {
    if (
      ui_specification['fields'][field]['component-parameters'][
        'InputLabelProps'
      ]['label']
    )
      field_name =
        ui_specification['fields'][field]['component-parameters'][
          'InputLabelProps'
        ]['label'];
    return {field_name, is_deleted};
  } catch (error) {
    logError(error);
    return {field_name, is_deleted};
  }
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

      const parent_hrid = getHRIDValue(record_id, latest_record?.data);

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
          deleted: latest_record?.deleted,
        },
      ];
    }
  }
  return parentRecords;
}

function getHRIDValue(
  record_id: string,
  values: {[field_name: string]: any} | undefined
) {
  if (values === undefined) return record_id;

  const possibleHRIDFields = Object.getOwnPropertyNames(values).filter(
    (f: string) => f.startsWith('hrid')
  );

  if (possibleHRIDFields.length === 1) return values[possibleHRIDFields[0]];
  else return record_id;
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

  const hrid = getHRIDValue(record_id, values);

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
  const update_time = getLocalDate(updated).replace('T', ' ');
  return updated_by + ' at ' + update_time;
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
    '',
    relation_type
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
      logError(`Error: unknown relation type ${relation_type}`);
      return null;
    }
    const now = new Date();
    if (
      latest_record !== null &&
      child_record.project_id !== undefined &&
      latest_record.deleted !== true
    ) {
      const new_doc = latest_record;
      new_doc['relationship'] = relation;
      new_doc['updated'] = now;
      new_doc['deleted'] = latest_record.deleted;
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
      ),
      relation_type
    );
  } catch (error) {
    logError(error);
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
  if (linkExists(relation.linked, linked.record_id, linked.field_id))
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

export async function check_if_record_relationship(
  relationA: Relationship | null | undefined,
  relationB: Relationship | null | undefined,
  project_id: string,
  record_id: string
) {
  const new_relation: Relationship = {};
  const parentA = await check_parent(relationA, project_id, record_id);
  if (parentA !== null) new_relation['parent'] = parentA;
  else {
    const parentB = await check_parent(relationB, project_id, record_id);
    if (parentB !== null) new_relation['parent'] = parentB;
  }
  const new_linked_array: string[] = [];
  let linked: any[] = [];
  if (
    relationA !== null &&
    relationA !== undefined &&
    relationA.linked !== undefined
  )
    linked = relationA.linked;
  if (
    relationB !== null &&
    relationB !== undefined &&
    relationB.linked !== undefined
  )
    linked = [...linked, relationB.linked];

  if (linked.length > 0) {
    new_relation['linked'] = [];
    for (const index in linked) {
      const id = linked[index].record_id + linked[index].field_id;
      if (!new_linked_array.includes(id)) {
        new_linked_array.push(id);
        const link = {
          project_id: project_id,
          record_id: linked[index].record_id,
          record_label: linked[index].record_id,
        };
        const is_linked = await check_if_parent_link(
          link,
          linked[index].field_id,
          record_id
        );
        if (is_linked)
          new_relation['linked'] = [...new_relation['linked'], linked[index]];
      }
    }
  }
  return new_relation;
}

async function check_parent(
  relation: Relationship | null | undefined,
  project_id: string,
  record_id: string
) {
  //check if the parent is the parent
  if (relation === undefined || relation === null) return null;
  if (relation.parent !== undefined) {
    const parent = {
      project_id: project_id,
      record_id: relation.parent.record_id,
      record_label: relation.parent.record_id,
    };
    const is_linked = await check_if_parent_link(
      parent,
      relation.parent.field_id,
      record_id
    );
    if (is_linked) return relation.parent;
  }
  return null;
}

async function check_if_parent_link(
  record: RecordReference,
  field_id: string,
  record_id: string
) {
  let is_exist = false;
  const {latest_record} = await getRecordInformation(record);
  if (latest_record !== null) {
    if (Array.isArray(latest_record.data[field_id])) {
      //if field value is array, child_record has this record,then link exist
      latest_record.data[field_id].map((child_record: RecordReference) => {
        if (child_record.record_id === record_id) is_exist = true;
      });
      return is_exist;
    } else {
      if (latest_record.data[field_id].record_id === record_id) return true;
    }
  }
  return is_exist;
}
function check_if_child_link(
  relationship: Relationship | undefined,
  field_id: string,
  record_id: string,
  relation_type: string
) {
  let is_exist = false;
  if (relationship === undefined) return false;
  if (relation_type === 'Child') {
    if (relationship.parent === undefined || relationship.parent === null)
      return false;
    if (
      relationship.parent.record_id === record_id &&
      relationship.parent.field_id === field_id
    )
      return true;
    else return false; // if parent is not this parent, then return false
  } else {
    //if link relationship check parent
    if (
      relationship.linked === undefined ||
      relationship.linked === null ||
      relationship.linked.length === 0
    )
      return false;
    relationship.linked.map((record: LinkedRelation) => {
      if (record.record_id === record_id && record.field_id === field_id)
        is_exist = true;
    });
    return is_exist;
  }
}
//function is to check if child record has the correct link relationship, if not update it
export async function update_child_records_conflict(
  conflictA: any,
  conflictB: any,
  mergeresult: any,
  relation_fields: {[field_name: string]: any},
  project_id: string,
  current_record_id: string
) {
  for (const field of Object.keys(relation_fields)) {
    const field_info = relation_fields[field];
    await update_field_child_record_conflict(
      conflictA.fields[field].data,
      conflictB.fields[field].data,
      mergeresult.fields[field].data,
      field_info.relation_type.replace('faims-core::', ''),
      project_id,
      field,
      current_record_id
    );
  }
}
// function to update the child record for single field
async function update_field_child_record_conflict(
  conflictA: RecordReference | RecordReference[],
  conflictB: RecordReference | RecordReference[],
  mergeresult: RecordReference | RecordReference[] | null,
  relation_type: string,
  project_id: string,
  field_id: string,
  current_record_id: string
) {
  const all_child_records = get_all_child_records(conflictA, conflictB);
  const child_values: string[] = [];
  if (all_child_records !== null) {
    for (const index in all_child_records) {
      const record_id = all_child_records[index]['record_id'];
      //check when the record_id is not been checked
      if (!child_values.includes(record_id)) {
        child_values.push(record_id);
        const link = {
          record_id: current_record_id,
          field_id: field_id,
          relation_type_vocabPair:
            all_child_records[index]['relation_type_vocabPair'],
        };
        await conflict_update_child_record(
          mergeresult,
          link,
          record_id,
          relation_type,
          project_id,
          field_id,
          current_record_id
        );
      }
    }
  }
}

// function to update the single child record
// update child record when child record relation is different as parent
// - child record has no link, merge has link, add link
// - child has the link, merge has no link, remove the link

async function conflict_update_child_record(
  mergeresult: RecordReference | RecordReference[] | null,
  link: LinkedRelation,
  record_id: string,
  relation_type: string,
  project_id: string,
  field_id: string,
  current_record_id: string
) {
  try {
    const record = {
      project_id: project_id,
      record_id: record_id,
      record_label: record_id,
    };
    const {latest_record} = await getRecordInformation(record);
    if (latest_record !== null) {
      const is_linked = check_if_child_link(
        latest_record?.relationship,
        field_id,
        current_record_id,
        relation_type
      );
      let is_merged_linked = false;
      const new_doc = latest_record;
      let is_updated_link = false;

      let new_relation = latest_record.relationship;
      if (mergeresult !== null) {
        if (Array.isArray(mergeresult)) {
          mergeresult.map(record =>
            record.record_id === record_id ? (is_merged_linked = true) : record
          );
        } else if (mergeresult.record_id === record_id) is_merged_linked = true;
      }
      // merged value is null, then remove all links
      if (new_relation === undefined) {
        if (is_merged_linked) {
          is_updated_link = true;
          //child record has no link, merge has link, add link
          if (relation_type === 'Child') new_relation = {parent: link};
          else new_relation = {linked: [link]};
        }
      } else if (is_linked && !is_merged_linked) {
        is_updated_link = true;
        //current child has the link, merge has no link, remove the link
        if (relation_type === 'Child') {
          if (new_relation['parent'] !== undefined) {
            // need to be updated if the record has parent and it's current record,remove the parent
            if (new_relation['linked'] === undefined) new_relation = {};
            else new_relation = {linked: new_relation['linked']};
          }
        } else {
          if (new_relation['linked'] !== undefined) {
            const new_link = RemoveLink(new_relation, link);
            new_relation['linked'] = new_link;
          }
        }
      } else if (!is_linked && is_merged_linked) {
        is_updated_link = true;
        //current record has no link, merge has link, add the link
        if (relation_type === 'Child') new_relation['parent'] = link;
        else new_relation['linked'] = AddLink(new_relation, link);
      }

      if (is_updated_link) {
        const now = new Date();
        new_doc['updated'] = now;
        new_doc['relationship'] = new_relation;
        try {
          await upsertFAIMSData(project_id, new_doc);
        } catch (error) {
          logError(error);
        }
      }
    }
  } catch (error) {
    logError(error);
  }
}

// function to get all child record information, child records could be duplicated
export function get_all_child_records(conflictA: any, conflictB: any) {
  if (
    conflictA === null ||
    conflictA === '' ||
    (Array.isArray(conflictA) && conflictA.length === 0)
  ) {
    if (
      conflictB === null ||
      conflictB === '' ||
      (Array.isArray(conflictB) && conflictB.length === 0)
    )
      return null;
    else if (!Array.isArray(conflictB)) return [conflictB];
    else return conflictB;
  } else if (
    conflictB === null ||
    conflictB === '' ||
    (Array.isArray(conflictB) && conflictB.length === 0)
  ) {
    if (!Array.isArray(conflictA)) return [conflictA];
    else return conflictA;
  } else {
    if (!Array.isArray(conflictA)) return [conflictA, conflictB];
    else return [...conflictA, ...conflictB];
  }
}

function remove_deleted_parent_link(
  relationRecords: RecordLinkProps[] | null,
  record_id: string,
  field_id: string
) {
  const newRelationship: RecordLinkProps[] = [];
  if (relationRecords === null || relationRecords.length === 0) return [];
  relationRecords.map((linkRecord: RecordLinkProps) => {
    !(
      linkRecord.link.record_id === record_id &&
      linkRecord.link.field_id === field_id
    )
      ? newRelationship.push(linkRecord)
      : linkRecord;
  });
  return newRelationship;
}
type remove_deleted_parent_props = {
  is_updated: boolean;
  new_revision_id: string | null | undefined;
  new_relation: Relationship;
  newRelationship: RecordLinkProps[];
};
export async function remove_deleted_parent(
  relation_type: string,
  project_id: string,
  current_record_id: string,
  revision_id: string | undefined | null,
  field_id: string,
  record_id: string,
  relationRecords: RecordLinkProps[] | null
) {
  const result: remove_deleted_parent_props = {
    is_updated: false,
    new_revision_id: revision_id,
    new_relation: {},
    newRelationship: relationRecords ?? [],
  };
  try {
    if (revision_id === undefined || revision_id === null || revision_id === '')
      return result;
    const latest_record = await getFullRecordData(
      project_id,
      current_record_id,
      revision_id,
      false
    );

    if (latest_record !== null) {
      let new_relation = latest_record.relationship ?? {};
      const new_doc = latest_record;
      const link = {
        record_id: record_id,
        field_id: field_id,
        relation_type_vocabPair: [],
      };
      if (relation_type === 'Child') {
        if (new_relation['parent'] !== undefined) {
          // need to be updated if the record has parent and it's current record,remove the parent
          if (new_relation['linked'] === undefined) new_relation = {};
          else new_relation = {linked: new_relation['linked']};
        }
      } else {
        if (new_relation['linked'] !== undefined) {
          const new_link = RemoveLink(new_relation, link);
          new_relation['linked'] = new_link;
        }
      }
      result['new_relation'] = new_relation;
      const now = new Date();
      new_doc['updated'] = now;
      new_doc['relationship'] = new_relation;
      try {
        result['is_updated'] = true;
        result['newRelationship'] = remove_deleted_parent_link(
          relationRecords,
          record_id,
          field_id
        );
        result['new_revision_id'] = await upsertFAIMSData(project_id, new_doc);
        return result;
      } catch (error) {
        logError(error);
      }
    }
  } catch (error) {
    logError(error);
  }
  return result;
}
