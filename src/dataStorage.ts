import {v4 as uuidv4} from 'uuid';

import {getDataDB} from './sync/index';
import {Observation, EncodedObservation} from './datamodel';

export function generateFAIMSDataID(): string {
  return uuidv4();
}

function convertFromFormToDB(doc: Observation): EncodedObservation {
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
    const doc = await datadb.get(dataid);
    return convertFromDBToForm(doc);
  } catch (err) {
    console.warn(err);
    throw Error('failed to find data with id');
  }
}
