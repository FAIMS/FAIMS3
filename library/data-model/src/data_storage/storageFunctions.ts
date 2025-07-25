/**
 * The Data Storage module provides an API for accessing data from the GUI.
 * @module data_storage
 * @category Database
 */

// Install plugin since we use the .query method here
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);

import {v4 as uuidv4} from 'uuid';
import {DEFAULT_RELATION_LINK_VOCABULARY} from '../datamodel/core';
import {getDataDB, shouldDisplayRecord} from '../callbacks';
import {TokenContents} from '../permission/types';
import {logError} from '../logging';
import {
  DataDbType,
  FAIMSTypeName,
  ProjectDataObject,
  ProjectID,
  ProjectRevisionListing,
  ProjectUIModel,
  Record,
  RecordID,
  RecordMetadata,
  RecordReference,
  RecordRevisionListing,
  Revision,
  RevisionID,
  UnhydratedRecord,
} from '../types';
import {
  addNewRevisionFromForm,
  FormData,
  generateFAIMSRevisionID,
  getFormDataFromRevision,
  getHRID,
  getRecord,
  getRevision,
  initialiseRecordForNewRevision,
  listRecordMetadata,
  queryCouch,
  REVISIONS_INDEX,
  updateHeads,
} from './internals';
import {getAllRecordsOfType, getAllRecordsWithRegex} from './queries';

export function generateFAIMSDataID(): RecordID {
  return 'rec-' + uuidv4();
}

/**
 * Utility function to get the type of a record given an id via a
 *  simple query, avoiding too many db lookups
 *
 * @param project_id project identifier
 * @param recordId record identifier
 * @returns the record type as a string
 */
export async function getRecordType({
  recordId,
  dataDb,
}: {
  dataDb: DataDbType;
  recordId: RecordID;
}): Promise<string> {
  const record = await getRecord({dataDb, recordId: recordId});
  if (!record) {
    throw new Error(`Cannot find record with ID ${recordId}`);
  }
  return record.type;
}

/**
 * Get the revision id of the most recent revision of a record
 * @param project_id project identifier
 * @param record_id record identifier
 * @returns a promise resolving to a revision id for the record
 */
export async function getFirstRecordHead({
  recordId,
  dataDb,
}: {
  recordId: RecordID;
  dataDb: DataDbType;
}): Promise<RevisionID> {
  const record = await getRecord({dataDb, recordId});
  if (!record) {
    throw new Error(
      `Could not find record with ID ${recordId} unable to get head.`
    );
  }
  return record.heads[0];
}

/**
 * Either create a new record or update an existing one
 * @param projectId project identifier
 * @param record new or existing record
 * @returns a promise resolving to the revision id of the new or updated record
 */
export async function upsertFAIMSData({
  record,
  dataDb,
}: {
  record: Record;
  dataDb: DataDbType;
}): Promise<RevisionID> {
  if (record.record_id === undefined) {
    throw Error('record_id required to save record');
  }
  const revision_id = generateFAIMSRevisionID();
  // New record
  if (record.revision_id === null) {
    await initialiseRecordForNewRevision({dataDb, record, revision_id});
    await addNewRevisionFromForm({dataDb, newRevId: revision_id, record});
  } else {
    // existing record
    await addNewRevisionFromForm({dataDb, newRevId: revision_id, record});
    await updateHeads({
      baseRevisionId: [record.revision_id],
      newRevisionId: revision_id,
      dataDb,
      recordId: record.record_id,
    });
  }
  return revision_id;
}

/**
 * Get the full record data for a given revision of a record
 * @param projectId  Project identifier
 * @param dataDb The data DB
 * @param recordId Record identifier
 * @param revisionId Revision identifier
 * @param isDeleted if true (default), return null if the revision has been deleted. If false, return the record even if deleted
 * @returns A promise that resolves to the requested record or null
 */
export async function getFullRecordData({
  dataDb,
  projectId,
  recordId,
  revisionId,
  isDeleted = true,
}: {
  projectId: ProjectID;
  dataDb: DataDbType;
  recordId: RecordID;
  revisionId: RevisionID;
  isDeleted?: boolean;
}): Promise<Record | null> {
  // get the revision
  const revision = await getRevision({dataDb, revisionId});
  if (revision.deleted === true && isDeleted) {
    // return null when is_deleted is not set or set as true
    return null;
  }

  // Get the record and form data
  const record = await getRecord({dataDb, recordId});
  if (!record) {
    throw new Error(
      `Could not find the record with ID ${recordId} - unable to return the full record data.`
    );
  }

  // Populate data
  const formData = await getFormDataFromRevision({dataDb, revision});

  return {
    project_id: projectId,
    record_id: recordId,
    revision_id: revisionId,
    type: revision.type,
    data: formData.data,
    updated_by: revision.created_by,
    updated: new Date(revision.created),
    created: new Date(record.created),
    created_by: record.created_by,
    annotations: formData.annotations,
    field_types: formData.types,
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
export async function listFAIMSRecordRevisions({
  recordId,
  dataDb,
}: {
  recordId: RecordID;
  dataDb: DataDbType;
}): Promise<RecordRevisionListing> {
  try {
    const record = await getRecord({recordId, dataDb});
    if (!record) {
      throw new Error('Could not find record.');
    }
    return record.revisions;
  } catch (err) {
    console.warn('failed to list data for id', recordId);
    throw err;
  }
}

/**
 * Get a list of revisions for a given project
 * @param {ProjectID} project_id
 * @returns {Promise<ProjectRevisionListing>}
 */
export async function listFAIMSProjectRevisions({
  dataDb,
}: {
  dataDb: DataDbType;
}): Promise<ProjectRevisionListing> {
  try {
    // get all revision
    const result = await queryCouch<Revision>({
      db: dataDb,
      index: REVISIONS_INDEX,
    });
    const revisionMap: ProjectRevisionListing = {};
    for (const row of result) {
      revisionMap[row._id] = await listFAIMSRecordRevisions({
        dataDb,
        recordId: row._id,
      });
    }
    return revisionMap;
  } catch (err) {
    console.warn('failed to list data in project', err);
    throw Error('failed to list data in project');
  }
}

export async function deleteFAIMSDataForID({
  recordId: recordId,
  userId: userId,
  dataDb,
}: {
  dataDb: DataDbType;
  recordId: RecordID;
  userId: string;
}): Promise<RevisionID> {
  const record = await getRecord({dataDb, recordId});
  if (!record) {
    throw Error(`Could not find record with ID: ${recordId}`);
  }
  if (record.heads.length !== 1) {
    throw Error('Too many head revisions, must choose a specific head');
  }
  try {
    return await setRecordAsDeleted({
      dataDb,
      recordId,
      userId,
      baseRevisionId: record.heads[0],
    });
  } catch (err) {
    console.warn('failed to delete data with id', recordId, userId, err);
    throw Error('failed to delete data with id');
  }
}

export async function undeleteFAIMSDataForID({
  recordId,
  userId,
  dataDb,
}: {
  dataDb: DataDbType;
  recordId: RecordID;
  userId: string;
}): Promise<RevisionID> {
  const record = await getRecord({dataDb, recordId});
  if (!record) {
    throw new Error('Cannot find record with ID ' + recordId);
  }
  if (record.heads.length !== 1) {
    throw Error('Too many head revisions, must choose a specific head');
  }
  try {
    return await setRecordAsUndeleted({
      dataDb,
      recordId,
      baseRevisionId: record.heads[0],
      userId,
    });
  } catch (err) {
    console.warn('failed to undelete data with id', recordId, userId, err);
    throw Error('failed to undelete data with id');
  }
}

export async function setRecordAsDeleted({
  dataDb,
  recordId,
  baseRevisionId,
  userId,
}: {
  dataDb: DataDbType;
  recordId: RecordID;
  baseRevisionId: RevisionID;
  userId: string;
}): Promise<RevisionID> {
  const date = new Date();
  const baseRevision = await getRevision({dataDb, revisionId: baseRevisionId});
  const newRevisionId = generateFAIMSRevisionID();
  const newRevision: Revision = {
    _id: newRevisionId,
    revision_format_version: 1,
    avps: baseRevision.avps,
    type: baseRevision.type,
    record_id: recordId,
    parents: [baseRevisionId],
    created: date.toISOString(),
    created_by: userId,
    deleted: true,
    relationship: baseRevision.relationship,
  };
  await dataDb.put(newRevision);
  await updateHeads({
    dataDb,
    recordId,
    baseRevisionId: [baseRevision._id],
    newRevisionId,
  });
  return newRevisionId;
}

export async function setRecordAsUndeleted({
  recordId,
  baseRevisionId,
  userId,
  dataDb,
}: {
  recordId: RecordID;
  dataDb: DataDbType;
  baseRevisionId: RevisionID;
  userId: string;
}): Promise<RevisionID> {
  const date = new Date();
  const baseRevision = await getRevision({dataDb, revisionId: baseRevisionId});
  const newRevId = generateFAIMSRevisionID();
  const newRevision: Revision = {
    _id: newRevId,
    revision_format_version: 1,
    avps: baseRevision.avps,
    type: baseRevision.type,
    record_id: recordId,
    parents: [baseRevisionId],
    created: date.toISOString(),
    created_by: userId,
    deleted: false,
    relationship: baseRevision.relationship,
  };
  await dataDb.put(newRevision);
  await updateHeads({
    dataDb,
    recordId,
    baseRevisionId: [baseRevision._id],
    newRevisionId: newRevId,
  });
  return newRevId;
}

export async function getRecordMetadata({
  recordId,
  revisionId,
  dataDb,
  uiSpecification,
  projectId,
}: {
  projectId: string;
  dataDb: DataDbType;
  recordId: RecordID;
  revisionId: RevisionID;
  uiSpecification: ProjectUIModel;
}): Promise<RecordMetadata> {
  try {
    const record = await getRecord({dataDb, recordId});
    if (!record) {
      throw new Error(`Failed to find record with id ${recordId}`);
    }
    const revision = await getRevision({dataDb, revisionId});
    const hrid =
      (await getHRID({dataDb, revision, uiSpecification})) ?? recordId;
    return {
      project_id: projectId,
      record_id: recordId,
      revision_id: revisionId,
      created: new Date(record.created),
      created_by: record.created_by,
      updated: new Date(revision.created),
      updated_by: revision.created_by,
      conflicts: record.heads.length > 1,
      deleted: revision.deleted ? true : false,
      hrid: hrid,
      type: record.type,
      relationship: revision.relationship,
      avps: revision.avps,
    };
  } catch (err) {
    console.debug(
      'failed to get record metadata:',
      projectId,
      recordId,
      revisionId
    );
    logError(err);
    throw Error(
      `failed to get record metadata: ${projectId} ${recordId} ${revisionId}`
    );
  }
}

export async function getHRIDforRecordID({
  recordId,
  uiSpecification,
  dataDb,
}: {
  dataDb: DataDbType;
  recordId: RecordID;
  uiSpecification: ProjectUIModel;
}): Promise<string> {
  try {
    const record = await getRecord({dataDb, recordId});
    if (!record) {
      throw new Error(`Could not find record with id ${recordId}`);
    }
    const revisionId = record.heads[0];
    const revision = await getRevision({dataDb, revisionId});
    const hrid =
      (await getHRID({revision, uiSpecification, dataDb})) ?? recordId;
    return hrid;
  } catch (err) {
    console.warn('Failed to get hrid', err);
    return recordId;
  }
}

/**
 * getPossibleRelatedRecords - get all records of a given type but remove any that
 *   are already children of some parent if relation_type is Child
 *
 * @param projectId - project identifier
 * @param type - type of record we are looking for
 * @param relationType - 'faims-core::Child' or 'faims-core::Linked'
 * @param recordId - record id that might be the parent/source of this link
 * @param fieldId - field that will hold the relationship
 * @param relationLinkedVocabPair - names of the relationship
 * @returns  a promise resolving to an array of RecordReference objects
 */
export async function getPossibleRelatedRecords({
  projectId,
  dataDb,
  type,
  relationLinkedVocabPair = null,
  relationType,
  recordId,
  fieldId,
  uiSpecification,
}: {
  projectId: ProjectID;
  dataDb: DataDbType;
  type: FAIMSTypeName;
  relationType: string;
  recordId: string;
  fieldId: string;
  relationLinkedVocabPair: string[] | null;
  uiSpecification: ProjectUIModel;
}): Promise<RecordReference[]> {
  try {
    let relation_vocab: string[] | null = null;
    if (relationType !== 'faims-core::Child') {
      relation_vocab = [
        DEFAULT_RELATION_LINK_VOCABULARY,
        DEFAULT_RELATION_LINK_VOCABULARY,
      ]; //default value of the linked items
      if (
        relationLinkedVocabPair !== null &&
        relationLinkedVocabPair.length > 0
      )
        relation_vocab = relationLinkedVocabPair; //get the name from relation_linked_vocabPair
    }

    const records: RecordReference[] = [];
    await listRecordMetadata({
      projectId,
      dataDb,
      uiSpecification,
    }).then(record_list => {
      for (const key in record_list) {
        const metadata = record_list[key];

        let is_parent = false;
        const relationship = metadata['relationship'];

        if (relationType === 'faims-core::Child') {
          //check if record has the parent, record should only have one parent
          if (
            relationship === undefined ||
            relationship['parent'] === undefined ||
            relationship['parent'] === null ||
            relationship['parent'].record_id === undefined
          )
            is_parent = false;
          else if (relationship['parent'].record_id !== recordId)
            is_parent = true;
          else if (
            relationship['parent'].record_id === recordId &&
            relationship['parent'].field_id !== fieldId
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
              project_id: projectId,
              record_id: metadata.record_id,
              record_label: hrid,
            });
          else
            records.push({
              project_id: projectId,
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
    const records = await getAllRecordsOfType(projectId, type);
    console.warn(err);
    return records;
  }
}

/**
 * Remove records that are deleted or should not be displayed from a list of record metadata objects
 * @param projectId - project identifier
 * @param recordList - array of record metadata objects
 * @param filterDeleted - if true, we filter out deleted records
 * @returns an array of record metadata objects (Promise)
 */
async function filterRecordMetadata({
  tokenContents,
  projectId,
  recordList,
  filterDeleted,
}: {
  tokenContents: TokenContents;
  projectId: ProjectID;
  recordList: RecordMetadata[];
  filterDeleted: boolean;
}): Promise<RecordMetadata[]> {
  // compute should display and deletion filter for all records - promise
  // collection
  return Promise.all(
    recordList.map(async metadata => {
      const shouldKeep =
        !(metadata.deleted && filterDeleted) &&
        shouldDisplayRecord(tokenContents, projectId, metadata);
      return shouldKeep;
    })
  ).then(results => recordList.filter((_, index) => results[index]));
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

export async function getMetadataForSomeRecords({
  tokenContents,
  projectId,
  recordIds,
  filterDeleted,
  uiSpecification,
  dataDb,
}: {
  tokenContents: TokenContents;
  projectId: ProjectID;
  recordIds: RecordID[];
  filterDeleted: boolean;
  uiSpecification: ProjectUIModel;
  dataDb: DataDbType;
}): Promise<RecordMetadata[]> {
  try {
    const recordList = Object.values(
      await listRecordMetadata({
        dataDb,
        projectId: projectId,
        recordIds: recordIds,
        uiSpecification,
      })
    );
    return await filterRecordMetadata({
      tokenContents,
      projectId,
      recordList: sortByLastUpdated(recordList),
      filterDeleted,
    });
  } catch (error) {
    console.debug('Failed to get record metadata for', projectId);
    logError(error);
    return [];
  }
}

/**
 * Gets the full record (including data) for the given project by looking at the data DB registered in the module callback
 * @param tokenContents The user's parsed token - which allows the data model to check which records should be retrieved
 * @param projectId The ID of the project
 * @param filterDeleted Should the deleted records be included?
 * @param uiSpecification The UI specification - used to ascertain the correct HRID
 * @returns List of record metadata which includes populated data
 */
export async function getMetadataForAllRecords({
  tokenContents,
  projectId,
  filterDeleted,
  uiSpecification,
  dataDb,
}: {
  tokenContents: TokenContents;
  projectId: ProjectID;
  filterDeleted: boolean;
  uiSpecification: ProjectUIModel;
  dataDb: DataDbType;
}): Promise<RecordMetadata[]> {
  try {
    const record_list = Object.values(
      await listRecordMetadata({
        dataDb,
        projectId: projectId,
        uiSpecification,
      })
    );
    return await filterRecordMetadata({
      tokenContents,
      projectId,
      filterDeleted,
      recordList: sortByLastUpdated(record_list),
    });
  } catch (error) {
    console.debug('Failed to get record metadata for', projectId);
    logError(error);
    return [];
  }
}

export async function getRecordsWithRegex({
  tokenContents,
  projectId,
  regex,
  filterDeleted,
  uiSpecification,
  dataDb,
}: {
  tokenContents: TokenContents;
  projectId: ProjectID;
  regex: string;
  filterDeleted: boolean;
  uiSpecification: ProjectUIModel;
  dataDb: DataDbType;
}): Promise<RecordMetadata[]> {
  try {
    const recordList = await getAllRecordsWithRegex({
      dataDb,
      regex,
      uiSpecification,
      projectId,
    });
    return await filterRecordMetadata({
      tokenContents,
      projectId,
      recordList: sortByLastUpdated(recordList),
      filterDeleted,
    });
  } catch (error) {
    console.debug('Failed to regex search for', projectId, regex);
    logError(error);
    return [];
  }
}

export async function getMinimalRecordDataWithRegex({
  tokenContents,
  projectId,
  regex,
  filterDeleted,
  uiSpecification,
  dataDb,
}: {
  tokenContents: TokenContents;
  projectId: ProjectID;
  regex: string;
  filterDeleted: boolean;
  uiSpecification: ProjectUIModel;
  dataDb: DataDbType;
}): Promise<UnhydratedRecord[]> {
  try {
    const recordList = await getAllRecordsWithRegex({
      dataDb,
      regex,
      uiSpecification,
      projectId,
      hydrate: false,
    });
    return await filterRecordMetadata({
      tokenContents,
      projectId,
      recordList: sortByLastUpdated(recordList),
      filterDeleted,
    });
  } catch (error) {
    console.debug('Failed to regex search for', projectId, regex);
    logError(error);
    return [];
  }
}

/**
 * Gets minimal info about responses - does NOT hydrate data/hrid.
 *
 * @param tokenContents The user's parsed token - which allows the data model to check which records should be retrieved
 * @param projectId The ID of the project
 * @param filterDeleted Should the deleted records be included?
 * @param uiSpecification The UI specification - used to ascertain the correct HRID
 * @param dataDb The record data db
 * @returns List of record metadata which excludes HRID and data fields (as omitted in typing)
 */
export async function getMinimalRecordData({
  tokenContents,
  projectId,
  filterDeleted,
  uiSpecification,
  dataDb,
}: {
  tokenContents: TokenContents;
  projectId: ProjectID;
  filterDeleted: boolean;
  uiSpecification: ProjectUIModel;
  dataDb: DataDbType;
}): Promise<UnhydratedRecord[]> {
  try {
    const recordList = await listRecordMetadata({
      dataDb,
      projectId: projectId,
      uiSpecification,
      hydrate: false,
    });
    return await filterRecordMetadata({
      tokenContents,
      projectId,
      recordList: sortByLastUpdated(recordList),
      filterDeleted,
    });
  } catch (error) {
    console.debug('Failed to get record metadata for', projectId);
    logError(error);
    return [];
  }
}

export const hydrateRecord = async ({
  projectId,
  dataDb,
  record,
  uiSpecification,
}: {
  projectId: string;
  dataDb: DataDbType;
  record: RecordRevisionIndexDocument;
  uiSpecification: ProjectUIModel;
}) => {
  try {
    const hrid = await getHRID({
      dataDb,
      revision: record.revision,
      uiSpecification,
    });
    const formData: FormData = await getFormDataFromRevision({
      dataDb,
      revision: record.revision,
    });
    const result = {
      project_id: projectId,
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
  } catch (e) {
    throw new Error(
      `Failed to get HRID of record ${record.record_id} revision ${record.revision}. ${e}`
    );
  }
};

export interface RecordRevisionIndexDocument {
  record_id: string;
  revision_id: string;
  created: number;
  created_by: string;
  conflict: boolean;
  type: string;
  revision: Revision;
}

export async function getSomeRecords(
  project_id: ProjectID,
  limit: number,
  bookmark: string | null = null,
  filter_deleted = true
): Promise<RecordRevisionIndexDocument[]> {
  const dataDB: PouchDB.Database<ProjectDataObject> | undefined =
    await getDataDB(project_id);
  if (!dataDB) throw Error('No data DB with project ID ' + project_id);

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
        created_by: doc.value.created_by,
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
 * @param projectId project identifier
 */
export const notebookRecordIterator = async ({
  projectId,
  viewID,
  filterDeleted = true,
  uiSpecification,
  dataDb,
}: {
  projectId: string;
  dataDb: DataDbType;
  viewID: string;
  filterDeleted?: boolean;
  uiSpecification: ProjectUIModel;
}) => {
  const batchSize = 20;
  const getNextBatch = async (bookmark: string | null) => {
    const records = await getSomeRecords(
      projectId,
      batchSize,
      bookmark,
      filterDeleted
    );
    // select just those in this view
    const result = records.filter((record: any) => {
      return record.type === viewID;
    });
    if (records.length > 0 && result.length === 0) {
      // skip to next batch since none of these match our view
      const newBookmark = records[records.length - 1].record_id;
      return getNextBatch(newBookmark);
    }
    return {done: records.length === 0, records: result};
  };

  let batch = await getNextBatch(null);
  // deal with end of records
  if (batch.done) {
    return {next: async () => ({record: null, done: true})};
  }
  let index = 0;
  const recordIterator = {
    async next() {
      let record;
      if (index < batch.records.length) {
        record = batch.records[index];
        index++;
      } else {
        // Explicit cleanup before fetching next batch
        const lastRecordId = batch.records[batch.records.length - 1]?.record_id;
        batch.records.length = 0; // Clear the array

        if (!lastRecordId) {
          return {record: null, done: true};
        }

        // Fetch next batch
        batch = await getNextBatch(lastRecordId);
        if (batch.records.length > 0) {
          record = batch.records[0];
          index = 1;
        }
      }
      if (record) {
        try {
          const data = await hydrateRecord({
            projectId,
            record,
            uiSpecification,
            dataDb,
          });
          // clear the record to help GC
          record = null;
          return {record: data, done: false};
        } catch (error) {
          console.error(error);
          return {record: null, done: false};
        }
      } else {
        return {record: null, done: true};
      }
    },
  };
  return recordIterator;
};
