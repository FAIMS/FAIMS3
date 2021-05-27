import {v4 as uuidv4} from 'uuid';

import {getDataDB} from './sync';
import {
  Observation,
  EncodedObservation,
  ObservationList,
  ProjectID,
} from './datamodel';

export interface DataListing {
  [_id: string]: string[];
}

export function generateFAIMSDataID(): string {
  return uuidv4();
}

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
  dataid: string
): Promise<Observation | null> {
  const datadb = getDataDB(project_id);
  try {
    const doc = await datadb.get(dataid);
    return convertFromDBToForm(doc);
  } catch (err) {
    if (err.status === 404 && err.reason === 'deleted') {
      return null;
    }
    console.warn(err);
    throw Error('failed to find data with id');
  }
}

export async function listFAIMSData(
  project_id: ProjectID,
  options:
    | PouchDB.Core.AllDocsWithKeyOptions
    | PouchDB.Core.AllDocsWithKeysOptions
    | PouchDB.Core.AllDocsWithinRangeOptions
    | PouchDB.Core.AllDocsOptions = {}
): Promise<ObservationList> {
  const datadb = getDataDB(project_id);
  try {
    const all = await datadb.allDocs({...options, include_docs: true});
    const retval: ObservationList = {};
    all.rows.forEach(row => (retval[row.id] = convertFromDBToForm(row.doc!)!));
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
  dataid: string
) {
  const datadb = getDataDB(project_id);
  try {
    const doc = await datadb.get(dataid);
    doc.deleted = true;
    return await datadb.put(doc);
  } catch (err) {
    console.warn(err);
    throw Error('failed to delete data with id');
  }
}

export async function undeleteFAIMSDataForID(
  project_id: ProjectID,
  dataid: string
) {
  const datadb = getDataDB(project_id);
  try {
    const doc = await datadb.get(dataid);
    doc.deleted = false;
    return await datadb.put(doc);
  } catch (err) {
    console.warn(err);
    throw Error('failed to undelete data with id');
  }
}
