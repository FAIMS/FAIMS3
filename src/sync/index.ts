import EventEmitter from 'node:events';
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import * as DataModel from '../datamodel';

const DEFAULT_LISTING_ID = 'default';
const METADATA_DBNAME_PREFIX = 'metadata-';
const DATA_DBNAME_PREFIX = 'data-';

export interface LocalDB<Content extends {}> {
  local: PouchDB.Database<Content>;
  remote: PouchDB.Database<Content>;

  is_sync: boolean;
  connection:
    | PouchDB.Replication.Replication<Content>
    | PouchDB.Replication.Sync<Content>;
  connection_info: DataModel.ConnectionInfo;
}

export interface LocalDBList<Content extends {}> {
  [key: string]: LocalDB<Content>;
}

/**
 * Directory: All (public, anyways) Faims instances
 */
export const directory_db = new PouchDB<DataModel.ListingsObject>('directory');
export let directory_ready = false;

let default_instance: null | DataModel.NonNullListingsObject = null; //Set to directory_db.get(DEFAULT_LISTING_ID) by get_default_instance

/**
 * Active: A local (NOT synced) list of:
 *   {_id, username, password, project_id, listing_id}
 *   For each project the current device is part of (so this is keyed by listing id + project id),
 *   * listing_id: A couchdb instance object's id (from "directory" db)
 *   * project_id: A project id (from the project_db in the couchdb instance object.)
 *   * username, password: A device login (mostly the same across all docs in this db, except for differences in people_db of the instance),
 */
export const active_db = new PouchDB<DataModel.ActiveDoc>('active');

/**
 * Each listing has a Projects database and Users/People DBs
 */
export const projects_dbs: LocalDBList<DataModel.ProjectObject> = {};

/**
 * mapping from listing id to a PouchDB CLIENTSIDE DB
 */
export const people_dbs: LocalDBList<DataModel.PeopleDoc> = {};

/**
 * Per-[active]-project project data:
 * Contain in these databases (indexed by the active_db id's)
 * is project data.
 */
export const data_dbs: LocalDBList<DataModel.Datum> = {};

/**
 * Synced from the project metadatabase for each active project,
 * This has the metadata describing a database. Project Schemas,
 * GUI Models, and a Prople database.
 */
export const metadata_dbs: LocalDBList<DataModel.ProjectMetaObject> = {};

/**
 * Creates a local PouchDB.Database used to access a remote Couch/Pouch instance
 * @param connection_info Network address/database info to use to initialize the connection
 * @returns A new PouchDB.Database, interfacing to the remote Couch/Pouch instance
 */
function ConnectionInfo_create_pouch<Content extends {}>(
  connection_info: DataModel.ConnectionInfo
): PouchDB.Database<Content> {
  return new PouchDB(
    encodeURIComponent(connection_info.proto) +
      '://' +
      encodeURIComponent(connection_info.host) +
      ':' +
      encodeURIComponent(connection_info.port) +
      '/' +
      encodeURIComponent(connection_info.db_name)
  );
}

/**
 *
 * @param prefix Name to use to run new PouchDB(prefix + '/' + id)
 * @param instance_info An instance object, i.e. a doc from the directory db
 * @param instance_member_name 'projects_db' or 'people_db'
 * @param global_client_dbs projects_db or people_db
 * @param global_server_dbs remote_projects_db or remote_people_db
 * @returns The local DB
 */
function ensure_instance_db_is_local_and_synced<Content extends {}>(
  prefix: string,
  local_db_id: string,
  connection_info: DataModel.ConnectionInfo,
  global_dbs: LocalDBList<Content>,
  options?: PouchDB.Replication.ReplicateOptions
): LocalDB<Content> {
  // Already connected/loaded local DB
  if (global_dbs[local_db_id]) {
    return global_dbs[local_db_id];
  }

  // The first part of this function, to get the local DB
  // Creates the prefix/escaped_name using the local_db_id
  // then uses said name on a new PouchDB(name) to load the database.

  // Load any existing data from the client
  const local: PouchDB.Database<Content> = new PouchDB(
    prefix + '/' + local_db_id
  );

  const remote: PouchDB.Database<Content> = ConnectionInfo_create_pouch(
    connection_info
  );

  const connection: PouchDB.Replication.Replication<Content> = /* ASYNC UNAWAITED */ PouchDB.replicate(
    remote,
    local,
    {
      live: true,
      retry: false,
      // TODO: Re-fresh database when options are different
      ...options, //live & retry can be overwritten
    }
  );

  return (global_dbs[local_db_id] = {
    local: local,
    remote: remote,
    is_sync: false,
    connection: connection,
    connection_info: connection_info,
  });
}

async function get_default_instance(): Promise<DataModel.NonNullListingsObject> {
  if (default_instance === null) {
    const possibly_corrupted_instance = await directory_db.get(
      DEFAULT_LISTING_ID
    );
    default_instance = {
      _id: possibly_corrupted_instance._id,
      name: possibly_corrupted_instance.name,
      description: possibly_corrupted_instance.description,
      projects_db: possibly_corrupted_instance.projects_db!,
      people_db: possibly_corrupted_instance.people_db!,
    };
  }
  return default_instance;
}

PouchDB.plugin(PouchDBFind);

/**
 * Creates & Populates the active_projects database.
 *
 * Call before initialize_db
 */
export async function populate_test_data() {
  const test_doc: {
    _rev?: string;
    _id: string;
    listing_id: string;
    project_id: string;
    username: string;
    password: string;
  } = {
    _id: 'default/lake_mungo',
    listing_id: 'default',
    project_id: 'lake_mungo',
    username: 'test1',
    password: 'apple',
  };

  try {
    const current_test_doc = await active_db.get('default/lake_mungo');
    test_doc._rev = current_test_doc._rev;
  } catch (err) {
    // Not in the DB means _rev is unnecessary for put()
  }
  await active_db.put(test_doc);
}

/**
 * WARNING: All these may trigger more than once
 * When the user goes online and completes a sync,
 * or when the user goes offline before sync completes.
 */
export interface InitializationEvents extends EventEmitter {
  on(
    event: 'directory_ready',
    listener: (
      rows: Array<{
        // Defined as a subset of PouchDB.AllDocsResponse<ListingsObject>
        // (doc being non-null, without AllDocsMeta)
        doc: PouchDB.Core.ExistingDocument<DataModel.ListingsObject>;
        id: PouchDB.Core.DocumentId;
        key: PouchDB.Core.DocumentKey;
        value: {
          rev: PouchDB.Core.RevisionId;
          deleted?: boolean;
        };
      }>
    ) => unknown
  ): this;
  // Listing ready is activated for each listing
  // just before their individual projects are iterated over.
  // Said listing's projects db & people_db are already
  // initialized and, the first handler of this event
  // starts synchronizing them
  on(
    event: 'listing_ready',
    listener: (
      listing_object: PouchDB.Core.ExistingDocument<DataModel.ListingsObject>,
      active_in_listing: PouchDB.Core.ExistingDocument<DataModel.ActiveDoc>[]
    ) => unknown
  ): this;
  // combined_id is used to index data_dbs, metadata_dbs by js key, and active_dbs by _id
  on(
    event: 'project_object_ready',
    listener: (
      combined_id: string,
      listing_id: string,
      project_id: DataModel.ProjectObject
    ) => unknown
  ): this;
  on(
    event: 'project_data_ready',
    listener: (
      combined_id: string,
      listing_id: string,
      project_id: string
    ) => unknown
  ): this;
  on(
    event: 'project_meta_ready',
    listener: (
      combined_id: string,
      listing_id: string,
      project_id: string
    ) => unknown
  ): this;
  /*
      The following 'complete' listeners only trigger when they have
      completed everything below them. That means a project_complete
      only triggers when it's data and metadata are synced (lowest level)
      then a listings only triggers when all it's projects are complete
  */
  on(event: 'directory_complete', listener: () => unknown): this;
  on(
    event: 'listing_complete',
    listener: (listing_id: string) => unknown
  ): this;

  on(
    event: 'project_complete',
    listener: (
      combined_id: string,
      listing_id: string,
      project_id: string
    ) => unknown
  ): this;

  // Errors: Not to be confused with offline mode.

  // When a whole listing isn't able to sync
  on(event: 'directory_error', listener: (err: unknown) => unknown): this;
  on(
    event: 'listing_error',
    listener: (listing_id: string, err: unknown) => unknown
  ): this;
  on(
    event: 'project_error',
    listener: (
      combined_id: string,
      listing_id: string,
      project_id: string,
      err: unknown
    ) => unknown
  ): this;
}

export const initializationEvents: InitializationEvents = new EventEmitter();

export async function initialize_dbs(
  directory_connection: DataModel.ConnectionInfo
) {
  try {
    const directory_remote = ConnectionInfo_create_pouch<DataModel.ListingsObject>(
      directory_connection
    );

    // Next phase of initialization: For each listings object,
    // activate projects in said listing
    // (Careful to errors for individual listings here)
    initializationEvents.on('directory_ready', rows =>
      rows.forEach(listing => {
        if (!listing.id.startsWith('_design/')) {
          activate_projects_for_listing(listing.doc!).catch(err =>
            initializationEvents.emit('listing_error', listing.id, err)
          );
        }
      })
    );

    /* ASYNC UNAWAITED */
    PouchDB.replicate(directory_remote, directory_db, {
      live: false,
      retry: false,
    }).on('paused', (/*info*/) => {
      directory_db
        .allDocs({
          include_docs: true,
        })
        .then(all_listings => {
          directory_ready = true;
          initializationEvents.emit('directory_ready', all_listings.rows);
        });
    });
  } catch (error) {
    console.error(`Could not connect to directory server to sync: ${error}`);
    throw error;
  }
}

async function activate_projects_for_listing(
  listing_object: PouchDB.Core.ExistingDocument<DataModel.ListingsObject>
) {
  // Connect to people db and projects db for this listing db

  const projects_local_id = listing_object['projects_db']
    ? listing_object._id
    : DEFAULT_LISTING_ID;
  const projects_connection =
    listing_object['projects_db'] ||
    (await get_default_instance())['projects_db'];

  const people_local_id = listing_object['people_db']
    ? listing_object._id
    : DEFAULT_LISTING_ID;
  const people_connection =
    listing_object['people_db'] || (await get_default_instance())['people_db'];

  // Only sync active projects:
  const active_projects = (
    await active_db.find({selector: {listing_id: listing_object._id}})
  ).docs;

  // TODO: Ensure that when the user adds a new active project
  // that these filters are updated.
  ensure_instance_db_is_local_and_synced(
    'people',
    people_local_id,
    people_connection,
    people_dbs,
    // Filters to only projects that are active
    {doc_ids: active_projects.map(v => v.project_id)}
  );

  const projects_db = ensure_instance_db_is_local_and_synced(
    'projects',
    projects_local_id,
    projects_connection,
    projects_dbs,
    // Filters to only projects that are active
    {doc_ids: active_projects.map(v => v.project_id)}
  );

  let num_projects_incomplete = 0;

  const completion_handler = () =>
    // combined_id: string,
    // listing_id: string,
    // project_id: string
    {
      num_projects_incomplete -= 1;
      if (num_projects_incomplete === 0) {
        initializationEvents.emit('listing_complete', listing_object._id);
        initializationEvents.removeListener(
          'project_complete',
          completion_handler
        );
      }
    };

  initializationEvents.on('project_complete', completion_handler);

  projects_db.connection.on('paused', () => {
    active_db
      .find({selector: {listing_id: listing_object._id}})
      .then(find_response => {
        initializationEvents.emit(
          'listing_ready',
          listing_object,
          find_response.docs
        );
        num_projects_incomplete += find_response.docs.length;
        // Each project in the listing:
        find_response.docs.forEach(doc =>
          activate_individual_project(listing_object._id, doc).catch((/* err */) =>
            initializationEvents.emit(
              'project_error',
              doc._id,
              listing_object._id,
              doc.project_id
            )
          )
        );
      });
  });
}

async function activate_individual_project(
  listing_id: string,
  doc: PouchDB.Core.ExistingDocument<DataModel.ActiveDoc>
) {
  const projects_db = projects_dbs[listing_id];
  const projects_connection = projects_db.connection_info;

  const project_info: DataModel.ProjectObject = await projects_db.local.get(
    doc.project_id
  );
  console.info(`Connecting to ${doc.project_id} Data/MetaData DBs...`);

  const project_local_id = doc._id;
  // Defaults to the same couch as the projects db, but different database name:
  const meta_connection_info = project_info.metadata_db || {
    proto: projects_connection.proto,
    host: projects_connection.host,
    port: projects_connection.port,
    lan: projects_connection.lan,
    db_name: METADATA_DBNAME_PREFIX + project_info._id,
  };

  const data_connection_info = project_info.data_db || {
    proto: projects_connection.proto,
    host: projects_connection.host,
    port: projects_connection.port,
    lan: projects_connection.lan,
    db_name: DATA_DBNAME_PREFIX + project_info._id,
  };

  ensure_instance_db_is_local_and_synced(
    'metadata',
    project_local_id,
    meta_connection_info,
    metadata_dbs
  );

  ensure_instance_db_is_local_and_synced(
    'data',
    project_local_id,
    data_connection_info,
    data_dbs
  );

  let complete_emitted = false;
  let metadata_synced = false;
  let data_synced = false;

  // The initializationEvents needs to be notified whenever
  // a metadata db or a data db has been synced.
  //
  // Then the emit_complete can call project_complete when both are done
  // AND all previous event handlers for _ready have been called

  const emit_complete = function () {
    if (metadata_synced && data_synced && !complete_emitted) {
      complete_emitted = true;
      initializationEvents.emit(
        'project_complete',
        project_local_id,
        listing_id,
        project_info._id
      );
    }
  };

  metadata_dbs[project_local_id].connection.on('paused', () => {
    metadata_synced = true;
    initializationEvents.emit(
      'project_meta_ready',
      project_local_id,
      listing_id,
      project_info._id
    );
    emit_complete();
  });

  data_dbs[project_local_id].connection.on('paused', () => {
    data_synced = true;
    initializationEvents.emit(
      'project_data_ready',
      project_local_id,
      listing_id,
      project_info._id
    );
    emit_complete();
  });

  initializationEvents.emit(
    'project_object_ready',
    project_local_id,
    listing_id,
    project_info
  );
}

export async function active_projects() {
  return new Promise((/* resolve, reject */) => {});
}
