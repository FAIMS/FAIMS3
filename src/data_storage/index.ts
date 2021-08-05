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

import {getDataDB} from '../sync';
import {
  Observation,
  ObservationID,
  ObservationMetadata,
  ProjectID,
  Revision,
  RevisionID,
  //  OBSERVATION_INDEX_NAME,
} from '../datamodel';
import {
  addNewRevisionFromForm,
  generateFAIMSRevisionID,
  getObservation,
  getRevision,
  getFormDataFromRevision,
  updateHeads,
} from './internals';

export interface ProjectRevisionListing {
  [_id: string]: string[];
}

export type ObservationRevisionListing = RevisionID[];

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

export async function getFirstObservationHead(
  project_id: ProjectID,
  observation_id: ObservationID
): Promise<RevisionID> {
  const observation = await getObservation(project_id, observation_id);
  return observation.heads[0];
}

export async function upsertFAIMSData(
  project_id: ProjectID,
  observation: Observation
): Promise<RevisionID> {
  if (observation.observation_id === undefined) {
    throw Error('observation_id required to save observation');
  }
  const revision_id = generateFAIMSRevisionID();
  if (observation.revision_id === null) {
    const datadb = getDataDB(project_id);
    const new_encoded_observation = {
      _id: observation.observation_id,
      observation_format_version: 1,
      created: observation.updated.toISOString(),
      created_by: observation.updated_by,
      revisions: [revision_id],
      heads: [revision_id],
    };
    try {
      await datadb.put(new_encoded_observation);
    } catch (err) {
      // TODO: add proper error handling for conflicts
      console.warn(err);
      throw Error('failed to create observation document');
    }
    await addNewRevisionFromForm(project_id, observation, revision_id);
  } else {
    await addNewRevisionFromForm(project_id, observation, revision_id);
    await updateHeads(
      project_id,
      observation.observation_id,
      observation.revision_id,
      revision_id
    );
  }
  return revision_id;
}

export async function getFullObservationData(
  project_id: ProjectID,
  observation_id: ObservationID,
  revision_id: RevisionID
): Promise<Observation | null> {
  const revision = await getRevision(project_id, revision_id);
  if (revision.deleted === true) {
    return null;
  }
  const observation = await getObservation(project_id, observation_id);
  const form_data = await getFormDataFromRevision(project_id, revision);
  return {
    project_id: project_id,
    observation_id: observation_id,
    revision_id: revision_id,
    type: revision.type,
    data: form_data,
    updated_by: revision.created_by,
    updated: new Date(revision.created),
    created: new Date(observation.created),
    created_by: observation.created_by,
  };
}

export async function listFAIMSObservationRevisions(
  project_id: ProjectID,
  observation_id: ObservationID
): Promise<ObservationRevisionListing> {
  try {
    const observation = await getObservation(project_id, observation_id);
    return observation.revisions;
  } catch (err) {
    console.warn(err);
    throw Error(`failed to list data for id ${observation_id}`);
  }
}

export async function listFAIMSProjectRevisions(
  project_id: ProjectID
): Promise<ProjectRevisionListing> {
  const datadb = getDataDB(project_id);
  try {
    const result = await datadb.allDocs();
    const revmap: ProjectRevisionListing = {};
    for (const row of result.rows) {
      const _id: ObservationID = row.key;
      revmap[_id] = await listFAIMSObservationRevisions(project_id, _id);
    }
    return revmap;
  } catch (err) {
    console.warn(err);
    throw Error('failed to list data in project');
  }
}

export async function deleteFAIMSDataForID(
  project_id: ProjectID,
  observation_id: ObservationID,
  userid: string
): Promise<RevisionID> {
  const observation = await getObservation(project_id, observation_id);
  if (observation.heads.length !== 1) {
    throw Error('Too many head revisions, must choose a specific head');
  }
  try {
    return await setObservationAsDeleted(
      project_id,
      observation_id,
      observation.heads[0],
      userid
    );
  } catch (err) {
    console.warn(err);
    throw Error('failed to delete data with id');
  }
}

export async function undeleteFAIMSDataForID(
  project_id: ProjectID,
  observation_id: ObservationID,
  userid: string
): Promise<RevisionID> {
  const observation = await getObservation(project_id, observation_id);
  if (observation.heads.length !== 1) {
    throw Error('Too many head revisions, must choose a specific head');
  }
  try {
    return await setObservationAsUndeleted(
      project_id,
      observation_id,
      observation.heads[0],
      userid
    );
  } catch (err) {
    console.warn(err);
    throw Error('failed to undelete data with id');
  }
}

export async function setObservationAsDeleted(
  project_id: ProjectID,
  obsid: ObservationID,
  base_revid: RevisionID,
  user: string
): Promise<RevisionID> {
  const datadb = getDataDB(project_id);
  const date = new Date();
  const base_revision = await getRevision(project_id, base_revid);
  const new_rev_id = generateFAIMSRevisionID();
  const new_revision: Revision = {
    _id: new_rev_id,
    revision_format_version: 1,
    datums: base_revision.datums,
    type: base_revision.type,
    observation_id: obsid,
    parents: [base_revid],
    created: date.toISOString(),
    created_by: user,
    deleted: true,
  };
  await datadb.put(new_revision);
  await updateHeads(project_id, obsid, base_revision._id, new_rev_id);
  return new_rev_id;
}

export async function setObservationAsUndeleted(
  project_id: ProjectID,
  obsid: ObservationID,
  base_revid: RevisionID,
  user: string
): Promise<RevisionID> {
  const datadb = getDataDB(project_id);
  const date = new Date();
  const base_revision = await getRevision(project_id, base_revid);
  const new_rev_id = generateFAIMSRevisionID();
  const new_revision: Revision = {
    _id: new_rev_id,
    revision_format_version: 1,
    datums: base_revision.datums,
    type: base_revision.type,
    observation_id: obsid,
    parents: [base_revid],
    created: date.toISOString(),
    created_by: user,
    deleted: false,
  };
  await datadb.put(new_revision);
  await updateHeads(project_id, obsid, base_revision._id, new_rev_id);
  return new_rev_id;
}

export async function getObservationMetadata(
  project_id: ProjectID,
  observation_id: ObservationID,
  revision_id: RevisionID
): Promise<ObservationMetadata> {
  try {
    const observation = await getObservation(project_id, observation_id);
    const revision = await getRevision(project_id, revision_id);
    return {
      project_id: project_id,
      observation_id: observation_id,
      revision_id: revision_id,
      created: new Date(observation.created),
      created_by: observation.created_by,
      updated: new Date(revision.created),
      updated_by: revision.created_by,
      conflicts: observation.heads.length > 1,
    };
  } catch (err) {
    console.error(err);
    throw Error('failed to get metadata');
  }
}
