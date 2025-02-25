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
 * Filename: drafts.ts
 * Description:
 *   TODO
 */

import {ProjectID, RecordID} from '@faims3/data-model';
import {draft_db} from './sync/draft-storage';

export async function deleteDraftsForRecord(
  project_id: ProjectID,
  record_id: RecordID
) {
  try {
    const res = await draft_db.find({
      selector: {
        project_id: project_id,
        record_id: record_id,
      },
    });
    const ids_to_delete = res.docs.map(o => {
      return {
        _id: o._id,
        _rev: o._rev,
        _deleted: true,
      };
    });
    console.debug('ids_to_delete', ids_to_delete);
    if (ids_to_delete.length > 0) {
      await (draft_db as PouchDB.Database<{}>).bulkDocs(ids_to_delete);
    }
  } catch (err) {
    console.debug('Failed to remove drafts', err);
    throw err;
  }
}
