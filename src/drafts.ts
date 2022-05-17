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

import {ProjectID} from './datamodel/core';
import {draft_db, listDraftMetadata} from './sync/draft-storage';
import {DraftMetadataList} from './datamodel/drafts';

export function listenDrafts(
  project_id: ProjectID,
  filter: 'updates' | 'created' | 'all',
  callback: (draftList: DraftMetadataList) => unknown
): () => void {
  const runCallback = (): void =>
    listDraftMetadata(project_id, filter)
      .then(callback)
      .catch(err => console.error('Uncaught draft list error', err));

  const changes = draft_db
    .changes({
      since: 'now',
      include_docs: true,
      live: true,
    })
    .on('change', info => {
      console.log(info);
      if (info.doc!.project_id === project_id) {
        runCallback();
      }
    })
    .on('error', err => console.error('Uncaught draft list error', err));

  runCallback();

  return changes.cancel.bind(changes);
}
