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
 * Filename: metadata.ts
 * Description:
 *   Getting metadata from the server and providing an interface to
 * the rest of the app.
 *
 */

import {EncodedProjectUIModel, resolve_project_id} from '@faims3/data-model';
import {getMetadataDbForProject} from '.';
import {getToken} from '../context/functions';
import {createdListingsInterface} from './state';

export type PropertyMap = {
  [key: string]: unknown;
};

/**
 * A subset of createdListingInterface - just the bits we
 * need to make testing easier
 */
type minimalCreatedListing =
  | createdListingsInterface
  | {
      listing: {
        id: string;
        conductor_url: string;
      };
    };

/**
 * Fetch project metadata from the server and store it locally for
 * later access.
 *
 * @param listing a createdListing entry (or subset for testing)
 * @param project_id short project identifier
 */
export const fetchProjectMetadata = async (
  {listing}: minimalCreatedListing,
  project_id: string
) => {
  const url = `${listing.conductor_url}/api/notebooks/${project_id}`;
  // In the current auth store, get the token synchronously
  const serverId = listing.id;
  const jwt_token = getToken(serverId);
  if (!jwt_token) {
    console.error('Could not get token for listing with ID: ', serverId);
    return;
  }

  const full_project_id = resolve_project_id(listing.id, project_id);
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${jwt_token.token}`,
    },
  });
  const notebook = await response.json();
  const metadata = notebook.metadata;
  const uiSpec = notebook['ui-specification'] as EncodedProjectUIModel;

  // store them in the local database
  const metaDB = await getMetadataDbForProject(full_project_id);
  try {
    const existing = await metaDB.get('metadata');
    metadata._rev = existing._rev;
  } catch {
    // no problem here, just means there is no existing metadata
  }

  try {
    const existing = await metaDB.get('ui-specification');
    uiSpec._rev = existing._rev;
  } catch {
    // no problem here, just means there is no existing metadata
  }

  try {
    // insert the two documents
    metaDB.put({
      ...metadata,
      _id: 'metadata',
    });

    metaDB.put({
      ...uiSpec,
      _id: 'ui-specification',
    });
  } catch {
    // what should we do here?
    console.log('something went wrong inserting metadata documents to pouchdb');
  }
};

/**
 * Get a metadata value for a project.
 *
 * TODO: Note that this ignores attachments but I'm fairly sure that they are broken
 * anyway since we moved to the new designer - need to re-implement attachments
 * in designer and mirror here.
 *
 * @param project_id Project identifier
 * @param key metadata key to lookup
 * @returns the value of the given key for this project or undefined if not present
 */
export const getMetadataValue = async (project_id: string, key: string) => {
  const metaDB = await getMetadataDbForProject(project_id);
  try {
    const metadata = (await metaDB.get('metadata')) as PropertyMap;
    return metadata[key];
  } catch {
    return undefined;
  }
};

/**
 * Get the entire metadata for a project
 *
 * @param project_id Project identifier
 * @returns all metadata values as a PropertyMap
 */
export const getAllMetadata = async (project_id: string) => {
  const metaDB = await getMetadataDbForProject(project_id);
  try {
    const metadata = (await metaDB.get('metadata')) as PropertyMap;
    return metadata;
  } catch {
    return undefined;
  }
};
