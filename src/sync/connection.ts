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
 * Filename: index.ts
 * Description:
 *   TODO
 */

import PouchDB from 'pouchdb';
import {RUNNING_UNDER_TEST} from '../buildconfig';
import {ConnectionInfo, PossibleConnectionInfo} from '../datamodel/database';
import PouchDBAdaptorMemory from 'pouchdb-adapter-memory';

/**
 * Configure local pouchdb settings; note that this applies to *ALL* local
 * databases (remote ones are handled separately), so don't add db-specific
 * logic to this
 */

export const local_pouch_options: any = {};
if (RUNNING_UNDER_TEST) {
  // enable memory adapter for testing
  console.error('Using memory store');
  PouchDB.plugin(PouchDBAdaptorMemory);
  local_pouch_options['adapter'] = 'memory';
}

export function materializeConnectionInfo(
  base_info: ConnectionInfo,
  ...overlays: PossibleConnectionInfo[]
): ConnectionInfo {
  let ret = {...base_info};
  for (const overlay of overlays) {
    ret = {...ret, ...overlay};
  }
  return ret;
}

/**
 * Creates a local PouchDB.Database used to access a remote Couch/Pouch instance
 * @param connection_info Network address/database info to use to initialize the connection
 * @returns A new PouchDB.Database, interfacing to the remote Couch/Pouch instance
 */
export function ConnectionInfo_create_pouch<Content extends {}>(
  connection_info: ConnectionInfo,
  username: string | null = null,
  password: string | null = null,
  skip_setup = false
): PouchDB.Database<Content> {
  const pouch_options: any = {skip_setup: skip_setup};
  if (username !== null && password !== null) {
    pouch_options.auth = {
      username: username,
      password: password,
    };
  }
  return new PouchDB(
    encodeURIComponent(connection_info.proto) +
      '://' +
      encodeURIComponent(connection_info.host) +
      ':' +
      encodeURIComponent(connection_info.port) +
      '/' +
      encodeURIComponent(connection_info.db_name),
    pouch_options
  );
}
