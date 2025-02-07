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
 * Filename: databases.ts
 * Description:
 *   Create the main local databases and provide access to them
 */

import {
  ListingID,
  NonUniqueProjectID,
  ProjectDataObject,
  ProjectID,
  ProjectMetaObject,
} from '@faims3/data-model';
import {ListingsObject} from '@faims3/data-model/src/types';
import PouchDB from 'pouchdb-browser';
import {POUCH_BATCH_SIZE, POUCH_BATCHES_LIMIT} from '../buildconfig';
import {db as projects_db} from '../dbs/projects-db';
import {logError} from '../logging';
import {
  ConnectionInfo,
  createPouchDbFromConnectionInfo,
  local_pouch_options,
} from './connection';
import {draft_db} from './draft-storage';
import {ProjectObject} from './projects';

export const DB_TIMEOUT = 2000;
export const DEFAULT_LISTING_ID = 'default';
export const POUCH_SEPARATOR = '_';

export type ExistingActiveDoc = PouchDB.Core.ExistingDocument<ActiveDoc>;
export type ExistingListings = PouchDB.Core.ExistingDocument<ListingsObject>;

export interface LocalDB<Content extends {}> {
  local: PouchDB.Database<Content>;
  changes: PouchDB.Core.Changes<Content>;
  is_sync: boolean;
  is_sync_attachments: boolean;
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
}

export interface LocalDBList<Content extends {}> {
  [key: string]: LocalDB<Content>;
}

type DBReplicateOptions =
  | PouchDB.Replication.ReplicateOptions
  | {
      pull: PouchDB.Replication.ReplicateOptions;
      push: PouchDB.Replication.ReplicateOptions;
    };

/**
 * Each database has a changes stream.
 * This is the template for which the changes stream is listened to
 * Some databases might use options added to this like:
 *  {...default_changes_opts, filter:'abc'}
 * If they want to, for example, restrict to only listings in the active DB.
 */
export const default_changes_opts: PouchDB.Core.ChangesOptions &
  PouchDB.Core.AllDocsOptions = {
  live: true,
  since: 'now',
  timeout: DB_TIMEOUT,
  include_docs: true,
  conflicts: true,
  attachments: true,
};

export const directory_db_pouch = new PouchDB<ListingsObject>(
  'directory',
  local_pouch_options
);
/**
 * Directory: All (public) Faims instances
 */
export const directory_db: LocalDB<ListingsObject> = {
  local: directory_db_pouch,
  changes: directory_db_pouch.changes({...default_changes_opts, since: 'now'}),
  remote: null,
  is_sync: true,
  is_sync_attachments: false,
};

/**
 * Active: A local (NOT synced) list of:
 *   {_id, username, password, project_id, listing_id}
 *   For each project the current device is part of (so this is keyed by listing id + project id),
 *   * listing_id: A couchdb instance object's id (from "directory" db)
 *   * project_id: A project id (from the project_db in the couchdb instance object.)
 *   * authentication mechanism used (id of a doc in the auth_db)
 */
export interface ActiveDoc {
  _id: ProjectID;
  listing_id: ListingID;
  project_id: NonUniqueProjectID;
  username: string | null;
  password: string | null;
  friendly_name?: string;
  is_sync: boolean;
  is_sync_attachments: boolean;
}

export const active_db = new PouchDB<ActiveDoc>('active', local_pouch_options);

/**
 * This contains any local app state we want to keep across sessions
 */
const local_state_db = new PouchDB('local_state', local_pouch_options);

export const getLocalStateDB = () => {
  return local_state_db;
};

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
 * Synced from the project meta-database for each active project,
 * This has the metadata describing a database. Project Schemas,
 * GUI Models, and a People database.
 */
export const metadata_dbs: LocalDBList<ProjectMetaObject> = {};

/**
 * @param prefix Name to use to run new PouchDB(prefix + POUCH_SEPARATOR + id), objects of the same type have the same prefix
 * @param localDbId id is per-object of type, to discriminate between them. i.e. a project ID
 * @param globalDbs projects_db
 * @returns Flag if newly created =true, already existing=false & The local DB
 */
export function ensureLocalDb<Content extends {}>({
  prefix,
  localDbId,
  initiateSync,
  globalDbs,
  startSyncAttachments,
}: {
  prefix: string;
  localDbId: string;
  initiateSync: boolean;
  globalDbs: LocalDBList<Content>;
  startSyncAttachments: boolean;
}): [boolean, LocalDB<Content>] {
  if (globalDbs[localDbId]) {
    globalDbs[localDbId].is_sync = initiateSync;
    return [false, globalDbs[localDbId]];
  } else {
    const db = new PouchDB<Content>(
      prefix + POUCH_SEPARATOR + localDbId,
      local_pouch_options
    );
    return [
      true,
      (globalDbs[localDbId] = {
        local: db,
        changes: db.changes(default_changes_opts),
        is_sync: initiateSync,
        is_sync_attachments: startSyncAttachments,
        remote: null,
      }),
    ];
  }
}

/**
 * Manages synchronization between local and remote PouchDB databases.
 *
 * This function ensures proper synchronization between a local database and its
 * remote counterpart by:
 *
 * 1. Validating the local database exists
 * 2. Maintaining existing sync if configuration hasn't changed
 * 3. Creating new sync connections when needed
 * 4. Cleaning up old resources (sync and pouch DBs)
 *
 * NOTE: this method will write the updates to the global DB
 *
 * @param localDbId - Identifier for the local database
 * @param connectionInfo - Remote connection configuration (null for local-only DBs)
 * @param globalDbs - Registry of all local databases
 * @returns [boolean, LocalDB<Content>] - [true if new sync created, updated database info]
 * @throws Error if local database is not initialized
 */
export function createUpdateAndSavePouchSync<Content extends {}>({
  localDbId,
  connectionInfo,
  globalDbs,
}: {
  localDbId: string;
  connectionInfo: ConnectionInfo | null;
  globalDbs: LocalDBList<Content>;
}): [boolean, LocalDB<Content>] {
  // Verify local database exists
  const localDb = globalDbs[localDbId];
  if (!localDb) {
    throw new Error(
      'Local database must be initialized before creating sync connection'
    );
  }

  // Handle local-only databases (no remote connection needed)
  if (connectionInfo === null) {
    return [false, localDb];
  }

  // Check if existing remote connection matches new configuration
  if (hasMatchingConnection(localDb.remote, connectionInfo)) {
    return [false, localDb];
  }

  // Helper function to stop existing connection
  const cleanupPouchState = (db: LocalDB<Content>) => {
    // First remove any sync
    if (db.remote?.connection) {
      console.log('Closing existing sync connection');
      // Remove all listeners
      db.remote.connection.removeAllListeners();
      // Cancel the connection
      db.remote.connection.cancel();
      // Set it to null
      db.remote.connection = null;
    }

    // And if the db itself is still there, clean it up too
    if (db.remote?.db) {
      console.log('Closing existing remote DB');
      db.remote.db.close();
    }
  };

  // cleanup the old PouchDB object and the related sync
  cleanupPouchState(localDb);

  // Create updated database configuration with new remote connection and new
  // PouchDB object
  const newDb = createPouchDbFromConnectionInfo<Content>(connectionInfo);
  const {sync: newSync, options} = createPouchDbSync({
    attachmentDownload: localDb.is_sync,
    localDb: localDb.local,
    remoteDb: newDb,
  });

  const updatedDb = {
    ...localDb,
    remote: {
      db: newDb,
      connection: newSync,
      info: connectionInfo,
      options,
    },
  };

  // Update the global DB as specified
  globalDbs[localDbId] = updatedDb;

  // Return those details
  return [true, updatedDb];
}

/**
 * Determines if an existing remote connection matches new connection parameters
 * by comparing their serialized configurations.
 */
function hasMatchingConnection<Content extends {}>(
  existingRemote: LocalDBRemote<Content> | null,
  newConnectionInfo: ConnectionInfo
): boolean {
  if (!existingRemote) {
    return false;
  }

  return (
    JSON.stringify(existingRemote.info) === JSON.stringify(newConnectionInfo)
  );
}

/**
 * Creates a new synchronisation (PouchDB.sync) between the specified local and
 * remote DB. This uses the preferred sync options to avoid misconfiguration in
 * caller functions. Two way sync is always enabled, with live and retry. If
 * attachment filter is supplied, the pull sync options are overrided with a
 * filter.
 *
 * @param attachmentDownload Download attachments iff true
 * @param localDb The local DB to sync
 * @param remoteDb The remote DB to sync
 *
 * @returns sync The new sync object
 * @returns options The sync options used (since parent caller likes to know)
 */
export function createPouchDbSync<Content extends {}>({
  attachmentDownload,
  localDb,
  remoteDb,
}: {
  attachmentDownload: boolean;
  localDb: PouchDB.Database<Content>;
  remoteDb: PouchDB.Database<Content>;
}) {
  // Configure attachment filtering if needed
  const pullFilter = attachmentDownload
    ? {}
    : {filter: '_view', view: 'attachment_filter/attachment_filter'};

  const options: DBReplicateOptions = {
    // Live sync mode (i.e. poll)
    live: true,
    // Retry on fail
    retry: true,
    // Back off reasonably slowly
    back_off_function: (delay: number) => delay * 1.5,
    // Timeout after 15 seconds
    timeout: 15000,
    // Sync batch sizing options
    batch_size: POUCH_BATCH_SIZE,
    batches_limit: POUCH_BATCHES_LIMIT,
    // Push and pull specific options
    push: {
      checkpoint: 'source',
    },
    pull: {
      checkpoint: 'target',
      ...pullFilter,
    },
  };

  return {
    options,
    sync: PouchDB.sync(localDb, remoteDb, options)
      .on('error', err => {
        console.warn('❌ Sync error occurred:', {
          error: err,
          dbName: localDb.name,
        });
      })
      .on('denied', err => {
        console.warn('🚫 Sync access denied:', {
          error: err,
          dbName: localDb.name,
        });
      }),
  };
}

async function delete_synced_db(name: string, db: LocalDB<any>) {
  try {
    console.debug(await db.remote?.db.close());
  } catch (err) {
    logError(err);
  }
  try {
    console.debug(await db.local.destroy());
    console.debug('Removed local db', name);
  } catch (err) {
    logError(err);
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
    projects_db,
  ];
  await delete_synced_dbs(data_dbs);
  await delete_synced_dbs(metadata_dbs);
  await delete_synced_dbs(projects_dbs);
  await delete_synced_db('directory', directory_db);
  for (const db of local_only_dbs_to_wipe) {
    try {
      console.debug(await db.destroy());
    } catch (err) {
      logError(err);
    }
  }
  // TODO: work out how best to recreate the databases, currently using a
  // redirect and having FAIMS reinitialise seems to be the best
  console.debug('Deleted dbs');
}

/**
 * Sets the remote sync connection jwt_token property for all activated projects
 * data DBs to a new token as specified.
 *
 * NOTE uses the ensure_synced_db method which will check for a diff in the
 * connection info, prompting recreation of the remote db
 *
 * TODO this could be more specific to the username + listing combination once
 * the data dbs are tracked to logged in users that activated them
 *
 * @param serverId Listing/server to target for a token refresh
 * @param newToken The new token to set as the connection info for the remote db
 * sync
 */
export async function refreshDataDbTokens({
  serverId,
  newToken,
}: {
  serverId: string;
  newToken: string;
}) {
  const activeRecords = (await active_db.allDocs({include_docs: true})).rows
    .map(d => d.doc)
    .filter(d => !!d);

  for (const record of activeRecords) {
    // This is server/project combinations
    const {listing_id} = record;

    // Only consider this server's DBs
    if (listing_id !== serverId) {
      continue;
    }

    // This is the database ID
    const dbKey = record._id;

    // Get the associated data DB for this active db
    const db = data_dbs[dbKey];

    if (!db.remote) {
      console.error(
        "Couldn't get remote for db with key ",
        dbKey,
        'More details about the DB that was found',
        db
      );
      continue;
    }

    // Take existing remote DB connection info, replace token with new token
    const newConnectionInfo: ConnectionInfo = {
      ...db.remote?.info,
      jwt_token: newToken,
    };

    // run the synced db operation which will update the token
    createUpdateAndSavePouchSync({
      localDbId: dbKey,
      connectionInfo: newConnectionInfo,
      globalDbs: data_dbs,
    });
  }
}
