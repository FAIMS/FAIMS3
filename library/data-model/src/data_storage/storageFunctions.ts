/**
 * The Data Storage module provides an API for accessing data from the GUI.
 * @module data_storage
 * @category Database
 */

// Install plugin since we use the .query method here
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);

import {getDataDB, shouldDisplayRecord} from '../callbacks';
import {logError} from '../logging';
import {TokenContents} from '../permission/types';
import {
  Annotations,
  DatabaseInterface,
  DataDbType,
  ProjectDataObject,
  ProjectID,
  ProjectRevisionListing,
  Record,
  RecordID,
  RecordMetadata,
  RecordRevisionListing,
  Relationship,
  Revision,
  RevisionDbType,
  RevisionID,
  UnhydratedRecord,
} from '../types';
import {UiSpecModel} from '../uiSpecification/types';
import {randomUuid} from '../utils';
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
  RECORD_REVISIONS_INDEX,
  REVISIONS_INDEX,
  updateHeads,
} from './internals';
import {getAllRecordsWithRegex} from './queries';
import {
  hasUpdatedTimeFilter,
  queryRecordIdsByUpdated,
  recordUpdatedInWindow,
  UpdatedTimeIndexError,
  UpdatedTimeFilter,
} from './updatedTimeFilter';

export function generateFAIMSDataID(): RecordID {
  return 'rec-' + randomUuid();
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
    updated: new Date(record.updatedAt),
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
  dataDb: DataDbType | RevisionDbType;
}): Promise<ProjectRevisionListing> {
  try {
    // get all revision
    const result = await queryCouch<Revision>({
      db: dataDb as RevisionDbType,
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
  const baseRevision = await getRevision({
    dataDb,
    revisionId: baseRevisionId,
  });
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
    updatedAt: date.toISOString(),
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
  const baseRevision = await getRevision({
    dataDb,
    revisionId: baseRevisionId,
  });
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
    updatedAt: date.toISOString(),
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
  uiSpecification: UiSpecModel;
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
      updated: new Date(record.updatedAt),
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
  uiSpecification: UiSpecModel;
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
  uiSpecification: UiSpecModel;
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
  uiSpecification: UiSpecModel;
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

/**
 * List records matching `regex` (legacy export dump). When `regex` is `.*` or
 * empty and a time window is set, uses {@link queryRecordIdsByUpdated} instead
 * of a full scan; otherwise filters the regex result in memory.
 *
 * @param updatedAfter exclusive lower bound on record.updated (epoch ms)
 * @param updatedBefore exclusive upper bound on record.updated (epoch ms)
 */
export async function getRecordsWithRegex({
  tokenContents,
  projectId,
  regex,
  filterDeleted,
  uiSpecification,
  dataDb,
  updatedAfter,
  updatedBefore,
}: {
  tokenContents: TokenContents;
  projectId: ProjectID;
  regex: string;
  filterDeleted: boolean;
  uiSpecification: UiSpecModel;
  dataDb: DataDbType;
  updatedAfter?: number;
  updatedBefore?: number;
}): Promise<RecordMetadata[]> {
  try {
    const timeFilter = {updatedAfter, updatedBefore};
    let recordList: RecordMetadata[];
    if (hasUpdatedTimeFilter(timeFilter) && (regex === '.*' || regex === '')) {
      const {recordIds} = await queryRecordIdsByUpdated({
        dataDb,
        updatedAfter,
        updatedBefore,
      });
      recordList = await listRecordMetadata({
        dataDb,
        projectId,
        recordIds,
        uiSpecification,
      });
    } else {
      recordList = await getAllRecordsWithRegex({
        dataDb,
        regex,
        uiSpecification,
        projectId,
      });
      if (hasUpdatedTimeFilter(timeFilter)) {
        recordList = recordList.filter(record =>
          recordUpdatedInWindow(record.updated, timeFilter)
        );
      }
    }
    return await filterRecordMetadata({
      tokenContents,
      projectId,
      recordList: sortByLastUpdated(recordList),
      filterDeleted,
    });
  } catch (error) {
    if (error instanceof UpdatedTimeIndexError) throw error;
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
  uiSpecification: UiSpecModel;
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
  uiSpecification: UiSpecModel;
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

export interface HydratedDataRecord {
  project_id: ProjectID;
  record_id: string;
  revision_id: string;
  created_by: string;
  updated: Date;
  updated_by: string;
  deleted: boolean;
  hrid: string | null;
  relationship: Relationship | undefined;
  data: {[k: string]: any};
  annotations: {[k: string]: Annotations};
  types: {[k: string]: string};
  created: Date;
  conflicts: boolean;
  type: string;
}

export const hydrateRecord = async ({
  projectId,
  dataDb,
  record,
  uiSpecification,
  includeAttachments = true,
}: {
  projectId: string;
  dataDb: DataDbType;
  record: RecordRevisionIndexDocument;
  uiSpecification: UiSpecModel;
  includeAttachments?: boolean;
}): Promise<HydratedDataRecord> => {
  try {
    const hrid = await getHRID({
      dataDb,
      revision: record.revision,
      uiSpecification,
    });
    const formData: FormData = await getFormDataFromRevision({
      dataDb,
      revision: record.revision,
      includeAttachments,
    });
    const result = {
      project_id: projectId,
      record_id: record.record_id,
      revision_id: record.revision_id,
      created_by: record.created_by,
      updated: new Date(record.updatedAt),
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
  updatedAt: string;
  conflict: boolean;
  type: string;
  revision: Revision;
}

/** Map Couch `recordRevisions` view rows into the iterator's record shape. */
function mapRecordRevisionRows(
  rows: Array<{id: string; value: any; doc?: any}>
): RecordRevisionIndexDocument[] {
  return rows.map(doc => ({
    record_id: doc.id,
    revision_id: doc.value._id,
    created: doc.value.created,
    created_by: doc.value.created_by,
    updatedAt: doc.value.updatedAt,
    conflict: doc.value.conflict,
    type: doc.value.type,
    revision: doc.doc,
  }));
}

/**
 * Fetch a page of record+head-revision stubs for {@link notebookRecordIterator}.
 * Without a time filter, `bookmark` is a record id (the previous page's last
 * id); that row is skipped so it is not returned twice. With a time filter,
 * `bookmark` is a JSON `[updatedMs, recordId]` cursor from
 * {@link queryRecordIdsByUpdated}.
 */
export async function getSomeRecords(
  project_id: ProjectID,
  limit: number,
  bookmark: string | null = null,
  filter_deleted = true,
  updatedFilter?: UpdatedTimeFilter
): Promise<{
  records: RecordRevisionIndexDocument[];
  nextStartKey?: string;
}> {
  const dataDB: DatabaseInterface<ProjectDataObject> | undefined =
    await getDataDB(project_id);
  if (!dataDB) throw Error('No data DB with project ID ' + project_id);

  try {
    if (hasUpdatedTimeFilter(updatedFilter)) {
      const timed = await queryRecordIdsByUpdated({
        dataDb: dataDB,
        updatedAfter: updatedFilter?.updatedAfter,
        updatedBefore: updatedFilter?.updatedBefore,
        limit,
        startKey: bookmark ?? undefined,
      });
      if (timed.recordIds.length === 0) {
        return {records: [], nextStartKey: timed.nextStartKey};
      }
      const res = await dataDB.query(RECORD_REVISIONS_INDEX, {
        keys: timed.recordIds,
        include_docs: true,
      });
      const byId = new Map(
        res.rows.map((row: {id: string}) => [row.id, row] as const)
      );
      let record_list = mapRecordRevisionRows(
        timed.recordIds
          .map(id => byId.get(id))
          .filter((row): row is {id: string; value: any; doc?: any} =>
            Boolean(row)
          )
      );
      if (filter_deleted) {
        // guarding against there being no revision which should not happen but has
        record_list = record_list.filter(record => !record.revision?.deleted);
      }
      return {
        records: record_list,
        nextStartKey: timed.nextStartKey,
      };
    }

    const options: {[key: string]: any} = {
      limit: limit,
      include_docs: true,
    };
    // if we have a bookmark, start from there
    if (bookmark !== null) {
      options.startkey = bookmark;
    }
    const res = await dataDB.query(RECORD_REVISIONS_INDEX, options);
    let record_list = mapRecordRevisionRows(res.rows);
    if (filter_deleted) {
      // guarding against there being no revision which should not happen but has
      record_list = record_list.filter(record => !record.revision?.deleted);
    }
    // don't return the first record if we have a bookmark
    // as it will be the bookmarked record
    if (bookmark !== null) {
      record_list = record_list.slice(1);
    }
    const lastId = record_list[record_list.length - 1]?.record_id;
    return {
      records: record_list,
      ...(lastId !== undefined ? {nextStartKey: lastId} : {}),
    };
  } catch (err) {
    if (
      hasUpdatedTimeFilter(updatedFilter) ||
      err instanceof UpdatedTimeIndexError
    ) {
      throw err;
    }
    console.log('failed to get some records', err);
    return {records: []};
  }
}

/**
 * Return an iterator over the records in a notebook.
 * @param projectId project identifier
 * @param updatedAfter exclusive lower bound on record.updatedAt (epoch ms)
 * @param updatedBefore exclusive upper bound on record.updatedAt (epoch ms)
 */
export const notebookRecordIterator = async ({
  projectId,
  viewID,
  filterDeleted = true,
  uiSpecification,
  includeAttachments = true,
  dataDb,
  updatedAfter,
  updatedBefore,
}: {
  projectId: string;
  dataDb: DataDbType;
  viewID?: string;
  filterDeleted?: boolean;
  // Do not recommend including attachments since this incurs a lot of memory
  // overhead - these are buffered as File like objects straight into the
  // response. Use the nano couchdb node client to use attachment.getAsStream
  includeAttachments?: boolean;
  uiSpecification: UiSpecModel;
  updatedAfter?: number;
  updatedBefore?: number;
}) => {
  const batchSize = 20;
  const updatedFilter: UpdatedTimeFilter = {updatedAfter, updatedBefore};
  const timeFilterActive = hasUpdatedTimeFilter(updatedFilter);
  const getNextBatch = async (bookmark: string | null) => {
    const {records, nextStartKey} = await getSomeRecords(
      projectId,
      batchSize,
      bookmark,
      filterDeleted,
      timeFilterActive ? updatedFilter : undefined
    );
    // select just those in this view
    const result = viewID
      ? records.filter(record => record.type === viewID)
      : records;
    if (records.length === 0) {
      if (timeFilterActive && nextStartKey) {
        return getNextBatch(nextStartKey);
      }
      return {done: true, records: [] as typeof records, nextStartKey};
    }
    if (result.length === 0) {
      // skip to next batch since none of these match our view
      if (!nextStartKey) {
        return {done: true, records: result, nextStartKey: undefined};
      }
      return getNextBatch(nextStartKey);
    }
    return {done: false, records: result, nextStartKey};
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
        batch.records.length = 0; // Clear the array

        if (!batch.nextStartKey) {
          return {record: null, done: true};
        }

        // Fetch next batch
        batch = await getNextBatch(batch.nextStartKey);
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
            includeAttachments,
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
