/*
 * Copyright 2021, 2022 Macquarie University
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
 *   Handle storage of draft records
 */

import PouchDB from 'pouchdb-browser';
import {v4 as uuidv4} from 'uuid';

import {
  RecordID,
  ProjectID,
  RevisionID,
  FAIMSTypeName,
  HRID_STRING,
  Relationship,
  EncodedDraft,
  DraftMetadataList,
  attachment_to_file,
} from 'faims3-datamodel';
import {DEBUG_APP} from '../buildconfig';
import {local_pouch_options} from './connection';
import {logError} from '../logging';

export type DraftDB = PouchDB.Database<EncodedDraft>;

export const draft_db: DraftDB = new PouchDB(
  'draft-storage',
  local_pouch_options
);

// Note: duplicated from faims3-datamodel as it doesn't do anything important
export function generate_file_name(): string {
  return 'file-' + uuidv4();
}

export async function getStagedData(
  draft_id: string
): Promise<EncodedDraft & PouchDB.Core.GetMeta> {
  const draft = await draft_db.get(draft_id, {
    attachments: true,
    binary: true,
  });

  for (const [field_name, attachment_list] of Object.entries(
    draft.attachments
  )) {
    const files = [];
    for (const file_name of attachment_list) {
      if (draft._attachments !== undefined) {
        if (DEBUG_APP) {
          console.debug('Loading draft file:', file_name);
        }
        files.push(
          attachment_to_file(file_name, draft._attachments[file_name])
        );
      } else {
        logError(
          "Attachments weren't loaded from pouch, but there should be some"
        );
      }
    }
    draft.fields[field_name] = files;
  }
  return draft;
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
  type: string,
  field_types: {[field_name: string]: FAIMSTypeName},
  record_id: string
): Promise<PouchDB.Core.DocumentId> {
  const _id = 'drf-' + uuidv4();
  const date = new Date();

  return (
    await draft_db.put({
      _id: _id,
      created: date.toString(),
      updated: date.toString(),
      fields: {},
      annotations: {},
      attachments: {},
      project_id: active_id,
      existing: existing,
      type: type,
      field_types: field_types,
      record_id: record_id,
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
  new_data: {[key: string]: unknown},
  new_annotations: {[key: string]: unknown},
  field_types: {[field_name: string]: FAIMSTypeName},
  relationship: Relationship
): Promise<PouchDB.Core.Response> {
  const existing = await draft_db.get(draft_id);
  if (DEBUG_APP) {
    console.debug('Saving draft values:', new_data, new_annotations);
  }
  const encoded_info = encodeStagedData(
    new_data,
    new_annotations,
    field_types,
    relationship
  );

  return await draft_db.put({
    ...existing,
    ...encoded_info,
    updated: new Date().toString(),
  });
}

function encodeStagedData(
  new_data: {[key: string]: unknown},
  new_annotations: {[key: string]: unknown},
  field_types: {[field_name: string]: FAIMSTypeName},
  relationship: Relationship
) {
  // TODO: work out what we need to do specially for annotations, probably
  // nothing
  const encoded_annotations = new_annotations;
  // TODO: integrate this into the rest of the attachment handling system
  const encoded_data: {[key: string]: unknown} = {};
  const attachment_metadata: {[key: string]: string[]} = {};
  const encoded_attachments: any = {};

  for (const field_name in field_types) {
    const field_data = new_data[field_name];
    if (field_data !== undefined) {
      if (
        field_types[field_name] === 'faims-attachment::Files' &&
        field_data !== null
      ) {
        attachment_metadata[field_name] = [];
        for (const tmp_file of field_data as File[]) {
          const file = tmp_file;
          const file_name = file.name ?? generate_file_name();
          encoded_attachments[file_name] = {
            content_type: file.type,
            data: file,
          };
          attachment_metadata[field_name].push(file_name);
        }
      } else {
        encoded_data[field_name] = field_data;
      }
    }
  }

  return {
    fields: encoded_data,
    annotations: encoded_annotations,
    attachments: attachment_metadata,
    _attachments: encoded_attachments,
    relationship: relationship,
  };
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

  await (draft_db as PouchDB.Database<{}>).put(
    {
      _id: draft_id,
      _rev: revision,
      _deleted: true,
    },
    {force: true}
  );
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

export async function listDraftsEncoded(
  project_id: string,
  filter: 'updates' | 'created' | 'all'
): Promise<EncodedDraft[]> {
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
 * @param project_id Project ID to get list of draft for
 * @returns key: record id, value: record (NOT NULL)
 */
export async function listDraftMetadata(
  project_id: ProjectID,
  filter: 'updates' | 'created' | 'all'
): Promise<DraftMetadataList> {
  try {
    const records = await listDraftsEncoded(project_id, filter);
    const out: DraftMetadataList = {};
    records.forEach(record => {
      out[record._id] = {
        project_id: project_id,
        _id: record._id,
        created: new Date(record.created),
        existing: record.existing,
        updated: new Date(record.updated),
        type: record.type,
        hrid: getDraftHRID(record) ?? record._id,
        record_id: record.record_id,
      };
    });
    return out;
  } catch (err) {
    console.warn('Failed to get metadata', err);
    throw Error('failed to get metadata');
  }
}

function getDraftHRID(record: EncodedDraft): string | null {
  let hrid_name: string | null = null;
  for (const possible_name of Object.keys(record.fields)) {
    if (possible_name.startsWith(HRID_STRING)) {
      hrid_name = possible_name;
      break;
    }
  }

  if (hrid_name === null) {
    return null;
  }

  const hrid_id = record.fields[hrid_name] as string | undefined | null;
  if (hrid_id === undefined || hrid_id === null) {
    return null;
  }
  return hrid_id;
}
