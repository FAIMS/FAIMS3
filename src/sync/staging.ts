import PouchDB from 'pouchdb';
import { CoreTransformationContext } from 'typescript';
import {SavedView} from '../datamodel';

export type StagingDB = PouchDB.Database<SavedView>;

export const staging_db: StagingDB = new PouchDB('staging');

export async function getStagedData(
  active_id: string,
  view_name: string,
  // Revision & observation from data db.
  existing: null | {_id: string; _rev: string}
): Promise<null | (SavedView & PouchDB.Core.GetMeta)> {
  const _id = determineId(active_id, view_name, existing);

  try {
    return await staging_db.get(_id);
  } catch (err) {
    if (err.message !== 'missing') {
      throw err;
    }
    // MISSING OBJECT
    return null;
  }
}

/**
 * @param new_data Data to update/insert
 * @param {string|null} _rev _rev of last SavedView object to use instead of all the 4 id's
 *                       Using this is more efficient, since a lookup for _rev doesn't need to happen.
 *                       Can be null if either this is the first staged value of this field,
 *                       or if _rev is not yet known
 * @param {string} active_id First arg: active_id of a project from ActiveDB
 * @param {string} view_name Name of the view, defined by project GUI Model
 * @param {string|null} existing_observation Observation id if this was editing an existing observation
 * @param {string|null} existing_revision Revision ID if this was editing an existing revision
 */
export async function setStagedData(
  new_data: {[key_not_underscore_id: string]: string},
  _rev: string | null,
  active_id: string,
  view_name: string,
  existing: {_id: string, _rev: string} | null
): Promise<PouchDB.Core.Response> {
  const _id = determineId(active_id, view_name, existing);
  try {
    const put_doc: PouchDB.Core.PutDocument<SavedView> = {
      ...new_data,
      _id: _id,
    };
    if (_rev !== null) put_doc._rev = _rev;

    return await staging_db.put(put_doc);
  } catch (possibleConflict) {
    if (possibleConflict.name === 'conflict') {
      // Do it less efficiently if a conflict occurs, by doing a _rev lookup first.
      console.warn(`Conflict in local staging db: ${possibleConflict}`);
      const _rev = (await staging_db.get(_id))._rev;
      return await setStagedData(
        new_data,
        _rev,
        active_id,
        view_name,
        existing
      );
    } else {
      throw possibleConflict;
    }
  }
}

/**
 * Generates a deterministic "_id" for SavedView structs
 * based on the given parameters.
 *
 * Used for when you're trying to save or retrieve something
 * to/from the staging area, this gives you a pouch unique _id to use.
 *
 * If you're trying to get/save data for when the user 
 * is creating a new document, leave out existing_observation or existing_revision
 * (the last 2 parameters)
 *
 * @param {string} active_id First arg: active_id of a project from ActiveDB
 * @param {string} view_name Name of the view, defined by project GUI Model
 * @param {string|null} existing_observation Observation id if this was editing an existing observation
 * @param {string|null} existing_revision Revision ID if this was editing an existing revision
 * @returns {string} _id field for pouch SavedView
 */
function determineId(
  active_id: string,
  view_name: string,
  existing: {_id: string, _rev: string} | null
): string {
  const parts: string[] =
    existing !== null
      ? [active_id, view_name, existing._id, existing._rev]
      : [active_id, view_name];

  return parts.map(encodeURIComponent).join('/');
}
