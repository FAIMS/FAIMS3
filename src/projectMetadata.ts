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
 * Filename: projectMetadata.ts
 * Description:
 *   TODO
 */
import {getProjectDB} from './sync/index';
import {ProjectID} from 'faims3-datamodel';
import {
  PROJECT_METADATA_PREFIX,
  EncodedProjectMetadata,
} from 'faims3-datamodel';
import {attachments_to_files, files_to_attachments} from 'faims3-datamodel';
import {logError} from './logging';

export async function getProjectMetadata(
  project_id: ProjectID,
  metadata_key: string
): Promise<any> {
  const projdb = await getProjectDB(project_id);
  try {
    const doc: EncodedProjectMetadata = await projdb.get(
      PROJECT_METADATA_PREFIX + '-' + metadata_key,
      {
        attachments: true,
        binary: true,
      }
    );

    if (doc.is_attachment && doc._attachments !== undefined) {
      const file_list = attachments_to_files(doc._attachments);
      if (doc.single_attachment) {
        return file_list[0];
      }
      return file_list;
    } else if (doc.is_attachment && doc._attachments === undefined) {
      logError(
        `Unable to load metadata attachments ${project_id}, ${metadata_key}`
      );
    }
    return doc.metadata;
  } catch (err) {
    console.warn('failed to find metadata', err);
    throw Error('failed to find metadata');
  }
}

export async function setProjectMetadata(
  project_id: ProjectID,
  metadata_key: string,
  metadata: any
) {
  const projdb = await getProjectDB(project_id);
  try {
    const doc: EncodedProjectMetadata = {
      _id: PROJECT_METADATA_PREFIX + '-' + metadata_key,
      is_attachment: false,
      metadata: metadata,
    };

    try {
      const existing_metaDoc = await projdb.get(
        PROJECT_METADATA_PREFIX + '-' + metadata_key
      );
      doc._rev = existing_metaDoc._rev;
    } catch (err) {
      // Probably no existing UI info, safe to ignore
    }

    await projdb.put(doc);
  } catch (err) {
    throw Error(
      `failed to set metadata for project ${project_id}, '${metadata_key}': '${metadata}'`
    );
  }
}

export async function setProjectMetadataFiles(
  project_id: ProjectID,
  metadata_key: string,
  files: File[]
) {
  const projdb = await getProjectDB(project_id);
  try {
    const doc: EncodedProjectMetadata = {
      _id: PROJECT_METADATA_PREFIX + '-' + metadata_key,
      is_attachment: true,
      metadata: null,
      _attachments: files_to_attachments(files),
    };

    try {
      const existing_metaDoc = await projdb.get(
        PROJECT_METADATA_PREFIX + '-' + metadata_key
      );
      doc._rev = existing_metaDoc._rev;
    } catch (err) {
      // Probably no existing UI info
    }

    await projdb.put(doc);
  } catch (err) {
    console.warn('failed to set metadata', err);
    throw Error('failed to set metadata');
  }
}
