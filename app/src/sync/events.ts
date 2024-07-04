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
 * Filename: index.ts
 * Description:
 *   TODO
 */

import {EventEmitter} from 'events';

import {DEBUG_APP} from '../buildconfig';
import {ListingID} from 'faims3-datamodel';
import {ProjectObject} from 'faims3-datamodel';
import {ListingsObject, ExistingActiveDoc} from './databases';
import {createdListingsInterface, createdProjectsInterface} from './state';

export class DebugEmitter extends EventEmitter {
  constructor(opts?: {captureRejections?: boolean}) {
    super(opts);
  }
  emit(event: string | symbol, ...args: unknown[]): boolean {
    if (DEBUG_APP) {
      console.debug('FAIMS EventEmitter event', event, ...args);
    }
    return super.emit(event, ...args);
  }
}

export const events: DirectoryEmitter = new DebugEmitter();
events.setMaxListeners(100); // Default is 10, but that is soon exceeded with multiple watchers of a single project

type ProjectEventInfo = [ListingsObject, ExistingActiveDoc, ProjectObject];

export interface DirectoryEmitter extends EventEmitter {
  /**
   * true event is triggered when  a Projects' meta DB is created or updated,
   * and new data might start coming in
   *
   * These events always come in  pairs: First the true, then the false.
   *
   * The true event coincides with project_update event, only where
   * meta_changed: true
   */
  on(
    event: 'meta_sync_state',
    listener: (syncing: boolean, ...args: ProjectEventInfo) => unknown
  ): this;
  /**
   * true event is triggered when  a Projects' data DB is created or updated,
   * and new data might start coming in
   *
   * These events always come in  pairs: First the true, then the false.
   *
   * The true event coincides with project_update event, only where
   * data_changed: true
   */
  on(
    event: 'data_sync_state',
    listener: (syncing: boolean, ...args: ProjectEventInfo) => unknown
  ): this;
  /**
   * Tracks changes to createdProjects from state.ts
   * Guaranteed to trigger for each project in a listing before the listing's
   * projects_sync_state event is triggered with syncing: false,
   * and before any changes might start occurring (so you can attach to .changes
   * and not miss anything)
   *
   * Also, if the data db in createdProjects[active._id] is new (i.e.
   * doesn't have any change listeners) data_changed is true.
   * Same for meta_changed
   *
   * 'update' type will give you the previous value
   */
  on(
    event: 'project_update',
    listener: (
      type: ['update', createdProjectsInterface] | ['delete'] | ['create'],
      meta_changed: boolean,
      data_changed: boolean,
      ...args: ProjectEventInfo
    ) => unknown
  ): this;
  on(
    event: 'project_error',
    listener: (
      listing: ListingsObject,
      active: ExistingActiveDoc,
      err: unknown
    ) => unknown
  ): this;
  /**
   * true event is triggered when a Listing's project DB is created or updated,
   * and new data might start coming in
   *
   * These events always come in pairs: First the true, then the false.
   *
   * The true event coincides with listing_update event, only where
   * projects_changed: true
   */
  on(
    event: 'projects_sync_state',
    listener: (syncing: boolean, listing: ListingsObject) => unknown
  ): this;
  /**
   * Tracks changes to createdListings from state.ts
   * Guaranteed to trigger before listings_sync_state is set to syncing: false,
   * and before any changes might start occurring (so you can attach to .changes
   * and not miss anything)
   *
   * Also, if the projects db in createdListings[listing._id] is new (i.e.
   * doesn't have any change listeners) projects_changed is true.
   * Same for people_changed
   *
   * 'update' type will give you the previous value
   */
  on(
    event: 'listing_update',
    listener: (
      type: ['update', createdListingsInterface] | ['delete'] | ['create'],
      projects_changed: boolean,
      people_changed: boolean,
      listing_id: ListingID
    ) => unknown
  ): this;
  on(
    event: 'listing_error',
    listener: (listing_id: string, err: unknown) => unknown
  ): this;
  /**
   * true event is triggered when FAIMS initializes
   * false event is only triggered when all possible listing_updated events
   * have already ran (excluding updates not part of the initial sync)
   *
   * These events always come in pairs: First the true, then the false.
   */
  on(
    event: 'listings_sync_state',
    listener: (syncing: boolean) => unknown
  ): this;
  on(event: 'directory_error', listener: (err: unknown) => unknown): this;
  /**
   * Emitted on any changes to do with projects appearing/disappearing,
   * Listings appearing/disappearing, or metadata/data finishing syncing
   *
   * The intended use if for you to check all_{data,meta}_synced
   * and all_projects_updated variables (or listing_projects_synced,
   * projects_{meta,data}_synced variables as well) as these are the
   * variables that this event signals updates for.
   */
  on(event: 'all_state', listener: () => unknown): this;

  emit(
    event: 'meta_sync_state',
    syncing: boolean,
    ...args: ProjectEventInfo
  ): boolean;
  emit(
    event: 'data_sync_state',
    syncing: boolean,
    ...args: ProjectEventInfo
  ): boolean;
  emit(
    event: 'project_update',
    type: ['update', createdProjectsInterface] | ['delete'] | ['create'],
    meta_changed: boolean,
    data_changed: boolean,
    ...args: ProjectEventInfo
  ): boolean;
  emit(
    event: 'project_error',
    listing: ListingsObject,
    active: ExistingActiveDoc,
    err: unknown
  ): boolean;
  emit(
    event: 'projects_sync_state',
    syncing: boolean,
    listing: ListingsObject
  ): boolean;
  emit(
    event: 'listing_update',
    type: ['update', createdListingsInterface] | ['delete'] | ['create'],
    projects_changed: boolean,
    people_changed: boolean,
    listing_id: ListingID
  ): boolean;
  emit(event: 'listing_error', listing_id: string, err: unknown): boolean;
  emit(event: 'listings_sync_state', syncing: boolean): boolean;
  emit(event: 'directory_error', err: unknown): boolean;
  emit(event: 'all_state'): boolean;
}
