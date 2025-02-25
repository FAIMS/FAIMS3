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
 * Filename: connection.ts
 * Description:
 *   Utilities for creating database connections
 */

import PouchDB from 'pouchdb-browser';
import {SyncStatusCallbacks} from '@faims3/data-model';
import {PossibleConnectionInfo} from '@faims3/data-model';
import * as _ from 'lodash';

export interface ConnectionInfo {
  proto?: string;
  host?: string;
  port?: number;
  base_url?: string;
  lan?: boolean;
  db_name: string;
  auth?: {
    username: string;
    password: string;
  };
  jwt_token?: string;
}

/**
 * Configure local pouchdb settings; note that this applies to *ALL* local
 * databases (remote ones are handled separately), so don't add db-specific
 * logic to this
 */
// the sync status functions are throttled to once per 7s.
// each time one is triggered it runs for 5s until the reverse is dispatched.
// No sync events will be captured in the following 2s to give the interface some pause time.
// (otherwise the arrows flickering can be overwhelming)
export const THROTTLE_TIME = 7000;
export const local_pouch_options: any = {};

// can't have this under vite browser build without configuration pain
import {RUNNING_UNDER_TEST} from '../buildconfig';
//import PouchDBAdaptorMemory from 'pouchdb-adapter-memory';
if (RUNNING_UNDER_TEST) {
  // enable memory adapter for testing
  // console.log('Using memory store');
  //PouchDB.plugin(PouchDBAdaptorMemory);
  local_pouch_options['adapter'] = 'memory';
}

// merge one or more overlay structures to get a connection info object
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

/*
 * The following provide the infrastructure connect up the UI sync notifications
 * with pouchdb's callbacks.
 */
let sync_status_callbacks: SyncStatusCallbacks | null = null;

export function set_sync_status_callbacks(callbacks: SyncStatusCallbacks) {
  sync_status_callbacks = callbacks;
}

export function ping_sync_up() {
  if (sync_status_callbacks !== null) {
    sync_status_callbacks.sync_up();
  }
}

export function ping_sync_down() {
  if (sync_status_callbacks !== null) {
    sync_status_callbacks.sync_down();
  }
}
export const throttled_ping_sync_up = _.throttle(ping_sync_up, THROTTLE_TIME);
export const throttled_ping_sync_down = _.throttle(
  ping_sync_down,
  THROTTLE_TIME
);

export function ping_sync_error() {
  if (sync_status_callbacks !== null) {
    sync_status_callbacks.sync_error();
  }
}

export function ping_sync_denied() {
  if (sync_status_callbacks !== null) {
    sync_status_callbacks.sync_denied();
  }
}

/**
 * Creates a local PouchDB.Database used to access a remote Couch/Pouch instance
 * @param connectionInfo Network address/database info to use to initialize the connection
 * @returns A new PouchDB.Database, interfacing to the remote Couch/Pouch instance
 */
export function createPouchDbFromConnectionInfo<Content extends {}>(
  connectionInfo: ConnectionInfo
): PouchDB.Database<Content> {
  const pouch_options: PouchDB.Configuration.RemoteDatabaseConfiguration = {
    skip_setup: true,
  };

  // Username & password auth is optional
  if ('auth' in connectionInfo && connectionInfo.auth !== undefined) {
    pouch_options.auth = {
      username: connectionInfo.auth.username,
      password: connectionInfo.auth.password,
    };
  }
  // TODO: Use a new enough pouchdb such that we don't need the fetch hook, see
  // https://github.com/pouchdb/pouchdb/issues/8387
  pouch_options.fetch = function (url: any, opts: any) {
    if (
      'jwt_token' in connectionInfo &&
      connectionInfo.jwt_token !== undefined
    ) {
      // if (DEBUG_APP) {
      //   console.debug('Using JWT for connection', connection_info);
      // }
      opts.headers.set('Authorization', `Bearer ${connectionInfo.jwt_token}`);
    }
    throttled_ping_sync_up();
    throttled_ping_sync_down();
    // Commented out as it seems this may break sending attachments on
    // chrome/safari
    //opts.keepalive = true;
    return PouchDB.fetch(url, opts);
  };
  let db_url: string;
  // if we have a base_url configured, make the connection url from that
  if (connectionInfo.base_url) {
    if (connectionInfo.base_url.endsWith('/'))
      db_url = connectionInfo.base_url + connectionInfo.db_name;
    else db_url = connectionInfo.base_url + '/' + connectionInfo.db_name;
  } else {
    // This should not happen!
    console.error(
      'Misconfigured CouchDB URL in connectionInfo! This is a serious issue. Falling back to default of http://localhost:5984... This is not likely to work in a production deployment. Connection info provided: ',
      connectionInfo
    );
    db_url =
      encodeURIComponent(connectionInfo.proto || 'http') +
      '://' +
      encodeURIComponent(connectionInfo.host || 'localhost') +
      ':' +
      encodeURIComponent(connectionInfo.port || '5984') +
      '/' +
      encodeURIComponent(connectionInfo.db_name);
  }

  return new PouchDB(db_url, pouch_options);
}
