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
 * Filename: listeners.ts
 * Description:
 *   TODO
 */

import {ProjectID} from '../datamodel/core';
import {ActiveDoc} from '../datamodel/database';
import {RecordMetadataList} from '../datamodel/ui';
import {ExistingActiveDoc} from '../sync/databases';
import {events} from '../sync/events';
import {add_initial_listener} from '../sync/event-handler-registration';
import {listRecordMetadata} from './internals';

// note the string below is a ProjectID, but typescript is kinda silly and
// doesn't let us do that
const recordsUpdated: {[project_id: string]: boolean} = {};

add_initial_listener(initializeEvents => {
  initializeEvents.on(
    'project_data_paused',
    (listing, active: ExistingActiveDoc) => {
      recordsUpdated[active._id] = true;
    }
  );
});

/**
 * Registers a callback to be run whenever recordList is updated.
 * If the recordList already updated before this function is called, the callback is also run immediately.
 *
 * @param project_id listing_id & project_id (active doc ._id) to get records of
 * @param callback Run whenever the list of records might have changed, called with the list.
 * @returns 'Destructor' that removes the listener that this function added.
 */
export function listenRecordsList(
  project_id: ProjectID,
  callback: (recordList: RecordMetadataList) => unknown
): () => void {
  const runCallback = () =>
    listRecordMetadata(project_id)
      .then(callback)
      .catch(err => console.error('Uncaught record list error', err));

  const listener_func = (listing: unknown, active: ActiveDoc) => {
    if (active._id === project_id) runCallback();
  };

  events.on('project_data_paused', listener_func);

  if (recordsUpdated[project_id]) runCallback();

  return () => events.removeListener('project_data_paused', listener_func);
}
