import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import * as DataModel from '../datamodel';
import {data_dbs, metadata_dbs} from './databases';

PouchDB.plugin(PouchDBFind);

export function getDataDB(
  active_id: string
): PouchDB.Database<DataModel.EncodedObservation> {
  if (data_dbs[active_id] !== undefined) {
    return data_dbs[active_id].local;
  } else {
    console.warn(`Failed to look up ${active_id}`);
    throw 'Projects not initialized yet';
  }
}

export function getProjectDB(
  active_id: string
): PouchDB.Database<DataModel.ProjectMetaObject> {
  if (metadata_dbs[active_id] !== undefined) {
    return metadata_dbs[active_id].local;
  } else {
    console.warn(`Failed to look up ${active_id}`);
    throw 'Projects not initialized yet';
  }
}
