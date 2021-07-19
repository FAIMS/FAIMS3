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
 * Filename: observationMetadata.ts
 * Description:
 *   Interaction with the metadata of an observation: Users, dates.-
 */
import {ProjectID} from './datamodel';
import {DBTracker} from './gui/pouchHook';
import {lookupFAIMSDataID} from './dataStorage';

export const observationMetadataTracker = new DBTracker<
  [ProjectID, string /* observation_id */],
  {[key: string]: any}
>(lookupFAIMSDataID, [
  'project_data_paused',
  async (project_id: ProjectID, observation_id: string) => {
    const observation = await lookupFAIMSDataID(project_id, observation_id);
    return {
      Created: observation?.created.toString(),
      Updated: observation?.updated.toString(),
      'Created by': observation?.created_by,
      'Last updated by': observation?.updated_by,
    };
  },
]);
