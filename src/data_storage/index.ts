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

import {v4 as uuidv4} from 'uuid';

import {DEBUG_APP} from '../buildconfig';
import {getDataDB} from '../sync';
import {
  RecordID,
  ProjectID,
  RevisionID,
  FAIMSTypeName,
} from '../datamodel/core';
import {Revision} from '../datamodel/database';
import {Record, RecordMetadata, RecordReference} from '../datamodel/ui';
import {shouldDisplayRecord} from '../users';
import {
  addNewRevisionFromForm,
  createNewRecord,
  generateFAIMSRevisionID,
  getRecord,
  getRevision,
  getFormDataFromRevision,
  updateHeads,
  getHRID,
  listRecordMetadata,
} from './internals';
import {getAllRecordsOfType, getAllRecordsWithRegex} from './queries';

export interface ProjectRevisionListing {
  [_id: string]: string[];
}

export type RecordRevisionListing = RevisionID[];

export function generateFAIMSDataID(): RecordID {
  return 'rec-' + uuidv4();
}

export async function getFirstRecordHead(
  project_id: ProjectID,
  record_id: RecordID
): Promise<RevisionID> {
  const record = await getRecord(project_id, record_id);
  return record.heads[0];
}

export async function upsertFAIMSData(
  project_id: ProjectID,
  record: Record
): Promise<RevisionID> {
  if (record.record_id === undefined) {
    throw Error('record_id required to save record');
  }
  const revision_id = generateFAIMSRevisionID();
  if (record.revision_id === null) {
    if (DEBUG_APP) {
      console.info('New record', record);
    }
    await createNewRecord(project_id, record, revision_id);
    await addNewRevisionFromForm(project_id, record, revision_id);
  } else {
    if (DEBUG_APP) {
      console.info('Update existing record', record);
    }
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

export async function getFullRecordData(
  project_id: ProjectID,
  record_id: RecordID,
  revision_id: RevisionID
): Promise<Record | null> {
  const revision = await getRevision(project_id, revision_id);
  if (revision.deleted === true) {
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
    relationship: {
      // parent: {},
      linked: [],
    },
  };
}

export async function listFAIMSRecordRevisions(
  project_id: ProjectID,
  record_id: RecordID
): Promise<RecordRevisionListing> {
  try {
    const record = await getRecord(project_id, record_id);
    return record.revisions;
  } catch (err) {
    console.warn('failed to list data for id', record_id, err);
    throw Error(`failed to list data for id ${record_id}`);
  }
}

export async function listFAIMSProjectRevisions(
  project_id: ProjectID
): Promise<ProjectRevisionListing> {
  const datadb = await getDataDB(project_id);
  try {
    const result = await datadb.allDocs();
    const revmap: ProjectRevisionListing = {};
    for (const row of result.rows) {
      const _id: RecordID = row.key;
      revmap[_id] = await listFAIMSRecordRevisions(project_id, _id);
    }
    return revmap;
  } catch (err) {
    console.warn('failed to list data in project', project_id, err);
    throw Error('failed to list data in project');
  }
}

export async function deleteFAIMSDataForID(
  project_id: ProjectID,
  record_id: RecordID,
  userid: string
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
      userid
    );
  } catch (err) {
    console.warn(
      'failed to delete data with id',
      project_id,
      record_id,
      userid,
      err
    );
    throw Error('failed to delete data with id');
  }
}

export async function undeleteFAIMSDataForID(
  project_id: ProjectID,
  record_id: RecordID,
  userid: string
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
      userid
    );
  } catch (err) {
    console.warn(
      'failed to undelete data with id',
      project_id,
      record_id,
      userid,
      err
    );
    throw Error('failed to undelete data with id');
  }
}

export async function setRecordAsDeleted(
  project_id: ProjectID,
  obsid: RecordID,
  base_revid: RevisionID,
  user: string
): Promise<RevisionID> {
  const datadb = await getDataDB(project_id);
  const date = new Date();
  const base_revision = await getRevision(project_id, base_revid);
  const new_rev_id = generateFAIMSRevisionID();
  const new_revision: Revision = {
    _id: new_rev_id,
    revision_format_version: 1,
    avps: base_revision.avps,
    type: base_revision.type,
    record_id: obsid,
    parents: [base_revid],
    created: date.toISOString(),
    created_by: user,
    deleted: true,
  };
  await datadb.put(new_revision);
  await updateHeads(project_id, obsid, [base_revision._id], new_rev_id);
  return new_rev_id;
}

export async function setRecordAsUndeleted(
  project_id: ProjectID,
  obsid: RecordID,
  base_revid: RevisionID,
  user: string
): Promise<RevisionID> {
  const datadb = await getDataDB(project_id);
  const date = new Date();
  const base_revision = await getRevision(project_id, base_revid);
  const new_rev_id = generateFAIMSRevisionID();
  const new_revision: Revision = {
    _id: new_rev_id,
    revision_format_version: 1,
    avps: base_revision.avps,
    type: base_revision.type,
    record_id: obsid,
    parents: [base_revid],
    created: date.toISOString(),
    created_by: user,
    deleted: false,
  };
  await datadb.put(new_revision);
  await updateHeads(project_id, obsid, [base_revision._id], new_rev_id);
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
    };
  } catch (err) {
    console.error(
      'failed to get record metadata:',
      project_id,
      record_id,
      revision_id,
      err
    );
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
  type: FAIMSTypeName
): Promise<RecordReference[]> {
  try {
    const records: RecordReference[] = [];
    await listRecordMetadata(project_id).then(record_list => {
      for (const key in record_list) {
        const metadata = record_list[key];
        if (DEBUG_APP) {
          console.debug('Records', key, metadata);
        }
        if (!metadata.deleted && metadata.type === type) {
          records.push({
            project_id: project_id,
            record_id: metadata.record_id,
            record_label: metadata.hrid, // TODO: decide how we're getting HRIDs from db
          });
          if (DEBUG_APP) {
            console.debug('Not deleted Records', key, metadata);
          }
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

async function filterRecordMetadata(
  project_id: ProjectID,
  record_list: RecordMetadata[],
  filter_deleted: boolean
): Promise<RecordMetadata[]> {
  const new_record_list: RecordMetadata[] = [];
  for (const metadata of record_list) {
    if (DEBUG_APP) {
      console.debug('Records', metadata);
    }
    if (
      !(metadata.deleted && filter_deleted) &&
      (await shouldDisplayRecord(project_id, metadata))
    ) {
      new_record_list.push(metadata);
      if (DEBUG_APP) {
        console.debug('Not deleted Records', metadata);
      }
    }
  }
  if (DEBUG_APP) {
    console.debug('Reduced record list', new_record_list);
  }
  return new_record_list;
}

export async function getMetadataForAllRecords(
  project_id: ProjectID,
  filter_deleted: boolean
): Promise<RecordMetadata[]> {
  try {
    const record_list = Object.values(await listRecordMetadata(project_id));
    return await filterRecordMetadata(project_id, record_list, filter_deleted);
  } catch (error) {
    console.error('Failed to get record metadata for', project_id, error);
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
    console.error('Failed to regex search for', project_id, regex, error);
    return [];
  }
}
