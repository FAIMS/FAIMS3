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
 * Filename: index.ts
 * Description:
 *   API for accessing data from the GUI. The GUI should not use internals.ts,
 *   instead wrapper functions should be provided here.
 */

/**
 * The Data Storage module provides an API for accessing data from the GUI.
 * @module data_storage
 * @category Database
 */

import {v4 as uuidv4} from 'uuid';

import {getDataDB} from '../index';
import {DEFAULT_RELATION_LINK_VOCABULARY} from '../datamodel/core';
import {
  FAIMSTypeName,
  ProjectID,
  Record,
  RecordID,
  RecordMetadata,
  RecordReference,
  Revision,
  RevisionID,
  ProjectRevisionListing,
  RecordRevisionListing,
} from '../types';
import {shouldDisplayRecord} from '../index';
import {
  addNewRevisionFromForm,
  createNewRecordIfMissing,
  generateFAIMSRevisionID,
  getRecord,
  getRevision,
  getFormDataFromRevision,
  updateHeads,
  getHRID,
  listRecordMetadata,
} from './internals';
import {getAllRecordsOfType, getAllRecordsWithRegex} from './queries';
import {logError} from '../logging';

export function generateFAIMSDataID(): RecordID {
  return 'rec-' + uuidv4();
}

/**
 * Get the revision id of the most recent revision of a record
 * @param project_id project identifier
 * @param record_id record identifier
 * @returns a promise resolving to a revision id for the record
 */
export async function getFirstRecordHead(
  project_id: ProjectID,
  record_id: RecordID
): Promise<RevisionID> {
  const record = await getRecord(project_id, record_id);
  return record.heads[0];
}

/**
 * Either create a new record or update an existing one
 * @param project_id project identifier
 * @param record new or existing record
 * @returns a promise resolving to the revision id of the new or updated record
 */
export async function upsertFAIMSData(
  project_id: ProjectID,
  record: Record
): Promise<RevisionID> {
  if (record.record_id === undefined) {
    throw Error('record_id required to save record');
  }
  const revision_id = generateFAIMSRevisionID();
  if (record.revision_id === null) {
    await createNewRecordIfMissing(project_id, record, revision_id);
    await addNewRevisionFromForm(project_id, record, revision_id);
  } else {
    // console.info('Update existing record', record);
    await addNewRevisionFromForm(project_id, record, revision_id);
    await updateHeads(
      project_id,
      record.record_id,
      [record.revision_id],
      revision_id
    );
  }
  return revision_id;
}

/**
 * Get the full record data for a given revision of a record
 * @param {ProjectID} project_id  Project identifier
 * @param {RecordID} record_id Record identifier
 * @param {RevisionID} revision_id Revision identifier
 * @param {boolean} is_deleted if true (default), return null if the revision has been deleted. If false, return the record even if deleted
 * @returns A promise that resolves to the requested record or null
 */
export async function getFullRecordData(
  project_id: ProjectID,
  record_id: RecordID,
  revision_id: RevisionID,
  is_deleted = true //default value should be true
): Promise<Record | null> {
  const revision = await getRevision(project_id, revision_id);
  if (revision.deleted === true && is_deleted) {
    // return null when is_deleted is not set or set as true
    return null;
  }
  const record = await getRecord(project_id, record_id);
  const form_data = await getFormDataFromRevision(project_id, revision);

  return {
    project_id: project_id,
    record_id: record_id,
    revision_id: revision_id,
    type: revision.type,
    data: form_data.data,
    updated_by: revision.created_by,
    updated: new Date(revision.created),
    created: new Date(record.created),
    created_by: record.created_by,
    annotations: form_data.annotations,
    field_types: form_data.types,
    relationship: revision.relationship,
    deleted: revision.deleted ?? false,
  };
}

/**
 * Get a list of revisions for a given record
 * @param {ProjectID} project_id
 * @param {RecordID} record_id
 * @returns {Promise<RecordRevisionListing>} A promise resolving to a revision listing
 */
export async function listFAIMSRecordRevisions(
  project_id: ProjectID,
  record_id: RecordID
): Promise<RecordRevisionListing> {
  try {
    const record = await getRecord(project_id, record_id);
    return record.revisions;
  } catch (err) {
    console.warn('failed to list data for id', record_id);
    throw err;
  }
}

/**
 * Get a list of revisions for a given project
 * @param {ProjectID} project_id
 * @returns {Promise<ProjectRevisionListing>}
 */
export async function listFAIMSProjectRevisions(
  project_id: ProjectID
): Promise<ProjectRevisionListing> {
  const dataDB = await getDataDB(project_id);
  try {
    const result = await dataDB.allDocs();
    const revisionMap: ProjectRevisionListing = {};
    for (const row of result.rows) {
      const _id: RecordID = row.key;
      revisionMap[_id] = await listFAIMSRecordRevisions(project_id, _id);
    }
    return revisionMap;
  } catch (err) {
    console.warn('failed to list data in project', project_id, err);
    throw Error('failed to list data in project');
  }
}

export async function deleteFAIMSDataForID(
  project_id: ProjectID,
  record_id: RecordID,
  user_id: string
): Promise<RevisionID> {
  const record = await getRecord(project_id, record_id);
  if (record.heads.length !== 1) {
    throw Error('Too many head revisions, must choose a specific head');
  }
  try {
    return await setRecordAsDeleted(
      project_id,
      record_id,
      record.heads[0],
      user_id
    );
  } catch (err) {
    console.warn(
      'failed to delete data with id',
      project_id,
      record_id,
      user_id,
      err
    );
    throw Error('failed to delete data with id');
  }
}

export async function undeleteFAIMSDataForID(
  project_id: ProjectID,
  record_id: RecordID,
  user_id: string
): Promise<RevisionID> {
  const record = await getRecord(project_id, record_id);
  if (record.heads.length !== 1) {
    throw Error('Too many head revisions, must choose a specific head');
  }
  try {
    return await setRecordAsUndeleted(
      project_id,
      record_id,
      record.heads[0],
      user_id
    );
  } catch (err) {
    console.warn(
      'failed to undelete data with id',
      project_id,
      record_id,
      user_id,
      err
    );
    throw Error('failed to undelete data with id');
  }
}

export async function setRecordAsDeleted(
  project_id: ProjectID,
  record_id: RecordID,
  base_revision_id: RevisionID,
  user: string
): Promise<RevisionID> {
  const dataDB = await getDataDB(project_id);
  const date = new Date();
  const base_revision = await getRevision(project_id, base_revision_id);
  const new_rev_id = generateFAIMSRevisionID();
  const new_revision: Revision = {
    _id: new_rev_id,
    revision_format_version: 1,
    avps: base_revision.avps,
    type: base_revision.type,
    record_id: record_id,
    parents: [base_revision_id],
    created: date.toISOString(),
    created_by: user,
    deleted: true,
    relationship: base_revision.relationship,
  };
  await dataDB.put(new_revision);
  await updateHeads(project_id, record_id, [base_revision._id], new_rev_id);
  return new_rev_id;
}

export async function setRecordAsUndeleted(
  project_id: ProjectID,
  record_id: RecordID,
  base_revision_id: RevisionID,
  user: string
): Promise<RevisionID> {
  const dataDB = await getDataDB(project_id);
  const date = new Date();
  const base_revision = await getRevision(project_id, base_revision_id);
  const new_rev_id = generateFAIMSRevisionID();
  const new_revision: Revision = {
    _id: new_rev_id,
    revision_format_version: 1,
    avps: base_revision.avps,
    type: base_revision.type,
    record_id: record_id,
    parents: [base_revision_id],
    created: date.toISOString(),
    created_by: user,
    deleted: false,
    relationship: base_revision.relationship,
  };
  await dataDB.put(new_revision);
  await updateHeads(project_id, record_id, [base_revision._id], new_rev_id);
  return new_rev_id;
}

export async function getRecordMetadata(
  project_id: ProjectID,
  record_id: RecordID,
  revision_id: RevisionID
): Promise<RecordMetadata> {
  try {
    const record = await getRecord(project_id, record_id);
    const revision = await getRevision(project_id, revision_id);
    const hrid = (await getHRID(project_id, revision)) ?? record_id;
    return {
      project_id: project_id,
      record_id: record_id,
      revision_id: revision_id,
      created: new Date(record.created),
      created_by: record.created_by,
      updated: new Date(revision.created),
      updated_by: revision.created_by,
      conflicts: record.heads.length > 1,
      deleted: revision.deleted ? true : false,
      hrid: hrid,
      type: record.type,
      relationship: revision.relationship,
    };
  } catch (err) {
    console.debug(
      'failed to get record metadata:',
      project_id,
      record_id,
      revision_id
    );
    logError(err);
    throw Error(
      'failed to get record metadata: {project_id} {record_id} {revision_id}'
    );
  }
}

export async function getHRIDforRecordID(
  project_id: ProjectID,
  record_id: RecordID
): Promise<string> {
  try {
    const record = await getRecord(project_id, record_id);
    const revision_id = record.heads[0];
    const revision = await getRevision(project_id, revision_id);
    const hrid = (await getHRID(project_id, revision)) ?? record_id;
    return hrid;
  } catch (err) {
    console.warn('Failed to get hrid', err);
    return record_id;
  }
}

export async function getRecordsByType(
  project_id: ProjectID,
  type: FAIMSTypeName,
  relation_type: string,
  record_id: string,
  field_id: string,
  relation_linked_vocabPair: string[] | null = null
): Promise<RecordReference[]> {
  try {
    let relation_vocab: string[] | null = null;
    if (relation_type !== 'faims-core::Child') {
      relation_vocab = [
        DEFAULT_RELATION_LINK_VOCABULARY,
        DEFAULT_RELATION_LINK_VOCABULARY,
      ]; //default value of the linked items
      if (
        relation_linked_vocabPair !== null &&
        relation_linked_vocabPair.length > 0
      )
        relation_vocab = relation_linked_vocabPair; //get the name from relation_linked_vocabPair
    }
    const records: RecordReference[] = [];
    await listRecordMetadata(project_id).then(record_list => {
      for (const key in record_list) {
        const metadata = record_list[key];

        let is_parent = false;
        const relationship = metadata['relationship'];

        if (relation_type === 'faims-core::Child') {
          //check if record has the parent, record should only have one parent
          if (
            relationship === undefined ||
            relationship['parent'] === undefined ||
            relationship['parent'] === null ||
            relationship['parent'].record_id === undefined
          )
            is_parent = false;
          else if (relationship['parent'].record_id !== record_id)
            is_parent = true;
          else if (
            relationship['parent'].record_id === record_id &&
            relationship['parent'].field_id !== field_id
          )
            is_parent = true;
        }
        if (!metadata.deleted && metadata.type === type && !is_parent) {
          const hrid =
            metadata.hrid !== '' && metadata.hrid !== undefined
              ? metadata.hrid
              : metadata.record_id;
          if (relation_vocab === null)
            records.push({
              project_id: project_id,
              record_id: metadata.record_id,
              record_label: hrid,
            });
          else
            records.push({
              project_id: project_id,
              record_id: metadata.record_id,
              record_label: hrid,
              relation_type_vocabPair: relation_vocab, // pass the value of the vocab
            });
        }
      }
    });
    return records;
  } catch (err) {
    // TODO: What are we doing here, why would things error?
    const records = await getAllRecordsOfType(project_id, type);
    console.warn(err);
    return records;
  }
}

/**
 * Remove records that are deleted or should not be displayed from a list of record metadata objects
 * @param project_id - project identifier
 * @param record_list - array of record metadata objects
 * @param filter_deleted - if true, we filter out deleted records
 * @returns an array of record metadata objects (Promise)
 */
async function filterRecordMetadata(
  project_id: ProjectID,
  record_list: RecordMetadata[],
  filter_deleted: boolean
): Promise<RecordMetadata[]> {
  const new_record_list: RecordMetadata[] = [];
  for (const metadata of record_list) {
    if (
      !(metadata.deleted && filter_deleted) &&
      (await shouldDisplayRecord(project_id, metadata))
    ) {
      new_record_list.push(metadata);
    }
  }
  return new_record_list;
}

function sortByLastUpdated(record_list: RecordMetadata[]): RecordMetadata[] {
  return record_list.sort((a: RecordMetadata, b: RecordMetadata) => {
    if (a < b) {
      return 1;
    }
    if (a > b) {
      return -1;
    }
    return 0;
  });
}

export async function getMetadataForAllRecords(
  project_id: ProjectID,
  filter_deleted: boolean
): Promise<RecordMetadata[]> {
  try {
    const record_list = Object.values(await listRecordMetadata(project_id));
    return await filterRecordMetadata(
      project_id,
      sortByLastUpdated(record_list),
      filter_deleted
    );
  } catch (error) {
    console.debug('Failed to get record metadata for', project_id);
    logError(error);
    return [];
  }
}

export async function getRecordsWithRegex(
  project_id: ProjectID,
  regex: string,
  filter_deleted: boolean
): Promise<RecordMetadata[]> {
  try {
    const record_list = Object.values(
      await getAllRecordsWithRegex(project_id, regex)
    );
    return await filterRecordMetadata(project_id, record_list, filter_deleted);
  } catch (error) {
    console.debug('Failed to regex search for', project_id, regex);
    logError(error);
    return [];
  }
}

import {FormData} from './internals';

const hydrateRecord = async (
  project_id: string,
  record: any // return type of getSomeRecords
) => {
  const hrid = await getHRID(project_id, record.revision);
  const formData: FormData = await getFormDataFromRevision(
    project_id,
    record.revision
  );
  const result = {
    project_id: project_id,
    record_id: record.record_id,
    revision_id: record.revision_id,
    created_by: record.created_by,
    updated: new Date(record.revision.created),
    updated_by: record.revision.created_by,
    deleted: record.revision.deleted ? true : false,
    hrid: hrid,
    relationship: record.revision.relationship,
    data: formData.data,
    annotations: formData.annotations,
    types: formData.types,
    created: new Date(record.created),
    conflicts: record.conflict,
    type: record.revision.type,
  };
  return result;
};

export async function getSomeRecords(
  project_id: ProjectID,
  limit: number,
  bookmark: string | null = null,
  filter_deleted = true
) {
  const dataDB = await getDataDB(project_id);
  const options: {[key: string]: any} = {
    limit: limit,
    include_docs: true,
  };
  // if we have a bookmark, start from there
  if (bookmark !== null) {
    options.startkey = bookmark;
  }
  try {
    const res = await dataDB.query('index/recordRevisions', options);
    let record_list = res.rows.map((doc: any) => {
      return {
        record_id: doc.id,
        revision_id: doc.value._id,
        created: doc.value.created,
        conflict: doc.value.conflict,
        type: doc.value.type,
        revision: doc.doc,
      };
    });
    if (filter_deleted) {
      record_list = record_list.filter((record: any) => {
        // guarding against there being no revision which should not happen but has
        return !record.revision?.deleted;
      });
    }
    // don't return the first record if we have a bookmark
    // as it will be the bookmarked record
    if (bookmark !== null) return record_list.slice(1);
    else return record_list;
  } catch (err) {
    console.log('failed to get some records', err);
    return [];
  }
}

/**
 * Return an iterator over the records in a notebook
 * @param project_id project identifier
 */
export const notebookRecordIterator = async (
  project_id: string,
  viewID: string,
  filter_deleted = true
) => {
  const batchSize = 100;
  const getNextBatch = async (bookmark: string | null) => {
    const records = await getSomeRecords(
      project_id,
      batchSize,
      bookmark,
      filter_deleted
    );
    // select just those in this view
    return records.filter((record: any) => {
      return record.type === viewID;
    });
  };

  let records = await getNextBatch(null);
  // deal with no records
  if (records.length === 0) {
    return {next: async () => ({record: null, done: true})};
  }
  let index = 0;
  const recordIterator = {
    async next() {
      let record;
      if (index < records.length) {
        record = records[index];
        index++;
      } else {
        // see if we can get more records
        const startID = records[records.length - 1].record_id;
        records = await getNextBatch(startID);
        if (records.length > 0) {
          record = records[0];
          index = 1;
        }
      }
      if (record) {
        const data = await hydrateRecord(project_id, record);
        return {record: data, done: false};
      } else {
        return {record: null, done: true};
      }
    },
  };
  return recordIterator;
};
