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
 * Filename: draft-storage.ts
 * Description:
 *   TODO
 */

import PouchDB from 'pouchdb';
import {RecordID, ProjectID, RevisionID} from '../datamodel/core';
import {SavedView} from '../datamodel/drafts';
import {v4 as uuidv4} from 'uuid';
import {DraftMetadataList} from '../datamodel/drafts';

export type DraftDB = PouchDB.Database<SavedView>;

export const draft_db: DraftDB = new PouchDB('draft-storage');

export async function getStagedData(
  draft_id: string
): Promise<SavedView & PouchDB.Core.GetMeta> {
  return await draft_db.get(draft_id);
}

/**
 *
 * @param active_id ID of the project that this draft is for
 * @param existing If this draft is a draft of edits to an existing record,
 *                 these IDs identify the existing record
 * @param type (Less useful if existing is set, as this can be fetched from
 *              other pouch databases if existing data is set) The FAIMS type
 *             of this draft document. Doesn't change when draft is updated.
 * @returns ID of the newly created draft. Use through URL routes to eventually
 *          call [get|set]stagedData with
 */
export async function newStagedData(
  active_id: ProjectID,
  existing: null | {
    record_id: RecordID;
    revision_id: RevisionID;
  },
  type: string
): Promise<PouchDB.Core.DocumentId> {
  const _id = uuidv4();
  const date = new Date();

  return (
    await draft_db.put({
      _id: _id,
      created: date.toString(),
      updated: date.toString(),
      fields: {},
      project_id: active_id,
      existing: existing,
      type: type,
    })
  ).id;
}

/**
 * @param draft_id This is from the routed URL parameter, which is redirected
 *                 to from the list of drafts or the newStagedData. The ID
 *                 that identifies the draft you want to update.
 * @param new_data Data to update/insert
 */
export async function setStagedData(
  // Matches the PouchDB.Core.Response type, but with optional rev
  draft_id: PouchDB.Core.DocumentId,
  new_data: {[key: string]: unknown}
): Promise<PouchDB.Core.Response> {
  const existing = await draft_db.get(draft_id);

  return await draft_db.put({
    ...existing,
    fields: new_data,
    updated: new Date().toString(),
  });
}

/**
 *
 * @param draft_id Identifies the draft to delete
 * @param revision_cache To avoid having to look it up, if you know the revision
 *                       id of the draft, pass it through here.
 */
export async function deleteStagedData(
  draft_id: PouchDB.Core.DocumentId,
  revision_cache: null | PouchDB.Core.RevisionId
) {
  const revision =
    revision_cache !== null
      ? revision_cache
      : (await draft_db.get(draft_id))._rev;

  await (draft_db as PouchDB.Database<{}>).put({
    _id: draft_id,
    _rev: revision,
    _deleted: true,
  });
}

/**
 *
 * @param project_id Project ID (fully qualified) to get the list of drafts for
 * @param filter Determines what subset (or all) of the drafts to get.
 *               This filters by what type of draft.
 *               If a given draft is an update to an existing record that has
 *               been synced, it will show when listing by 'all' or 'updates'.
 *               Otherwise, it will show when listing by 'all' or 'created'.
 * @returns List of drafts filtered.
 */
export async function listStagedData(
  project_id: string,
  filter: 'updates' | 'created' | 'all'
): Promise<SavedView[]> {
  return (
    await draft_db.find({
      selector: {
        project_id: project_id,
        // Based on what value filter takes, we either:
        // all: Don't select on the existing field at all,
        // created: Select for null existing fields, or
        // updates: Select for non-null existing fields
        ...(filter === 'all'
          ? {}
          : {
              existing: filter === 'updates' ? {$ne: null} : null,
            }),
      },
    })
  ).docs;
}


/**
 * Returns a list of not deleted records
 * @param project_id Project ID to get list of record for
 * @returns key: record id, value: record (NOT NULL)
 */
export async function listDraftMetadata(
  project_id: ProjectID,
  filter: 'updates' | 'created' | 'all'
): Promise<DraftMetadataList> {
  try {
    const records = await listStagedData(project_id,filter);
    const out: DraftMetadataList = {};
    records.forEach((record) => {
      out[record._id] = {
        project_id: project_id,
        record_id: record._id,
        created: new Date(record.created),
        existing: record.existing,
        updated: new Date(record.updated),
        type:record.type,
        filter_type:record.existing===null?'created':'updated'
      };
    });
    console.log(records)
    return out;
  } catch (err) {
    console.warn(err);
    console.log(err);
    throw Error('failed to get metadata');
  }
}

