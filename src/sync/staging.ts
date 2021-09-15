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
 * Filename: staging.ts
 * Description:
 *   TODO
 */

import PouchDB from 'pouchdb';
import {RecordID, ProjectID, RevisionID} from '../datamodel/core';
import {SavedView} from '../datamodel/staging';

export type StagingDB = PouchDB.Database<SavedView>;

export const staging_db: StagingDB = new PouchDB('staging');

export async function getStagedData(
  active_id: ProjectID,
  view_name: string,
  // Revision & record from data db.
  existing_record_id: RecordID | null,
  existing_revision_id: RevisionID | null
): Promise<null | (SavedView & PouchDB.Core.GetMeta)> {
  const _id = determineId(
    active_id,
    view_name,
    existing_record_id,
    existing_revision_id
  );

  try {
    return await staging_db.get(_id);
  } catch (err: any) {
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
 * @param {string|null} existing_record Record id if this was editing an existing record
 * @param {string|null} existing_revision Revision ID if this was editing an existing revision
 */
export async function setStagedData(
  new_data: {[key_not_underscore_id: string]: unknown},
  _rev: string | null,
  active_id: ProjectID,
  view_name: string,
  existing_record_id: RecordID | null,
  existing_revision_id: RevisionID | null
): Promise<PouchDB.Core.Response> {
  const _id = determineId(
    active_id,
    view_name,
    existing_record_id,
    existing_revision_id
  );
  try {
    const put_doc: PouchDB.Core.PutDocument<SavedView> = {
      fields: new_data,
      _id: _id,
    };
    if (_rev !== null) put_doc._rev = _rev;

    return await staging_db.put(put_doc);
  } catch (possibleConflict: any) {
    if (possibleConflict.name === 'conflict') {
      // Do it less efficiently if a conflict occurs, by doing a _rev lookup first.
      console.warn(`Conflict in local staging db: ${possibleConflict}`);
      const _rev = (await staging_db.get(_id))._rev;
      return await setStagedData(
        new_data,
        _rev,
        active_id,
        view_name,
        existing_record_id,
        existing_revision_id
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
 * is creating a new document, leave out existing_record or existing_revision
 * (the last 2 parameters)
 *
 * @param {string} active_id First arg: active_id of a project from ActiveDB
 * @param {string} view_name Name of the view, defined by project GUI Model
 * @param {string|null} existing_record Record id if this was editing an existing record
 * @param {string|null} existing_revision Revision ID if this was editing an existing revision
 * @returns {string} _id field for pouch SavedView
 */
function determineId(
  active_id: ProjectID,
  view_name: string,
  existing_record_id: RecordID | null,
  existing_revision_id: RevisionID | null
): string {
  const parts: string[] = [active_id, view_name];
  if (existing_record_id !== null) {
    parts.push(existing_record_id);
  }
  if (existing_revision_id !== null) {
    parts.push(existing_revision_id);
  }
  return parts.map(encodeURIComponent).join('/');
}
