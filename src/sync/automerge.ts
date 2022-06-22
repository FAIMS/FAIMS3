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
 * Filename: automerge
 * Description:
 *   Connects up automerge to sync subsystem.
 */

import {ProjectID} from '../datamodel/core';
import {
  ProjectObject,
  ProjectMetaObject,
  ProjectDataObject,
  ActiveDoc,
  isRecord,
  ListingsObject,
} from '../datamodel/database';

import {mergeHeads} from '../data_storage/merging';

import {ExistingActiveDoc, LocalDB} from './databases';
import {DirectoryEmitter} from './events';
import {createdProjects} from './state';
/*
 * Registers a handler to do automerge on new records
 */
export function register_basic_automerge_resolver(
  initializeEvents: DirectoryEmitter
) {
  initializeEvents.on('data_sync_state', (syncing, listing, active) => {
    // Only when finished syncing
    if (syncing) return;
    // The data_sync_state event is only triggered on initial page load,
    // and when the actual data DB changes: So .changes
    // (as called in start_listening_for_changes) is called once per PouchDB)
    start_listening_for_changes(active._id);
  });
}

function start_listening_for_changes(proj_id: ProjectID) {
  createdProjects[proj_id]!.data.local.changes({
    since: 'now',
    live: true,
    include_docs: true,
  }).on('change', async doc => {
    if (doc !== undefined) {
      const pdoc = doc.doc;

      if (pdoc !== undefined && isRecord(pdoc)) {
        await mergeHeads(proj_id, doc.id);
      }
    }
  });
}
