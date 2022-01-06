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

import PouchDB from 'pouchdb';
import {
  DIRECTORY_PROTOCOL,
  DIRECTORY_HOST,
  DIRECTORY_PORT,
} from '../buildconfig';
import {
  ActiveDoc,
  ConnectionInfo,
  ListingsObject,
  ProjectMetaObject,
  ProjectDataObject,
  ProjectObject,
  LocalAuthDoc,
} from '../datamodel/database';
import {
  ConnectionInfo_create_pouch,
  local_pouch_options,
  materializeConnectionInfo,
} from './connection';
import {draft_db} from './draft-storage';
import {SyncHandler} from './sync-handler';

const DEFAULT_LISTING_ID = 'default';
export const POUCH_SEPARATOR = '_';
export const directory_connection_info: ConnectionInfo = {
  proto: DIRECTORY_PROTOCOL,
  host: DIRECTORY_HOST,
  port: DIRECTORY_PORT,
  db_name: 'directory',
};

export type ExistingActiveDoc = PouchDB.Core.ExistingDocument<ActiveDoc>;
export type ExistingListings = PouchDB.Core.ExistingDocument<ListingsObject>;

export interface LocalDB<Content extends {}> {
  local: PouchDB.Database<Content>;
  is_sync: boolean;
  remote: null | LocalDBRemote<Content>;
}

export interface LocalDBRemote<Content extends {}> {
  db: PouchDB.Database<Content>;
  connection:
    | PouchDB.Replication.Replication<Content>
    | PouchDB.Replication.Sync<Content>
    | null;
  info: ConnectionInfo;
  options: DBReplicateOptions;
  create_handler: (
    remote: LocalDB<Content> & {remote: LocalDBRemote<Content>}
  ) => SyncHandler<Content>;
  handler: null | SyncHandler<Content>;
}

export interface LocalDBList<Content extends {}> {
  [key: string]: LocalDB<Content>;
}

type DBReplicateOptions =
  | PouchDB.Replication.ReplicateOptions
  | {
      pull?: PouchDB.Replication.ReplicateOptions;
      push: PouchDB.Replication.ReplicateOptions;
    };

/**
 * Directory: All (public, anyways) Faims instances
 */
export const directory_db: LocalDB<ListingsObject> = {
  local: new PouchDB('directory', local_pouch_options),
  remote: null,
  is_sync: true,
};

/**
 * Active: A local (NOT synced) list of:
 *   {_id, username, password, project_id, listing_id}
 *   For each project the current device is part of (so this is keyed by listing id + project id),
 *   * listing_id: A couchdb instance object's id (from "directory" db)
 *   * project_id: A project id (from the project_db in the couchdb instance object.)
 *   * authentication mechanism used (id of a doc in the auth_db)
 */
export const active_db = new PouchDB<ActiveDoc>('active', local_pouch_options);

/**
 * This contains any local app state we want to keep across sessions
 */
export const local_state_db = new PouchDB('local_state', local_pouch_options);

/**
 * Login tokens for each FAIMS Cluster that needs it
 */
export const local_auth_db = new PouchDB<LocalAuthDoc>(
  'local_auth',
  local_pouch_options
);

/**
 * Each listing has a Projects database and Users DBs
 */
export const projects_dbs: LocalDBList<ProjectObject> = {};

/**
 * Per-[active]-project project data:
 * Contain in these databases (indexed by the active_db id's)
 * is project data.
 */
export const data_dbs: LocalDBList<ProjectDataObject> = {};

/**
 * Synced from the project metadatabase for each active project,
 * This has the metadata describing a database. Project Schemas,
 * GUI Models, and a Prople database.
 */
export const metadata_dbs: LocalDBList<ProjectMetaObject> = {};

let default_projects_db: null | ConnectionInfo = null;

export async function get_base_connection_info(
  listing_object: ListingsObject
): Promise<ConnectionInfo> {
  if (default_projects_db === null) {
    try {
      // Normal case of a single DEFAULT listing in the directory
      const possibly_corrupted_instance = await directory_db.local.get(
        DEFAULT_LISTING_ID
      );
      return (default_projects_db = materializeConnectionInfo(
        directory_connection_info,
        possibly_corrupted_instance.projects_db
      ));
    } catch (err: any) {
      // Missing when directory_db has NOTHING in it
      // i.e. current FAIMS app doesn't have a directory
      // this is usually because it's the server, not the app.
      if (err.message !== 'missing') {
        // Other DB error
        throw err;
      }

      const nullexcept = <T>(val: T | undefined | null, err: any): T => {
        if (val === null || val === undefined) {
          throw err;
        }
        return val;
      };

      // If running in server mode
      // the listings object MUST have all the connection properties
      return {
        proto: nullexcept(
          listing_object.projects_db?.proto,
          'Server misconfigured: Missing proto'
        ),
        host: nullexcept(
          listing_object.projects_db?.host,
          'Server misconfigured: Missing host'
        ),
        port: nullexcept(
          listing_object.projects_db?.port,
          'Server misconfigured: Missing port'
        ),
        lan: listing_object.projects_db?.lan,
        db_name: nullexcept(
          listing_object.projects_db?.db_name,
          'Server misconfigured: Missing db_name'
        ),
        auth: listing_object.projects_db?.auth,
      };
    }
  }
  return default_projects_db;
}

/**
 * @param prefix Name to use to run new PouchDB(prefix + POUCH_SEPARATOR + id), objects of the same type have the same prefix
 * @param local_db_id id is per-object of type, to discriminate between them. i.e. a project ID
 * @param global_dbs projects_db
 * @returns Flag if newly created =true, already existing=false & The local DB
 */
export function ensure_local_db<Content extends {}>(
  prefix: string,
  local_db_id: string,
  start_sync: boolean,
  global_dbs: LocalDBList<Content>
): [boolean, LocalDB<Content>] {
  if (global_dbs[local_db_id]) {
    return [false, global_dbs[local_db_id]];
  } else {
    return [
      true,
      (global_dbs[local_db_id] = {
        local: new PouchDB(
          prefix + POUCH_SEPARATOR + local_db_id,
          local_pouch_options
        ),
        is_sync: start_sync,
        remote: null,
      }),
    ];
  }
}

/**
 * @param local_db_id id is per-object of type, to discriminate between them. i.e. a project ID
 * @param global_dbs projects_db
 * @param connection_info Info to use to connect to remote
 * @param options PouchDB options. Defaults to live: true, retry: true.
 *                if options.sync is defined, then this turns into ensuring the DB
 *                is pushing to the remote as well as pulling.
 * @returns Flag if newly created =true, already existing=false & The local DB & remote
 */
export function ensure_synced_db<Content extends {}>(
  local_db_id: string,
  connection_info: ConnectionInfo | null,
  global_dbs: LocalDBList<Content>,
  handler: (remote: LocalDB<Content>) => SyncHandler<Content>,
  options: DBReplicateOptions = {}
): [boolean, LocalDB<Content>] {
  if (global_dbs[local_db_id] === undefined) {
    throw 'Logic eror: ensure_local_db must be called before this code';
  }

  // Already connected/connecting, or local-only database
  if (
    global_dbs[local_db_id].remote !== null &&
    JSON.stringify(global_dbs[local_db_id].remote!.info) ===
      JSON.stringify(connection_info) &&
    JSON.stringify(global_dbs[local_db_id].remote!.options) ===
      JSON.stringify(options)
  ) {
    return [
      false,
      {
        ...global_dbs[local_db_id],
        remote: global_dbs[local_db_id].remote!,
      },
    ];
  }

  // Special case for local-only projects
  // Synchandler is created to manage it, but since local only PouchDB's aren't
  // reused, we're not worried about recovering/deleting the Synchandlers
  // So they don't have to go into a global variable
  if (connection_info === null) {
    const sync_handler = handler(global_dbs[local_db_id]);
    sync_handler.listen_local(
      global_dbs[local_db_id].local.changes({since: 'now', include_docs: true})
    );
    return [false, global_dbs[local_db_id]];
  }

  const db_info = (global_dbs[local_db_id] = {
    ...global_dbs[local_db_id],
    remote: {
      db: ConnectionInfo_create_pouch(connection_info),
      connection: null, //Connection initialized in setLocalConnection
      info: connection_info,
      create_handler: handler,
      handler: null,
      options: options,
    },
  });

  setLocalConnection(db_info);
  return [true, db_info];
}

/**
 * If the given remote DB is not synced, starts syncing, and visa versa.
 * db_info.remote.{connection, handler} are modified based on what's in
 * db_info.is_sync, db_info.remote.info, db_info.remote.create_handler.
 *
 * This does NOT ensure that the existing connection info (URL, port, proto)
 * matches anything. that's left to ensure_synced_db
 *
 * @param db_info info to use to create a DB connection:
 *                Remote connection info, is_sync, the local DB to sync with,
 */
export function setLocalConnection<Content extends {}>(
  db_info: LocalDB<Content> & {remote: LocalDBRemote<Content>}
) {
  const options = db_info.remote.options;
  console.debug('Setting local connection:', db_info);

  if (db_info.is_sync && db_info.remote.connection === null) {
    // Start a new connection
    const push_too = (options as {push?: unknown}).push !== undefined;
    let connection:
      | PouchDB.Replication.Replication<Content>
      | PouchDB.Replication.Sync<Content>;

    if (push_too) {
      const options_sync = options as PouchDB.Replication.SyncOptions;
      connection = PouchDB.sync(db_info.remote.db, db_info.local, {
        push: {live: true, retry: true, ...options_sync.push},
        pull: {live: true, retry: true, ...(options_sync.pull || {})},
      });
    } else {
      connection = PouchDB.replicate(db_info.remote.db, db_info.local, {
        live: true,
        retry: true,
        ...options,
      });
    }

    db_info.remote.connection = connection;
    db_info.remote.handler = db_info.remote.create_handler(db_info);
    db_info.remote.handler.listen_remote(
      connection,
      db_info.local.changes({since: 'now', include_docs: true})
    );
    console.debug('Connected up sync for', db_info);
  } else if (!db_info.is_sync && db_info.remote.connection !== null) {
    // Stop an existing connection
    db_info.remote.handler!.detach(db_info.remote.connection);
    db_info.remote.connection.cancel();
    db_info.remote.connection = null;
    console.debug('Removed sync for', db_info);
  } else {
    console.error('This is an odd state', db_info);
  }
}

async function delete_synced_db(name: string, db: LocalDB<any>) {
  try {
    console.debug(await db.remote?.db.close());
  } catch (err) {
    console.error('Failed to remove remote db', name);
    console.error(err);
  }
  try {
    console.debug(await db.local.destroy());
    console.debug('Removed local db', name);
  } catch (err) {
    console.error('Failed to remove local db', name);
    console.error(err);
  }
}

async function delete_synced_dbs(db_list: LocalDBList<any>) {
  for (const name in db_list) {
    console.debug('Deleting', name);
    await delete_synced_db(name, db_list[name]);
    delete db_list['name'];
  }
}

export async function wipe_all_pouch_databases() {
  const local_only_dbs_to_wipe = [
    active_db,
    local_state_db,
    draft_db,
    local_auth_db,
  ];
  await delete_synced_dbs(data_dbs);
  await delete_synced_dbs(metadata_dbs);
  await delete_synced_dbs(projects_dbs);
  await delete_synced_db('directory', directory_db);
  for (const db of local_only_dbs_to_wipe) {
    try {
      console.debug(await db.destroy());
    } catch (err) {
      console.error(err);
    }
  }
  // TODO: work out how best to recreate the databases, currently using a
  // redirect and having FAIMS reinitialise seems to be the best
  console.debug('Deleted dbs');
}
