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

import {ProjectID} from '@faims3/data-model';
import {logError} from '../logging';
import {
  active_db,
  createUpdateAndSavePouchSync,
  data_dbs,
  ExistingActiveDoc,
} from './databases';
import {events} from './events';
import {getProject} from './projects';

export function listenSyncingProjectAttachments(
  active_id: ProjectID,
  callback: (syncing: boolean) => unknown
): () => void {
  const project_update_cb = (
    _type: unknown,
    _mc: unknown,
    _dc: unknown,
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
  return data_dbs[active_id]?.is_sync_attachments;
}

export async function setSyncingProjectAttachments(
  active_id: ProjectID,
  syncing: boolean
) {
  if (syncing === isSyncingProjectAttachments(active_id)) {
    logError(`Did not change attachment sync for project ${active_id}`);
    return; //Nothing to do, already same value
  }

  // Get the current database
  const data_db = data_dbs[active_id];

  // update the sync property
  data_db.is_sync_attachments = syncing;

  // This creates and updates the
  createUpdateAndSavePouchSync({
    // If local only - this method will handle it
    connectionInfo: data_db.remote?.info ?? null,
    globalDbs: data_dbs,
    localDbId: active_id,
  });

  try {
    const active_doc = await active_db.get(active_id);
    active_doc.is_sync_attachments = syncing;
    await active_db.put(active_doc);
  } catch (err) {
    logError(err);
  }

  const created = await getProject(active_id);
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
    created.active,
    created.project
  );
}
