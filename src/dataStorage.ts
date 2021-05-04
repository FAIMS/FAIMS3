import {v4 as uuidv4} from 'uuid';

import {getDataDB} from './sync/index';
import {Observation, EncodedObservation} from './datamodel';

export interface DataListing {
  [_id: string]: string[];
}

export function generateFAIMSDataID(): string {
  return uuidv4();
}

function convertFromFormToDB(doc: Observation): EncodedObservation {
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

function convertFromDBToForm(doc: EncodedObservation): Observation {
  return {
    _id: doc._id,
    type: doc.type,
    data: doc.data,
    _rev: doc._rev,
  };
}

export async function upsertFAIMSData(project_name: string, doc: Observation) {
  const datadb = getDataDB(project_name);
  try {
    return await datadb.put(convertFromFormToDB(doc));
  } catch (err) {
    console.warn(err);
    throw Error('failed to save data');
  }
}

export async function lookupFAIMSDataID(
  project_name: string,
  dataid: string
): Promise<Observation> {
  const datadb = getDataDB(project_name);
  try {
    const doc: EncodedObservation = await datadb.get(dataid);
    return convertFromDBToForm(doc);
  } catch (err) {
    console.warn(err);
    throw Error('failed to find data with id');
  }
}

async function ensureListDDocExists(project_name: string) {
  const datadb = getDataDB(project_name);
  const ddoc = {
    _id: '_design/list_all_data_rev',
    views: {
      list_all_data_rev: {
        map: 'function mapFun(doc) {emit(doc._id, doc._rev);}',
      },
    },
  };
  try {
    await datadb.put(ddoc);
  } catch (err) {
    if (err.name !== 'conflict') {
      throw err;
    }
    // skip existing doc - we should work out how best to handle updating it
  }
}

export async function listFAIMSProjectRevisions(
  project_name: string
): Promise<DataListing> {
  const datadb = getDataDB(project_name);
  try {
    await ensureListDDocExists(project_name);
    const result = await datadb.query('list_all_data_rev');
    const rows = result.rows;
    const revmap: DataListing = {};
    for (const row of rows) {
      const _id: string = row.key;
      const _rev: string = row.value;
      if (revmap[_id] === undefined) {
        revmap[_id] = [];
      }
      revmap[_id].push(_rev);
    }
    return revmap;
  } catch (err) {
    console.warn(err);
    throw Error('failed to list data in project');
  }
}
