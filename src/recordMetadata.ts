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
 * Filename: recordMetadata.ts
 * Description:
 *   Interaction with the metadata of an record: Users, dates.-
 */
import {ProjectID} from './datamodel/core';
import {DBTracker} from './gui/pouchHook';
import {getRecordMetadata} from './data_storage';

export const recordMetadataTracker = new DBTracker<
  [ProjectID, string /* record_id */, string /*revision_id*/],
  {[key: string]: any}
>(getRecordMetadata, [
  'project_meta_paused',
  async (project_id: ProjectID, record_id: string, revision_id: string) => {
    const record = await getRecordMetadata(project_id, record_id, revision_id);
    return {
      Created: record?.created.toString(),
      Updated: record?.updated.toString(),
      'Created by': record?.created_by,
      'Last updated by': record?.updated_by,
    };
  },
]);
