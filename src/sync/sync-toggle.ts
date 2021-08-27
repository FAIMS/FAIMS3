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
 * Filename: index.ts
 * Description:
 *   TODO
 */

import {ProjectID} from '../datamodel/core';
import {ProjectDataObject} from '../datamodel/database';
import {
  data_dbs,
  LocalDB,
  LocalDBRemote,
  setLocalConnection,
} from './databases';

const syncingProjectListeners: (
  | [ProjectID, (syncing: boolean) => unknown]
  | undefined
)[] = [];

export function listenSyncingProject(
  active_id: ProjectID,
  callback: (syncing: boolean) => unknown
): () => void {
  const my_index = syncingProjectListeners.length;
  syncingProjectListeners.push([active_id, callback]);
  return () => {
    syncingProjectListeners[my_index] = undefined; // To disable this listener, set to undefined
  };
}

export function isSyncingProject(active_id: ProjectID) {
  if (data_dbs[active_id] === undefined) {
    // When the project starts syncing, it should trigger the listenSyncingProject
    return false;
  }

  if (data_dbs[active_id].remote === null) {
    throw 'Projects not yet syncing';
  }

  return data_dbs[active_id].is_sync;
}

export function setSyncingProject(active_id: ProjectID, syncing: boolean) {
  if (syncing === isSyncingProject(active_id)) {
    return; //Nothing to do, already same value
  }
  const data_db = data_dbs[active_id];
  data_db.is_sync = syncing;

  const has_remote = (
    db: typeof data_db
  ): db is LocalDB<ProjectDataObject> & {
    remote: LocalDBRemote<ProjectDataObject>;
  } => {
    return db.remote !== null;
  };

  if (has_remote(data_db)) {
    setLocalConnection(data_db);
  }
  // Trigger sync listeners
  syncingProjectListeners
    .filter(l => l !== undefined && l![0] === active_id)
    .forEach(l => l![1](syncing));
}
