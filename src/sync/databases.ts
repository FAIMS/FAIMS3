import {
  DIRECTORY_PROTOCOL,
  DIRECTORY_HOST,
  DIRECTORY_PORT,
} from '../buildconfig';
import {
  ActiveDoc,
  ConnectionInfo,
  EncodedObservation,
  ListingsObject,
  NonNullListingsObject,
  PeopleDoc,
  ProjectMetaObject,
  ProjectObject,
} from '../datamodel';
import {
  ConnectionInfo_create_pouch,
  local_pouch_options,
  materializeConnectionInfo,
} from './connection';

export const DEFAULT_LISTING_ID = 'default';
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
    | PouchDB.Replication.Sync<Content>;
  info: ConnectionInfo;
}

export interface LocalDBList<Content extends {}> {
  [key: string]: LocalDB<Content>;
}

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
 *   * username, password: A device login (mostly the same across all docs in this db, except for differences in people_db of the instance),
 */
export const active_db = new PouchDB<ActiveDoc>('active', local_pouch_options);

/**
 * Each listing has a Projects database and Users/People DBs
 */
export const projects_dbs: LocalDBList<ProjectObject> = {};

/**
 * mapping from listing id to a PouchDB CLIENTSIDE DB
 */
export const people_dbs: LocalDBList<PeopleDoc> = {};

/**
 * Per-[active]-project project data:
 * Contain in these databases (indexed by the active_db id's)
 * is project data.
 */
export const data_dbs: LocalDBList<EncodedObservation> = {};

/**
 * Synced from the project metadatabase for each active project,
 * This has the metadata describing a database. Project Schemas,
 * GUI Models, and a Prople database.
 */
export const metadata_dbs: LocalDBList<ProjectMetaObject> = {};

let default_instance: null | NonNullListingsObject = null; //Set to directory_db.get(DEFAULT_LISTING_ID) by get_default_instance

export async function get_default_instance(): Promise<NonNullListingsObject> {
  if (default_instance === null) {
    const possibly_corrupted_instance = await directory_db.local.get(
      DEFAULT_LISTING_ID
    );
    default_instance = {
      _id: possibly_corrupted_instance._id,
      name: possibly_corrupted_instance.name,
      description: possibly_corrupted_instance.description,
      projects_db: materializeConnectionInfo(
        directory_connection_info,
        possibly_corrupted_instance.projects_db
      ),
      people_db: materializeConnectionInfo(
        directory_connection_info,
        possibly_corrupted_instance.people_db
      ),
    };
  }
  return default_instance;
}

/**
 * @param prefix Name to use to run new PouchDB(prefix + POUCH_SEPARATOR + id), objects of the same type have the same prefix
 * @param local_db_id id is per-object of type, to discriminate between them. i.e. a project ID
 * @param global_dbs projects_db or people_db
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
 * @param global_dbs projects_db or people_db
 * @param connection_info Info to use to connect to remote
 * @param options PouchDB options. Defaults to live: true, retry: true.
 *                if options.sync is defined, then this turns into ensuring the DB
 *                is pushing to the remote as well as pulling.
 * @returns Flag if newly created =true, already existing=false & The local DB & remote
 */
export function ensure_synced_db<Content extends {}>(
  local_db_id: string,
  connection_info: ConnectionInfo,
  global_dbs: LocalDBList<Content>,
  options:
    | PouchDB.Replication.ReplicateOptions
    | {
        pull?: PouchDB.Replication.ReplicateOptions;
        push: PouchDB.Replication.ReplicateOptions;
      } = {}
): [boolean, LocalDB<Content> & {remote: LocalDBRemote<Content>}] {
  if (global_dbs[local_db_id] === undefined) {
    throw 'Logic eror: ensure_local_db must be called before this code';
  }

  // Already connected/connecting
  if (
    global_dbs[local_db_id].remote !== null &&
    JSON.stringify(global_dbs[local_db_id].remote!.info) ===
      JSON.stringify(connection_info)
  ) {
    return [
      false,
      {
        ...global_dbs[local_db_id],
        remote: global_dbs[local_db_id].remote!,
      },
    ];
  }
  const local = global_dbs[local_db_id].local;

  const remote: PouchDB.Database<Content> = ConnectionInfo_create_pouch(
    connection_info
  );

  const push_too = (options as {push?: unknown}).push !== undefined;

  let connection:
    | PouchDB.Replication.Replication<Content>
    | PouchDB.Replication.Sync<Content>;

  if (push_too) {
    const options_sync = options as PouchDB.Replication.SyncOptions;
    connection = PouchDB.sync(remote, local, {
      push: {live: true, retry: true, ...options_sync.push},
      pull: {live: true, retry: true, ...(options_sync.pull || {})},
    });
  } else {
    connection = PouchDB.replicate(remote, local, {
      live: true,
      retry: true,
      ...options,
    });
  }

  return [
    true,
    (global_dbs[local_db_id] = {
      ...global_dbs[local_db_id],
      remote: {
        db: remote,
        connection: connection,
        info: connection_info,
      },
    }),
  ];
}
