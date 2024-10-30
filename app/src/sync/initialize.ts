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
 *   TODO
 */
import PouchDB from 'pouchdb-browser';

import {DEBUG_POUCHDB} from '../buildconfig';

import {events} from './events';
import {update_directory} from './process-initialization';
import {register_basic_automerge_resolver, register_sync_state} from './state';

/**
 *
 * @returns creates all project PouchDB objects and metadata
 * DBs synced
 */
export async function initialize() {
  if (DEBUG_POUCHDB) PouchDB.debug.enable('*');

  register_sync_state(events);
  register_basic_automerge_resolver(events);
  await update_directory().catch(err => events.emit('directory_error', err));
}
