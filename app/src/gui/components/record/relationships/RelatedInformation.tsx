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
  getFirstRecordHead,
  getFullRecordData,
  getMetadataForSomeRecords,
  LinkedRelation,
  ProjectID,
  ProjectUIModel,
  RecordID,
  RecordMetadata,
  RecordReference,
  Relationship,
  RevisionID,
  TokenContents,
  upsertFAIMSData,
} from '@faims3/data-model';
import * as ROUTES from '../../../../constants/routes';
import {compiledSpecService} from '../../../../context/slices/helpers/compiledSpecService';
import {logError} from '../../../../logging';
import {getHridFromValuesAndSpec} from '../../../../utils/formUtilities';
import getLocalDate from '../../../fields/LocalDate';
import {ParentLinkProps, RecordLinkProps} from './types';
import {localGetDataDb} from '../../../..';

export type LocationState = {
  parent_record_id?: string; // parent or linked record id, set from parent or linked record
  field_id?: string; // parent or linked field id, set from parent or linked record
  type?: string; // type of relationship: Child or Linked
  parent_link?: string; // link of parent/linked record, so when child/link record saved, this is the redirect link
  parent?: any; // parent to save upper level information for nest related, for example, grandparent
  record_id?: RecordID; // child/linked record ID, set in child/linked record, should be pass back to parent
  hrid?: string; // child/linked record HRID, this is the value displayed in field, set in child/linked record, should be pass back to parent
  revision_id?: RevisionID;
  relation_type_vocabPair?: string[] | null; //pass the parent information to child
  child_record_id?: RecordID; //child/linked record ID created from parent
  parent_hrid?: string;
};

/**
 * Generate an object containing information to be stored in
 *   `location.state` to persist between page views.
 * @param parentLink - details of the linked (parent) record
 * @param project_id - current project id
 * @returns {location_state, latest_record, revision_id}
 */
export async function generateLocationState(
  parentLink: LinkedRelation,
  project_id: string,
  serverId: string
) {
  const parent_record = {
    project_id: project_id,
    record_id: parentLink.record_id,
    record_label: parentLink.record_id,
  };
  const {latest_record, revision_id} =
    await getRecordInformation(parent_record);
  if (revision_id) {
    return {
      location_state: {
        field_id: parentLink.field_id,
        parent: latest_record?.relationship?.parent,
        parent_link: ROUTES.getExistingRecordRoute({
          serverId,
          projectId: project_id,
          recordId: parentLink.record_id,
          revisionId: revision_id,
        }),
        parent_record_id: parentLink.record_id,
        type: 'Child',
        // relation_type_vocabPair: relationship.parent.relation_type_vocabPair,
      },
      latest_record: latest_record,
      revision_id: revision_id,
    };
  } else {
    // with no revision_id we can't work out where we are so just return empty results
    return {location_state: {}, latest_record: null, revision_id: null};
  }
}

/**
 * getParentLinkInfo - get information about whether a new record is a child of some parent record
 * @param revision_id - the HRID or revision_id of a record
 * @param relationState - stored relation state
 * @param record_id - the id of the record
 * @returns {LocationState} details about the parent record or `{}` if none.
 */
export function getParentLinkInfo(
  revision_id: string,
  relationState: any,
  record_id: string
) {
  // If no relation state, return empty parent info
  if (!relationState) {
    return null;
  }

  // Initialize parent state with basic information
  let state_parent: LocationState = {
    field_id: relationState.field_id,
    record_id: record_id,
    revision_id: revision_id,
    parent: relationState.parent,
    parent_link: relationState.parent_link,
    parent_record_id: relationState.parent_record_id,
    type: relationState.type,
    relation_type_vocabPair: relationState.relation_type_vocabPair,
  };

  // Handle nested parent relationships
  if (
    relationState.parent?.field_id &&
    record_id === relationState.parent_record_id &&
    relationState.parent.parent
  ) {
    state_parent = {
      field_id: relationState.parent.field_id,
      record_id: record_id,
      revision_id: revision_id,
      parent: relationState.parent.parent,
      parent_link: relationState.parent.parent_link,
      parent_record_id: relationState.parent.parent_record_id,
      type: relationState.parent.type,
      relation_type_vocabPair: relationState.parent.relation_type_vocabPair,
    };
  }

  return state_parent;
}

/**
 * recordLinkIsDirect - get information about whether a new record is a child of some parent record
 * @param revision_id - the HRID or revision_id of a record
 * @param relationState - stored relation state
 * @param record_id - the id of the record
 * @returns true if the record record_id is a child record, false if not.
 */
export function recordIsChildRecord(
  revision_id: string,
  relationState: any,
  record_id: string
): boolean {
  // If no relation state exists, it can't be direct
  if (!relationState) return false;

  // If there's a field_id in the relationState, it's a direct relation
  if (relationState.field_id) {
    // But we need to check if this is actually a parent record
    // If the record is the parent record itself, it's not direct
    if (relationState.parent_record_id === record_id) {
      // Only if this record has no parent of its own, it's not direct
      if (!relationState.parent?.parent_record_id) {
        return false;
      }
    }
    return true;
  }

  // Check if this is a nested parent-child relationship
  // If the parent exists in relationState and this record is the parent
  if (
    relationState.parent?.field_id &&
    record_id === relationState.parent_record_id
  ) {
    // If the parent has its own parent, this is a direct relation
    return !!relationState.parent.parent;
  }

  return false;
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
  let revision_id = '';
  if (child_record.project_id === undefined)
    return {latest_record, revision_id};
  try {
    revision_id = await getFirstRecordHead({
      dataDb: localGetDataDb(child_record.project_id),
      recordId: child_record.record_id,
    });
    latest_record = await getFullRecordData({
      dataDb: localGetDataDb(child_record.project_id),
      projectId: child_record.project_id,
      recordId: child_record.record_id,
      revisionId: revision_id,
      isDeleted: false,
    });
  } catch (error) {
    // don't throw an error in this case.  There is a common case where the
    // record is a newly created child record that is not yet in the database.
    // Return null values so the caller can handle it appropriately.
    return {latest_record: null, revision_id: null};
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

/**
 * getRelatedRecords - get all records related to this one by a given relationship
 *  - takes the value of the field and turns it into an array of RecordMetadata
 *
 * @param project_id - project identifier
 * @param values - current form values for this record
 * @param field_name - the field name that will hold the relationship
 * @param multiple - do we allow multiple linked records?
 * @returns an array of RecordMetadata for the linked records
 */
export async function getRelatedRecords(
  token: TokenContents,
  project_id: ProjectID,
  values: {[field_name: string]: any},
  field_name: string,
  multiple: boolean,
  uiSpecification: ProjectUIModel
) {
  let fieldValue = values[field_name];

  // Handle undefined/null cases
  if (fieldValue === null) {
    return [];
  }

  // Type check based on multiple flag
  if (multiple) {
    if (!Array.isArray(fieldValue)) {
      // we can fix this one, just make it an array and don't complain
      // error is probably in the UIspec with a bad initial value
      if (fieldValue === '') values[field_name] = [];
      else values[field_name] = [fieldValue];
    }
  } else {
    if (Array.isArray(fieldValue)) {
      // fix this by taking the first value, less likely to happen unless the
      // UISpec has changed
      if (fieldValue.length > 0) values[field_name] = fieldValue[0];
      else values[field_name] = '';
    }
  }
  // pick up any change above
  fieldValue = values[field_name];

  // Convert to array for processing
  const links = multiple ? fieldValue : [fieldValue];
  // ensure that all links are well formed and extract the record_id from them
  // it can be the case that a value is '', eg. as an initial value
  const record_ids = links
    .filter((link: any) => typeof link === 'object' && 'record_id' in link)
    .map((link: any) => link.record_id);
  const records = await getMetadataForSomeRecords({
    dataDb: localGetDataDb(project_id),
    filterDeleted: true,
    projectId: project_id,
    recordIds: record_ids,
    tokenContents: token,
    uiSpecification,
  });
  return records;
}

/**
 * Generate a RecordLinkProps object given it's many properties
 * @returns a RecordLinkProps object
 */
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
    project_id: child_record.project_id,
    record_id: child_record.record_id,
    record_label: child_record.record_label,
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
  serverId: string
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
        // Try and get the HRID and fall back to the record ID
        const hrid =
          getHridFromValuesAndSpec({
            values: latest_record.data,
            uiSpecification: ui_specification,
          }) ?? child_record['record_id'];

        // inject the hrid
        child_record['record_label'] = hrid;

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
          ROUTES.getExistingRecordRoute({
            serverId,
            projectId: child_record.project_id,
            recordId: child_record.record_id,
            revisionId: revision_id,
          }),
          linked_vocab,
          record_id,
          hrid,
          form_type,
          ui_specification.viewsets[related_type]['label'] ?? related_type,
          section,
          section_label,
          field,
          field_name,
          ROUTES.getExistingRecordRoute({
            serverId,
            projectId: child_record?.project_id,
            recordId: record_id,
            revisionId: current_revision_id,
          }),
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

/**
 * Retrieves and processes relationship information from a record's parent and linked relationships,
 * converting them into RecordLinkProps objects for UI display. This function examines the
 * relationship structure of a record and creates display objects for each parent and linked
 * relationship, including metadata like HRIDs, routes, and relationship types.
 * 
 * @param ui_specification - The UI specification for the project
 * @param newfields - Existing array of RecordLinkProps to append to
 * @param project_id - The project identifier
 * @param parent - The relationship object containing parent and linked relationships
 * @param record_id - The current record ID
 * @param form_type - The form type/viewset name
 * @param child_hrid - The HRID of the current record
 * @param current_revision_id - The revision ID of the current record
 * @param serverId - The server identifier for generating routes
 * @returns Promise<Array<RecordLinkProps>> - Array of relationship display objects
 */
export async function getRelationshipDisplayData(
  ui_specification: ProjectUIModel,
  newfields: Array<RecordLinkProps>,
  project_id: string,
  parent: Relationship | null,
  record_id: string,
  form_type: string,
  child_hrid: string,
  current_revision_id: string,
  serverId: string
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
    if (revision_id) {
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

      // get hrid for the parent link record
      const hrid =
        getHridFromValuesAndSpec({
          values: latest_record?.data ?? {},
          uiSpecification: ui_specification,
        }) ?? parent_link.record_id;

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
          : ROUTES.getExistingRecordRoute({
              serverId,
              projectId: child_record.project_id,
              recordId: child_record.record_id,
              revisionId: current_revision_id,
            }),
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
          : ROUTES.getExistingRecordRoute({
              serverId,
              projectId: child_record.project_id,
              recordId: parent_link.record_id,
              revisionId: revision_id,
            }),
        has_parent === true && index === '0' ? 'Child' : 'Linked',
        false,
        is_parent_deleted
      );
      newfields.push(child);
    }
  }
  return newfields;
}

// get a label for the section of the form that this field is part of
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
    if (ui_specification['fields'][field]['component-parameters'].label)
      field_name =
        ui_specification['fields'][field]['component-parameters'].label;
    return {field_name, is_deleted};
  } catch (error) {
    logError(error);
    return {field_name, is_deleted};
  }
}

/**
 * For a given child, fetches the parent persistent data for use in infilling
 * default values from the parent
 *
 * TODO: this appears to generate way more information than is actually needed
 * to fulfil this purpose.
 *
 * @param ui_specification The ui specification for the current project
 * @param project_id The project ID
 * @param parent The parent relationship
 * @param record_id The current record ID (which would be the child record)
 * @returns A list of parent records with persistent data made available
 */
export async function getParentPersistenceData({
  uiSpecification,
  projectId,
  parent,
  serverId,
}: {
  uiSpecification: ProjectUIModel;
  projectId: string;
  parent: Relationship | null;
  serverId: string;
}): Promise<ParentLinkProps[]> {
  let parentRecords: ParentLinkProps[] = [];
  if (parent !== null && parent.parent !== undefined) {
    const {latest_record, revision_id} = await getRecordInformation({
      project_id: projectId,
      record_id: parent.parent.record_id,
      record_label: parent.parent.record_id,
    });

    if (latest_record !== null) {
      const persistentvalue: {[field_name: string]: any} = {};
      let type = latest_record?.type;

      //get persistent data from parent record not from local DB
      uiSpecification.viewsets[type]['views'].map((view: string) =>
        uiSpecification.views[view]['fields'].map((field: string) =>
          uiSpecification.fields[field]['displayParent'] ||
          uiSpecification.fields[field]['persistent']
            ? (persistentvalue[field] = latest_record?.data[field])
            : field
        )
      );

      // get hrid for the parent record
      const hrid =
        getHridFromValuesAndSpec({
          uiSpecification: uiSpecification,
          values: latest_record?.data,
        }) ?? parent.parent.record_id;

      if (
        latest_record !== null &&
        type !== undefined &&
        uiSpecification.viewsets[type] !== undefined &&
        uiSpecification.viewsets[type]['label'] !== undefined
      )
        type = uiSpecification.viewsets[type]['label'] ?? '';

      parentRecords = [
        {
          // It seems the other fields are not used, only these?
          type: type,
          persistentData: {data: persistentvalue},

          // other details...
          record_id: parent.parent.record_id,
          // This HRID is for the parent record
          hrid: hrid,
          lastUpdatedBy: latest_record?.updated_by ?? '',
          section: '',
          field_id: parent.parent.field_id,
          field_label: parent.parent.field_id,
          route: ROUTES.getExistingRecordRoute({
            serverId,
            projectId,
            recordId: parent.parent.record_id,
            revisionId: revision_id,
          }),
          children: [],
          deleted: latest_record?.deleted,
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
  current_revision_id: string,
  serverId: string
): Promise<RecordLinkProps[]> {
  let record_to_field_links: RecordLinkProps[] = [];
  // get fields that are related field
  const {fields_child, fields_linked} = get_related_valued_fields(
    ui_specification,
    form_type,
    values
  );

  const hrid =
    getHridFromValuesAndSpec({uiSpecification: ui_specification, values}) ??
    record_id;

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
      current_revision_id,
      serverId
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
      current_revision_id,
      serverId
    );
    // get parent linked information
    record_to_field_links = await getRelationshipDisplayData(
      ui_specification,
      record_to_field_links,
      project_id,
      parent,
      record_id,
      form_type,
      hrid,
      current_revision_id,
      serverId
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

/**
 * removeRecordLink - remove a link between two records
 * The parent/source record is updated and saved. Returns the child
 * record id, the caller is responsible for updating the child record
 *
 * @param child_record - the record to be linked to
 * @param parent - a LinkedRelation object including the record being linked from and the link type
 * @param relation_type - 'Child' or 'Linked'
 * @returns the new child record object
 */
export async function removeRecordLink(
  child_record: RecordReference,
  parent: LinkedRelation,
  relation_type: string
): Promise<RecordID | null> {
  let result = null;

  try {
    // retrieve information about the child record
    const {latest_record} = await getRecordInformation(child_record);

    // Find the relation object (if any) and then
    // remove the parent/link as appropriate
    // Since there can only be one parent, that is done directly
    // but links use RemoveLink because they can be many-many
    const relation = latest_record?.relationship ?? {};
    if (relation_type === 'Child') delete relation.parent;
    else if (relation_type === 'Linked')
      relation['linked'] = RemoveLink(relation, parent);
    else {
      logError(`Error: unknown relation type ${relation_type}`);
      return null;
    }

    // create a new version of latest_record to add the relation data
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
      await upsertFAIMSData({
        dataDb: localGetDataDb(child_record.project_id),
        record: new_doc,
      });
    }

    // now update the child record, removing the relation info from the
    // relevant field
    result = child_record.record_id;
  } catch (error) {
    logError(error);
  }

  return result;
}

/**
 * addRecordLink - either add or remove a link between two records
 * The parent/source record is updated and saved, the child record is
 * updated and returned so must be saved by the caller
 *
 * @param child_record - the record to be linked to
 * @param parent - a LinkedRelation object including the record being linked from and the link type
 * @param relation_type - 'Child' or 'Linked'
 * @param uiSpecId - id of the relevant uiSpec for this project
 * @returns the new child record object
 */
export async function addRecordLink({
  childRecord,
  parent,
  relationType,
  uiSpecId,
}: {
  childRecord: RecordReference;
  parent: LinkedRelation;
  relationType: string;
  uiSpecId: string | undefined;
}): Promise<RecordMetadata | null> {
  const uiSpec = uiSpecId ? compiledSpecService.getSpec(uiSpecId) : undefined;

  let child_record_meta = null;
  try {
    // retrieve information about the child record
    const {latest_record} = await getRecordInformation(childRecord);

    // Use the data and spec to get the HRID
    const childRecordHrid =
      latest_record?.data && uiSpec
        ? (getHridFromValuesAndSpec({
            values: latest_record?.data,
            uiSpecification: uiSpec,
          }) ?? latest_record.record_id)
        : (latest_record?.record_id ?? '');

    // Find the relation object (if any) and then either add or
    // remove the parent/link as appropriate
    // Since there can only be one parent, that is done directly
    // but links use AddLink/RemoveLink because they can be many-many
    const relation = latest_record?.relationship ?? {};
    if (relationType === 'faims-core::Child') relation['parent'] = parent;
    else if (relationType === 'faims-core::Linked')
      relation['linked'] = AddLink(relation, parent);
    else {
      logError(`Error: unknown relation type ${relationType}`);
      return null;
    }

    // create a new version of latest_record to add the relation data
    const now = new Date();
    if (
      latest_record !== null &&
      childRecord.project_id !== undefined &&
      latest_record.deleted !== true
    ) {
      const new_doc = latest_record;
      new_doc['relationship'] = relation;
      new_doc['updated'] = now;
      new_doc['deleted'] = latest_record.deleted;
      await upsertFAIMSData({
        dataDb: localGetDataDb(childRecord.project_id),
        record: new_doc,
      });
    }
    // here we are trusting that Record has enough of the fields of
    // RecordMetadata for the purposes of the caller until such time as we
    // rationalise the Record types
    child_record_meta = latest_record as unknown as RecordMetadata;
    child_record_meta.hrid = childRecordHrid;
  } catch (error) {
    logError(error);
  }
  // just return the child record we fetched
  return child_record_meta;
}

export function remove_link_from_list(
  link_records: RecordMetadata[],
  child_record_id: RecordID
) {
  if (link_records.length === 0) return link_records;
  const new_link_records: RecordMetadata[] = [];
  link_records.map((linkRecord: RecordMetadata) =>
    linkRecord.record_id !== child_record_id
      ? new_link_records.push(linkRecord)
      : linkRecord
  );
  return new_link_records;
}

function AddLink(
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

function RemoveLink(relation: Relationship, linked: LinkedRelation) {
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
          await upsertFAIMSData({
            dataDb: localGetDataDb(project_id),
            record: new_doc,
          });
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
function get_all_child_records(conflictA: any, conflictB: any) {
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
    const latest_record = await getFullRecordData({
      dataDb: localGetDataDb(project_id),
      projectId: project_id,
      recordId: current_record_id,
      revisionId: revision_id,
      isDeleted: false,
    });

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
        result['new_revision_id'] = await upsertFAIMSData({
          dataDb: localGetDataDb(project_id),
          record: new_doc,
        });
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
