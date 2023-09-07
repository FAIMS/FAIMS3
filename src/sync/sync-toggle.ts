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
 *   GUI level functions and listeners for the syncing state of the datadbs
 *   (currently), including attachments. Further syncing control (e.g. for
 *   projects) at the GUI level should probably go here also.
 */

import {ProjectID} from 'faims3-datamodel';
import {ProjectDataObject} from 'faims3-datamodel';
import {logError} from '../logging';
import {
  active_db,
  data_dbs,
  ExistingActiveDoc,
  LocalDB,
  LocalDBRemote,
  setLocalConnection,
} from './databases';
import {events} from './events';
import {createdListings, createdProjects} from './state';

export function listenSyncingProject(
  active_id: ProjectID,
  callback: (syncing: boolean) => unknown
): () => void {
  const project_update_cb = (
    _type: unknown,
    _mc: unknown,
    _dc: unknown,
    _listing: unknown,
    active: ExistingActiveDoc
  ) => {
    if (active._id === active_id) {
      callback(active.is_sync);
    }
  };
  events.on('project_update', project_update_cb);
  return events.removeListener.bind(
    events,
    'project_update',
    project_update_cb
  );
}

export function isSyncingProject(active_id: ProjectID): boolean {
  return data_dbs[active_id]!.is_sync;
}

export async function setSyncingProject(
  active_id: ProjectID,
  syncing: boolean
) {
  if (syncing === isSyncingProject(active_id)) {
    logError(`Did not change sync for project ${active_id}`);
    return; //Nothing to do, already same value
  }
  console.info('Change sync for project', active_id, syncing);
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
  } else {
    console.log('project is local only');
  }

  try {
    const active_doc = await active_db.get(active_id);
    active_doc.is_sync = syncing;
    await active_db.put(active_doc);
  } catch (err) {
    logError(err);
    throw Error(
      `Could not change sync for this notebook (${active_id}). Contact Support.`
    );
  }

  const created = createdProjects[active_id];

  events.emit(
    'project_update',
    [
      'update',
      {
        ...created,
        active: {
          ...created.active,
          is_sync: !syncing,
        },
      },
    ],
    false,
    false,
    createdListings[created.active.listing_id].listing,
    created.active,
    created.project
  );
}

export function listenSyncingProjectAttachments(
  active_id: ProjectID,
  callback: (syncing: boolean) => unknown
): () => void {
  const project_update_cb = (
    _type: unknown,
    _mc: unknown,
    _dc: unknown,
    _listing: unknown,
    active: ExistingActiveDoc
  ) => {
    if (active._id === active_id) {
      callback(active.is_sync_attachments);
    }
  };
  events.on('project_update', project_update_cb);
  return events.removeListener.bind(
    events,
    'project_update',
    project_update_cb
  );
}

export function isSyncingProjectAttachments(active_id: ProjectID): boolean {
  return data_dbs[active_id]!.is_sync_attachments;
}

export async function setSyncingProjectAttachments(
  active_id: ProjectID,
  syncing: boolean
) {
  if (syncing === isSyncingProjectAttachments(active_id)) {
    logError(`Did not change attachment sync for project ${active_id}`);
    return; //Nothing to do, already same value
  }
  const data_db = data_dbs[active_id];
  data_db.is_sync_attachments = syncing;

  const has_remote = (
    db: typeof data_db
  ): db is LocalDB<ProjectDataObject> & {
    remote: LocalDBRemote<ProjectDataObject>;
  } => {
    return db.remote !== null;
  };

  if (has_remote(data_db)) {
    setLocalConnection(data_db);
  } else {
    console.log('project is local only');
  }

  try {
    const active_doc = await active_db.get(active_id);
    active_doc.is_sync_attachments = syncing;
    await active_db.put(active_doc);
  } catch (err) {
    logError(err);
  }

  const created = createdProjects[active_id];
  events.emit(
    'project_update',
    [
      'update',
      {
        ...created,
        active: {
          ...created.active,
          is_sync_attachments: !syncing,
        },
      },
    ],
    false,
    false,
    createdListings[created.active.listing_id].listing,
    created.active,
    created.project
  );
}
