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
 * Filename: databaseAccess.tsx
 * Description:
 *   This file contains accessors to data stored in PouchDB
 *
 *   If you find yourself writing pouchdb.get(), pouchdb.put(), etc.
 *   put that code in a function in this file
 *
 *   See @faims3/data-model for accessors specific to Records
 *   In comparison, this file is for metadata, or other data
 *   (@faims3/data-model is called from this file, as @faims3/data-model
 *    does encoding/decoding of records)
 *
 *   TODO: Convert *everything* to listeners that can run more than once
 *   (Sync refactor)
 */

import {ListingsObject} from '@faims3/data-model/src/types';
import {getAllListings} from './sync';
import {events} from './sync/events';

export function listenProjectList(listener: () => void): () => void {
  events.on('project_update', listener);
  return () => {
    // Event remover
    events.removeListener('project_update', listener);
  };
}

/**
 * Retrieves listings from the local directory DB, and returns syncable listings
 * (:= those with conductor URLs)
 * @returns Current set of listings which have conductor urls that are not
 * falsey
 */
export async function getSyncableListingsInfo(): Promise<ListingsObject[]> {
  const all_listings = await getAllListings();
  return all_listings.filter(listing => {
    if (!listing.conductor_url) {
      console.debug('Skipping as missing conductor url', listing.id);
      return false;
    }
    return true;
  });
}
