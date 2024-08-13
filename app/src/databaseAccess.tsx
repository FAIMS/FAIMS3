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
 *   See faims3-datamodel for accessors specific to Records
 *   In comparison, this file is for metadata, or other data
 *   (faims3-datamodel is called from this file, as faims3-datamodel
 *    does encoding/decoding of records)
 *
 *   TODO: Convert *everything* to listeners that can run more than once
 *   (Sync refactor)
 */

import {getAvailableProjectsFromListing} from './sync/projects';
import {ProjectInformation, ListingInformation} from 'faims3-datamodel';
import {getAllListingIDs} from './sync/state';
import {events} from './sync/events';
import {getAllListings} from './sync';

export async function getAllProjectList(): Promise<ProjectInformation[]> {
  /**
   * Return all projects the user has access to from all servers
   */

  //await waitForStateOnce(() => all_projects_updated);

  const output: ProjectInformation[] = [];
  for (const listing_id of getAllListingIDs()) {
    const projects = await getAvailableProjectsFromListing(listing_id);
    for (const proj of projects) {
      output.push(proj);
    }
  }
  return output;
}

export function listenProjectList(listener: () => void): () => void {
  events.on('project_update', listener);
  return () => {
    // Event remover
    events.removeListener('project_update', listener);
  };
}

export async function getSyncableListingsInfo(): Promise<ListingInformation[]> {
  const all_listings = await getAllListings();
  const syncable_listings: ListingInformation[] = [];
  for (const listing_object of all_listings) {
    if (listing_object.local_only === true) {
      console.debug('Skipping as local only', listing_object._id);
      continue;
    }
    if (
      listing_object.conductor_url === null ||
      listing_object.conductor_url === undefined
    ) {
      console.debug('Skipping as missing conductor url', listing_object._id);
      continue;
    }
    syncable_listings.push({
      id: listing_object._id,
      name: listing_object.name,
      description: listing_object.description,
      conductor_url: listing_object.conductor_url,
    });
  }
  return syncable_listings;
}
