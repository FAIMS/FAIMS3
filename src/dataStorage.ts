/*
 * Copyright 2021 Macquarie University
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
 * Filename: dataStorage.ts
 * Description: 
 *   TODO
 */
 
import {v4 as uuidv4} from 'uuid';

import {getDataDB} from './sync';
import {
  Observation,
  EncodedObservation,
  ObservationList,
  ProjectID,
  ObservationID,
  //  OBSERVATION_INDEX_NAME,
} from './datamodel';

export interface DataListing {
  [_id: string]: string[];
}

export function generateFAIMSDataID(): ObservationID {
  return uuidv4();
}

// Commented as this does not work with the find below for some unknown reason
//async function ensureObservationIndex(project_id: ProjectID) {
//  const datadb = getDataDB(project_id);
//  try {
//    return datadb.createIndex({
//      index: {
//        fields: ['format_version'],
//        name: OBSERVATION_INDEX_NAME,
//      },
//    });
//  } catch (err) {
//    console.error(err);
//    throw Error('Failed to create observation index');
//  }
//}

function convertFromFormToDB(
  doc: Observation,
  revision: string | undefined = undefined
): EncodedObservation {
  if (revision !== undefined) {
    return {
      _id: doc.observation_id,
      _rev: revision,
      type: doc.type,
      data: doc.data,
      created: doc.created.toISOString(),
      created_by: doc.created_by,
      updated: doc.updated.toISOString(),
      updated_by: doc.updated_by,
      format_version: 1,
    };
  }
  if (doc._rev !== undefined) {
    return {
      _id: doc.observation_id,
      _rev: doc._rev,
      type: doc.type,
      data: doc.data,
      created: doc.created.toISOString(),
      created_by: doc.created_by,
      updated: doc.updated.toISOString(),
      updated_by: doc.updated_by,
      format_version: 1,
    };
  }
  return {
    _id: doc.observation_id,
    type: doc.type,
    data: doc.data,
    created: doc.created.toISOString(),
    created_by: doc.created_by,
    updated: doc.updated.toISOString(),
    updated_by: doc.updated_by,
    format_version: 1,
  };
}

export function convertFromDBToForm(
  doc: EncodedObservation
): Observation | null {
  if (doc.deleted) {
    return null;
  }
  return {
    observation_id: doc._id,
    type: doc.type,
    data: doc.data,
    created: new Date(doc.created),
    created_by: doc.created_by,
    updated: new Date(doc.updated),
    updated_by: doc.updated_by,
  };
}

async function getLatestRevision(
  project_id: ProjectID,
  docid: string
): Promise<string | undefined> {
  const datadb = getDataDB(project_id);
  try {
    const doc = await datadb.get(docid);
    return doc._rev;
  } catch (err) {
    console.debug(err);
    return undefined;
  }
}

export async function upsertFAIMSData(project_id: ProjectID, doc: Observation) {
  const datadb = getDataDB(project_id);
  if (doc.observation_id === undefined) {
    throw Error('observation_id required to save observation');
  }
  try {
    const revision = await getLatestRevision(project_id, doc.observation_id);
    return await datadb.put(convertFromFormToDB(doc, revision));
  } catch (err) {
    console.warn(err);
    throw Error('failed to save data');
  }
}

export async function lookupFAIMSDataID(
  project_id: ProjectID,
  observation_id: ObservationID
): Promise<Observation | null> {
  const datadb = getDataDB(project_id);
  try {
    const doc = await datadb.get(observation_id);
    return convertFromDBToForm(doc);
  } catch (err) {
    if (err.status === 404 && err.reason === 'deleted') {
      return null;
    }
    console.warn(err);
    throw Error(`failed to find data with id ${observation_id}`);
  }
}

/**
 * Returns a list of not deleted observations
 * @param project_id Project ID to get list of observation for
 * @returns key: observation id, value: observation (NOT NULL)
 */
export async function listFAIMSData(
  project_id: ProjectID
): Promise<ObservationList> {
  const datadb = getDataDB(project_id);
  try {
    //await ensureObservationIndex(project_id);
    const all = await datadb.find({
      selector: {format_version: {$eq: 1}},
      //use_index: OBSERVATION_INDEX_NAME,
    });
    const retval: ObservationList = {};
    all.docs.forEach(row => {
      const converted = convertFromDBToForm(row);
      if (converted !== null) {
        retval[row._id] = converted;
      }
    });
    return retval;
  } catch (err) {
    console.warn(err);
    throw Error('failed to get data');
  }
}

export async function listFAIMSProjectRevisions(
  project_id: ProjectID
): Promise<DataListing> {
  const datadb = getDataDB(project_id);
  try {
    const result = await datadb.allDocs();
    const revmap: DataListing = {};
    for (const row of result.rows) {
      const _id: string = row.key;
      const doc = await datadb.get(_id, {revs: true});
      const revisions = doc._revisions;
      if (revisions === undefined) {
        throw Error('revisions not found');
      }
      const revs = revisions.ids;
      let revs_num = revisions.start;
      const nice_revs = [];
      for (const rev of revs) {
        nice_revs.push(revs_num.toString() + '-' + rev);
        revs_num = revs_num - 1;
      }
      revmap[_id] = nice_revs;
    }
    return revmap;
  } catch (err) {
    console.warn(err);
    throw Error('failed to list data in project');
  }
}

export async function deleteFAIMSDataForID(
  project_id: ProjectID,
  observation_id: ObservationID
) {
  const datadb = getDataDB(project_id);
  try {
    const doc = await datadb.get(observation_id);
    doc.deleted = true;
    return await datadb.put(doc);
  } catch (err) {
    console.warn(err);
    throw Error('failed to delete data with id');
  }
}

export async function undeleteFAIMSDataForID(
  project_id: ProjectID,
  observation_id: ObservationID
) {
  const datadb = getDataDB(project_id);
  try {
    const doc = await datadb.get(observation_id);
    doc.deleted = false;
    return await datadb.put(doc);
  } catch (err) {
    console.warn(err);
    throw Error('failed to undelete data with id');
  }
}
