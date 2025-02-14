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
import {active_db, createUpdateAndSavePouchSync, data_dbs} from './databases';

export function isSyncingProjectAttachments(active_id: ProjectID): boolean {
  return data_dbs[active_id]?.is_sync_attachments;
}

export async function setSyncingProjectAttachments(
  active_id: ProjectID,
  syncing: boolean
) {
  console.log('sync toggle', active_id, syncing);
  if (syncing !== isSyncingProjectAttachments(active_id)) {
    // Get the current database
    const data_db = data_dbs[active_id];

    // update the sync property
    data_db.is_sync_attachments = syncing;

    // This creates and updates the sync connection so that it streams the
    // attachments appropriately
    createUpdateAndSavePouchSync({
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
  }
  return syncing;
}
