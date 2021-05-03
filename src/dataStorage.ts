import {v4 as uuidv4} from 'uuid';

import {getDataDB} from './sync/index';
import {Observation, EncodedObservation} from './datamodel';

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
      _id: doc._id,
      _rev: revision,
      type: doc.type,
      data: doc.data,
      format_version: 1,
    };
  }
  if (doc._rev !== undefined) {
    return {
      _id: doc._id,
      _rev: doc._rev,
      type: doc.type,
      data: doc.data,
      format_version: 1,
    };
  }
  return {
    _id: doc._id,
    type: doc.type,
    data: doc.data,
    format_version: 1,
  };
}

function convertFromDBToForm(doc: EncodedObservation): Observation | null {
  if (doc.deleted) {
    return null;
  }
  return {
    _id: doc._id,
    type: doc.type,
    data: doc.data,
  };
}

async function getLatestRevision(
  project_name: string,
  docid: string
): Promise<string | undefined> {
  const datadb = getDataDB(project_name);
  try {
    const doc = await datadb.get(docid);
    return doc._rev;
  } catch (err) {
    console.debug(err);
    return undefined;
  }
}

export async function upsertFAIMSData(project_name: string, doc: Observation) {
  const datadb = getDataDB(project_name);
  if (doc._id === undefined) {
    throw Error('_id required to save observation');
  }
  try {
    const revision = await getLatestRevision(project_name, doc._id);
    return await datadb.put(convertFromFormToDB(doc, revision));
  } catch (err) {
    console.warn(err);
    throw Error('failed to save data');
  }
}

export async function lookupFAIMSDataID(
  project_name: string,
  dataid: string
): Promise<Observation | null> {
  const datadb = getDataDB(project_name);
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

export async function listFAIMSProjectRevisions(
  project_name: string
): Promise<DataListing> {
  const datadb = getDataDB(project_name);
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
  project_name: string,
  dataid: string
) {
  const datadb = getDataDB(project_name);
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
  project_name: string,
  dataid: string
) {
  const datadb = getDataDB(project_name);
  try {
    const doc = await datadb.get(dataid);
    doc.deleted = false;
    return await datadb.put(doc);
  } catch (err) {
    console.warn(err);
    throw Error('failed to undelete data with id');
  }
}
