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

import {
  DraftMetadataList,
  EncodedDraft,
  FAIMSAttachmentReference,
  FAIMSTypeName,
  HRID_STRING,
  ProjectID,
  RecordID,
  Relationship,
  RevisionID,
  attachment_to_file,
  getHridFieldNameForViewset,
  getIdsByFieldName,
} from '@faims3/data-model';
import {v4 as uuidv4} from 'uuid';
import {compiledSpecService} from '../context/slices/helpers/compiledSpecService';
import {databaseService} from '../context/slices/helpers/databaseService';
import {selectProjectById} from '../context/slices/projectSlice';
import {store} from '../context/store';
import {logError} from '../logging';

export type DraftDB = PouchDB.Database<EncodedDraft>;

// Note: duplicated from @faims3/data-model as it doesn't do anything important
export function generate_file_name(): string {
  return 'file-' + uuidv4();
}

/**
 * get staged data from the draft database
 * This is the inverse of setStagedData, it's main function is to re-generate
 * any file attachments that were saved.
 *
 * @param draft_id - identifier for the draft
 * @returns an EncodedDraft record
 */
export async function getStagedData(
  draft_id: string
): Promise<EncodedDraft & PouchDB.Core.GetMeta> {
  const draftDb = databaseService.getDraftDatabase();
  const draft = (await draftDb.get(draft_id, {
    attachments: true,
    binary: true,
  })) as EncodedDraft & PouchDB.Core.GetMeta;

  // List out the attachments, if any - these could be downloaded or references
  // Note this is a map from field name -> list of attachment(s)/photos
  for (const [field_name, attachment_list] of Object.entries(
    draft.attachments
  )) {
    const files = [];
    // for each attachment entry
    for (const entry of attachment_list) {
      // Check if the entry has the draft attachment property which indicates it
      // should be attached and present in the _attachments field
      if (Object.hasOwnProperty.call(entry, 'draft_attachment')) {
        if (draft._attachments !== undefined) {
          // add the file
          files.push(
            attachment_to_file(
              entry.filename,
              draft._attachments[entry.filename]
            )
          );
        } else {
          logError(
            "Attachments weren't loaded from pouch, but there should be some"
          );
        }
      } else {
        // for a FAIMSAttachmentReference just store the reference
        files.push(entry);
      }
    }
    // Update the draft fields with the actual files
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
  const draftDb = databaseService.getDraftDatabase();
  const _id = 'drf-' + uuidv4();
  const date = new Date();

  const encodedDraft: EncodedDraft = {
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
  };
  return (await draftDb.put(encodedDraft)).id;
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
  new_annotations: {[key: string]: {annotation: string; uncertainty: boolean}},
  field_types: {[field_name: string]: FAIMSTypeName},
  relationship: Relationship
): Promise<PouchDB.Core.Response> {
  const draftDb = databaseService.getDraftDatabase();
  const existing = (await draftDb.get(draft_id)) as EncodedDraft;

  // merge new annotations with existing
  // each value is an object {annotation, uncertainty} so need
  // to merge each one separately
  for (const field_name in new_annotations) {
    if (existing.annotations[field_name] === undefined) {
      existing.annotations[field_name] = new_annotations[field_name];
    } else {
      // Merge the annotation and uncertainty values individually
      existing.annotations[field_name] = {
        ...existing.annotations[field_name],
        ...new_annotations[field_name],
      };
    }
  }

  // update relationship if present, any value just replaces the existing
  if (relationship.parent) {
    existing.relationship = relationship;
  }

  // update the fields and attachments
  updateDraftFields(existing, new_data, field_types);

  return await draftDb.put(existing);
}

type FileOrRef = File | FAIMSAttachmentReference;

/**
 * Update field values and attachments in a draft record
 *
 * Stores any file attachments for a field in the
 * attachments property.
 * Note that attachments can either be a File or a
 * FAIMSAttachmentReference which is a ref to an existing
 * attachment (possibly not downloaded).
 * Here we make a list of attachments that are either
 * the reference or a new reference to a local attached filename.
 * In getStagedData above we reverse this operation to rebuild
 * the EncodedDraft object.
 *
 * @param existing Existing encoded draft from the database (updated)
 * @param new_data New data that has been updated in the record
 * @param field_types Types of fields
 */
function updateDraftFields(
  existing: EncodedDraft,
  new_data: {[key: string]: unknown},
  field_types: {[field_name: string]: FAIMSTypeName}
) {
  for (const field_name in field_types) {
    const field_data = new_data[field_name];
    if (field_data !== undefined) {
      if (
        field_types[field_name] === 'faims-attachment::Files' &&
        field_data !== null
      ) {
        // Attachment might be a File or might be an object for a
        // non-downloaded file
        const attachment_metadata = [];
        for (const field_value of field_data as FileOrRef[]) {
          if (field_value instanceof File) {
            const file = field_value as File;
            const file_name = file.name ?? generate_file_name();
            if (existing._attachments === undefined) {
              existing._attachments = {};
            }
            // store this attachment in _attachments
            existing._attachments[file_name] = {
              content_type: file.type,
              data: file,
            };
            attachment_metadata.push({
              draft_attachment: true,
              filename: file_name,
            });
          } else {
            // we have a FAIMSAttachmentReference
            attachment_metadata.push(field_value);
          }
          existing.attachments[field_name] = attachment_metadata;
        }
      } else {
        // replace any existing data with the new data
        existing.fields[field_name] = field_data;
      }
    }
  }
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
  const draftDb = databaseService.getDraftDatabase();
  const revision =
    revision_cache !== null
      ? revision_cache
      : (await draftDb.get(draft_id))._rev;

  await (draftDb as PouchDB.Database<{}>).put(
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
    await databaseService.getDraftDatabase().find({
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

export type DraftFilters = 'updates' | 'created' | 'all';

/**
 * Returns a list of not deleted records
 * @param project_id Project ID to get list of draft for
 * @returns key: record id, value: record (NOT NULL)
 */
export async function listDraftMetadata(
  project_id: ProjectID,
  filter: DraftFilters
): Promise<DraftMetadataList> {
  try {
    const records = await listDraftsEncoded(project_id, filter);
    const out: DraftMetadataList = {};

    // Use Promise.all to wait for all async operations
    await Promise.all(
      records.map(async record => {
        out[record._id] = {
          project_id: project_id,
          _id: record._id,
          created: new Date(record.created),
          existing: record.existing,
          updated: new Date(record.updated),
          type: record.type,
          hrid: (await getDraftHRID(record)) ?? record._id,
          record_id: record.record_id,
        };
      })
    );

    return out;
  } catch (err) {
    console.warn('Failed to get metadata', err);
    throw Error('failed to get metadata');
  }
}

async function getDraftHRID(record: EncodedDraft): Promise<string | null> {
  // Need to find a way here to determine the correct field name to use - we
  // need the uispec at this point
  const uiSpecId = selectProjectById(
    store.getState(),
    record.project_id
  )?.uiSpecificationId;
  const uiSpecification = uiSpecId
    ? compiledSpecService.getSpec(uiSpecId)
    : undefined;

  if (!uiSpecification) {
    return record.record_id;
  }

  const fieldNames = Array.from(Object.keys(record.fields));
  const sampleFieldName = fieldNames.length > 0 ? fieldNames[0] : undefined;
  let hridFieldName = undefined;
  if (sampleFieldName) {
    const {viewSetId} = getIdsByFieldName({
      uiSpecification,
      fieldName: sampleFieldName,
    });
    // get the HRID for the view set - might not succeed
    hridFieldName = getHridFieldNameForViewset({
      uiSpecification,
      viewSetId,
    });
  }

  if (!hridFieldName) {
    for (const possible_name of Object.keys(record.fields)) {
      if (possible_name.startsWith(HRID_STRING)) {
        hridFieldName = possible_name;
        break;
      }
    }
  }

  if (!hridFieldName) {
    return null;
  }

  const hrid_id = record.fields[hridFieldName] as string | undefined | null;
  if (hrid_id === undefined || hrid_id === null) {
    return null;
  }
  return hrid_id;
}

export async function deleteDraftsForRecord(
  project_id: ProjectID,
  record_id: RecordID
) {
  const draftDb = databaseService.getDraftDatabase();

  try {
    const res = await draftDb.find({
      selector: {
        project_id: project_id,
        record_id: record_id,
      },
    });
    const ids_to_delete = res.docs.map(o => {
      return {
        _id: o._id,
        _rev: o._rev,
        _deleted: true,
      };
    });
    console.debug('ids_to_delete', ids_to_delete);
    if (ids_to_delete.length > 0) {
      await (draftDb as PouchDB.Database<{}>).bulkDocs(ids_to_delete);
    }
  } catch (err) {
    console.debug('Failed to remove drafts', err);
    throw err;
  }
}
