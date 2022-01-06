/*
 * Copyright 2021,2022 Macquarie University
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

import {DirectoryEmitter} from './events';

let initialized_yet = false;

/**
 * List of functions to call before  the initialization starts
 * I.e. initialize_dbs() calls each one of these, once only, before
 * the first 'directory_local' event even starts.
 */
const registering_funcs: ((emitter: DirectoryEmitter) => unknown)[] = [];
const registered_unique_ids: Set<unknown> = new Set();

/**
 * Called by sync/initialize.ts just before creating/connecting
 * the first PouchDB (The first thing that can emit events)
 */
export function attach_all_listeners(initializeEvents: DirectoryEmitter) {
  if (initialized_yet) {
    throw Error('attach_all_listeners called twice');
  } else {
    initialized_yet = true;
    registering_funcs.forEach(func => func(initializeEvents));

    // clear memory
    registering_funcs.splice(0, registering_funcs.length);
    registered_unique_ids.clear();
  }
}

/**
 * Allows external modules to register listeners onto initializeEvents that are
 * guaranteed to be registered before any events are emitted onto the emitter.
 *
 * This allows, for example, to register 'project_meta_paused' listener, and you
 * know *for sure* that you have all project metas available.
 *
 * This throws an error it it's called after initialization has alreayd run
 *
 * @param registering_function Function to call to register event listeners onto given emitter
 */
export function add_initial_listener(
  registering_function: (emitter: DirectoryEmitter) => unknown,
  unique_id?: unknown | undefined
) {
  if (initialized_yet === true && !registered_unique_ids.has(unique_id)) {
    // It is OK to call this late if the functions' already been added.
    throw Error(
      'add_initialize_listener was called too late, initialization has already started!'
    );
  }
  registering_funcs.push(registering_function);
  if (unique_id !== undefined) {
    registered_unique_ids.add(unique_id);
  }
}
