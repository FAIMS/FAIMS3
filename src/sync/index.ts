import EventEmitter from 'events';
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

export type ExistingActiveDoc = PouchDB.Core.ExistingDocument<DataModel.ActiveDoc>;
export type ExistingListings = PouchDB.Core.ExistingDocument<DataModel.ListingsObject>;

/**
 * Directory: All (public, anyways) Faims instances
 */
export const directory_db = new PouchDB<DataModel.ListingsObject>('directory');

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
export const data_dbs: LocalDBList<DataModel.EncodedObservation> = {};

/**
 * Synced from the project metadatabase for each active project,
 * This has the metadata describing a database. Project Schemas,
 * GUI Models, and a Prople database.
 */
export const metadata_dbs: LocalDBList<DataModel.ProjectMetaObject> = {};

export let is_dbs_created = false;
/**
 * Keyed by active_id, this specifies which of the active
 * projects have their data synced currently (or are offline)
 */
export const data_db_created: {[key: string]: boolean} = {};
/**
 * Keyed by active_id, this specifies which of the active
 * projects have their metadata synced currently (or are offline)
 */
export const meta_db_created: {[key: string]: boolean} = {};

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
  const test_doc1: {
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
  const test_doc2: {
    _rev?: string;
    _id: string;
    listing_id: string;
    project_id: string;
    username: string;
    password: string;
  } = {
    _id: 'csiro/csiro-geochemistry',
    listing_id: 'csiro',
    project_id: 'csiro-geochemistry',
    username: 'test1',
    password: 'apple',
  };

  try {
    const current_test_doc = await active_db.get(test_doc1._id);
    test_doc1._rev = current_test_doc._rev;
  } catch (err) {
    // Not in the DB means _rev is unnecessary for put()
  }
  await active_db.put(test_doc1);
  try {
    const current_test_doc = await active_db.get(test_doc2._id);
    test_doc2._rev = current_test_doc._rev;
  } catch (err) {
    // Not in the DB means _rev is unnecessary for put()
  }
  await active_db.put(test_doc2);
}

interface DirectoryEmitter extends EventEmitter {
  on(
    event: 'project_meta_complete',
    listener: (
      listing: DataModel.ListingsObject,
      project: DataModel.ProjectObject,
      active: ExistingActiveDoc,
      meta: LocalDB<DataModel.ProjectMetaObject>
    ) => unknown
  ): this;
  on(
    event: 'project_data_complete',
    listener: (
      listing: DataModel.ListingsObject,
      project: DataModel.ProjectObject,
      active: ExistingActiveDoc,
      data: LocalDB<DataModel.EncodedObservation>
    ) => unknown
  ): this;
  on(
    event: 'project_complete',
    listener: (
      listing: DataModel.ListingsObject,
      project: DataModel.ProjectObject,
      active: ExistingActiveDoc,
      meta: LocalDB<DataModel.ProjectMetaObject>,
      data: LocalDB<DataModel.EncodedObservation>
    ) => unknown
  ): this;
  on(
    event: 'project_processing',
    listener: (
      listing: DataModel.ListingsObject,
      project: DataModel.ProjectObject,
      active: ExistingActiveDoc,
      meta: LocalDB<DataModel.ProjectMetaObject>,
      data: LocalDB<DataModel.EncodedObservation>
    ) => unknown
  ): this;
  on(
    event: 'project_error',
    listener: (listing: DataModel.ListingsObject, err: unknown) => unknown
  ): this;
  on(
    event: 'listing_complete',
    listener: (
      listing: DataModel.ListingsObject,
      active_projects: ExistingActiveDoc[]
    ) => unknown
  ): this;
  on(
    event: 'listing_processing',
    listener: (listing: DataModel.ListingsObject) => unknown
  ): this;
  on(
    event: 'listing_dbs_created',
    listener: (
      listing: DataModel.ListingsObject,
      active_projects: ExistingActiveDoc[]
    ) => unknown
  ): this;
  on(event: 'listing_error', listener: (err: unknown) => unknown): this;
  on(
    event: 'complete',
    listener: (listings: ExistingListings[]) => unknown
  ): this;
  on(event: 'processing', listener: () => unknown): this;
  on(
    event: 'dbs_created',
    listener: (listings: ExistingListings[]) => unknown
  ): this;
  on(event: 'error', listener: (err: unknown) => unknown): this;

  emit(
    event: 'project_meta_complete',
    listing: DataModel.ListingsObject,
    project: DataModel.ProjectObject,
    active: ExistingActiveDoc,
    meta: LocalDB<DataModel.ProjectMetaObject>
  ): boolean;
  emit(
    event: 'project_data_complete',
    listing: DataModel.ListingsObject,
    project: DataModel.ProjectObject,
    active: ExistingActiveDoc,
    data: LocalDB<DataModel.EncodedObservation>
  ): boolean;
  emit(
    event: 'project_complete',
    listing: DataModel.ListingsObject,
    project: DataModel.ProjectObject,
    active: ExistingActiveDoc,
    meta: LocalDB<DataModel.ProjectMetaObject>,
    data: LocalDB<DataModel.EncodedObservation>
  ): boolean;
  emit(
    event: 'project_processing',
    listing: DataModel.ListingsObject,
    project: DataModel.ProjectObject,
    active: ExistingActiveDoc,
    meta: LocalDB<DataModel.ProjectMetaObject>,
    data: LocalDB<DataModel.EncodedObservation>
  ): boolean;
  emit(
    event: 'project_error',
    listing: DataModel.ListingsObject,
    err: unknown
  ): boolean;
  emit(
    event: 'listing_complete',
    listing: DataModel.ListingsObject,
    active_projects: ExistingActiveDoc[]
  ): boolean;
  emit(event: 'listing_processing', listing: DataModel.ListingsObject): boolean;
  emit(
    event: 'listing_dbs_created',
    listing: DataModel.ListingsObject,
    active_projects: ExistingActiveDoc[]
  ): boolean;
  emit(event: 'listing_error', err: unknown): boolean;
  emit(event: 'complete', listings: ExistingListings[]): boolean;
  emit(event: 'processing'): boolean;
  emit(event: 'dbs_created', listings: ExistingListings[]): boolean;
  emit(event: 'error', err: unknown): boolean;
}

export const initializeEvents: DirectoryEmitter = new EventEmitter();

export function initialize_dbs(directory_connection: DataModel.ConnectionInfo) {
  initializeEvents.once('dbs_created', () => {
    is_dbs_created = true;
  });
  process_directory(directory_connection).catch(err =>
    initializeEvents.emit('error', err)
  );
  return initializeEvents;
}

async function process_directory(
  directory_connection_info: DataModel.ConnectionInfo
) {
  const emitter = initializeEvents;

  const directory_remote = ConnectionInfo_create_pouch<DataModel.ListingsObject>(
    directory_connection_info
  );

  const directory_connection = PouchDB.replicate(
    directory_remote,
    directory_db,
    {
      live: false,
      retry: false,
    }
  );

  const synced_callback = () => {
    directory_db.allDocs({include_docs: true}).then(all_listings =>
      process_listings(
        emitter,
        all_listings.rows
          .map(d => d.doc!)
          .filter(d => !d._id.startsWith('_design/'))
      )
    );
  };

  directory_connection.on('paused', synced_callback);
  directory_connection.on('error', synced_callback);
  synced_callback();

  emitter.emit('processing');
}

function process_listings(
  emitter: DirectoryEmitter,
  listing_objects: ExistingListings[]
) {
  let incompleteness = listing_objects.length;
  const complete_one = () => {
    if ((incompleteness -= 1) === 0) {
      emitter.emit('complete', listing_objects);
    }
  };

  emitter.on('listing_complete', complete_one);

  let undbs_created = listing_objects.length;
  const dbs_created_one = () => {
    if ((undbs_created -= 1) === 0) {
      emitter.emit('dbs_created', listing_objects);
    }
  };

  // Only once the listing has dbs_created all its own projects
  // this is different that process_projects,
  // on(listing_dbs_created) instead of _processing
  emitter.on('listing_dbs_created', dbs_created_one);

  listing_objects.forEach(ap => {
    const contextualizingEmitter: ListingEmitter = contextualizeEvents(
      emitter,
      [
        ['project_complete', 'project_complete'],
        ['project_processing', 'project_processing'],
        ['project_data_complete', 'project_data_complete'],
        ['project_meta_complete', 'project_meta_complete'],
        ['project_error', 'project_error'],

        ['listing_complete', 'complete'],
        ['listing_dbs_created', 'dbs_created'],
        ['listing_processing', 'processing'],
        ['listing_error', 'error'],
      ]
    );

    process_listing(contextualizingEmitter, ap).catch(err =>
      contextualizingEmitter.emit('error', err)
    );
  });
  return emitter;
}

interface ListingEmitter extends EventEmitter {
  on(
    event: 'project_meta_complete',
    listener: (
      listing: DataModel.ListingsObject,
      project: DataModel.ProjectObject,
      active: ExistingActiveDoc,
      meta: LocalDB<DataModel.ProjectMetaObject>
    ) => unknown
  ): this;
  on(
    event: 'project_data_complete',
    listener: (
      listing: DataModel.ListingsObject,
      project: DataModel.ProjectObject,
      active: ExistingActiveDoc,
      data: LocalDB<DataModel.EncodedObservation>
    ) => unknown
  ): this;
  on(
    event: 'project_complete',
    listener: (
      listing: DataModel.ListingsObject,
      project: DataModel.ProjectObject,
      active: ExistingActiveDoc,
      meta: LocalDB<DataModel.ProjectMetaObject>,
      data: LocalDB<DataModel.EncodedObservation>
    ) => unknown
  ): this;
  on(
    event: 'project_processing',
    listener: (
      listing: DataModel.ListingsObject,
      project: DataModel.ProjectObject,
      active: ExistingActiveDoc,
      meta: LocalDB<DataModel.ProjectMetaObject>,
      data: LocalDB<DataModel.EncodedObservation>
    ) => unknown
  ): this;
  on(
    event: 'project_error',
    listener: (listing: DataModel.ListingsObject, err: unknown) => unknown
  ): this;
  on(
    event: 'complete',
    listener: (
      listing: DataModel.ListingsObject,
      active_projects: ExistingActiveDoc[]
    ) => unknown
  ): this;
  on(
    event: 'processing',
    listener: (listing: DataModel.ListingsObject) => unknown
  ): this;
  on(
    event: 'dbs_created',
    listener: (
      listing: DataModel.ListingsObject,
      active_projects: ExistingActiveDoc[]
    ) => unknown
  ): this;
  on(event: 'error', listener: (err: unknown) => unknown): this;

  emit(
    event: 'project_meta_complete',
    listing: DataModel.ListingsObject,
    project: DataModel.ProjectObject,
    active: ExistingActiveDoc,
    meta: LocalDB<DataModel.ProjectMetaObject>
  ): boolean;
  emit(
    event: 'project_data_complete',
    listing: DataModel.ListingsObject,
    project: DataModel.ProjectObject,
    active: ExistingActiveDoc,
    data: LocalDB<DataModel.EncodedObservation>
  ): boolean;
  emit(
    event: 'project_complete',
    listing: DataModel.ListingsObject,
    project: DataModel.ProjectObject,
    active: ExistingActiveDoc,
    meta: LocalDB<DataModel.ProjectMetaObject>,
    data: LocalDB<DataModel.EncodedObservation>
  ): boolean;
  emit(
    event: 'project_processing',
    listing: DataModel.ListingsObject,
    project: DataModel.ProjectObject,
    active: ExistingActiveDoc,
    meta: LocalDB<DataModel.ProjectMetaObject>,
    data: LocalDB<DataModel.EncodedObservation>
  ): boolean;
  emit(
    event: 'project_error',
    listing: DataModel.ListingsObject,
    err: unknown
  ): boolean;
  emit(
    event: 'complete',
    listing: DataModel.ListingsObject,
    active_projects: ExistingActiveDoc[]
  ): boolean;
  emit(event: 'processing', listing: DataModel.ListingsObject): boolean;
  emit(
    event: 'dbs_created',
    listing: DataModel.ListingsObject,
    active_projects: ExistingActiveDoc[]
  ): boolean;
  emit(event: 'error', err: unknown): boolean;
}

async function process_listing(
  emitter: ListingEmitter,
  listing_object: ExistingListings
) {
  // Connect to people db and projects db for this listing db

  const projects_db_id = listing_object['projects_db']
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
    projects_db_id,
    projects_connection,
    projects_dbs,
    // Filters to only projects that are active
    {doc_ids: active_projects.map(v => v.project_id)}
  );

  const synced_callback = () => {
    process_projects(emitter, listing_object, active_projects);
  };
  projects_db.connection.on('paused', synced_callback);
  projects_db.connection.on('error', synced_callback);
  synced_callback();

  emitter.emit('processing', listing_object);
}

function contextualizeEvents(
  emit_to: EventEmitter,
  mappings: [string, string][],
  ...context: unknown[]
): EventEmitter {
  const event_from = new EventEmitter();

  mappings.forEach(([new_name, contextless_name]) =>
    event_from.on(contextless_name, (...orig_args: unknown[]) => {
      // Emit new_name with the new arguments THEN the old arguments
      emit_to.emit(new_name, ...context, ...orig_args);
    })
  );

  return event_from;
}

function process_projects(
  emitter: ListingEmitter,
  listing: DataModel.ListingsObject,
  active_projects: ExistingActiveDoc[]
) {
  let incompleteness = active_projects.length;
  const complete_one = () => {
    if ((incompleteness -= 1) === 0) {
      emitter.emit('complete', listing, active_projects);
    }
  };

  emitter.on('project_complete', complete_one);

  let undbs_created = active_projects.length;
  const dbs_created_one = () => {
    if ((undbs_created -= 1) === 0) {
      emitter.emit('dbs_created', listing, active_projects);
    }
  };

  emitter.on('project_processing', dbs_created_one);

  active_projects.forEach(ap => {
    const contextualizingEmitter: ProjectEmitter = contextualizeEvents(
      emitter,
      [
        ['project_complete', 'complete'],
        ['project_processing', 'processing'],
        ['project_data_complete', 'data_complete'],
        ['project_meta_complete', 'meta_complete'],
        ['project_error', 'error'],
      ],
      listing
    );

    process_project(contextualizingEmitter, ap).catch(err =>
      contextualizingEmitter.emit('error', err)
    );
  });
}

interface ProjectEmitter extends EventEmitter {
  on(
    event: 'meta_complete',
    listener: (
      project: DataModel.ProjectObject,
      active: ExistingActiveDoc,
      meta: LocalDB<DataModel.ProjectMetaObject>
    ) => unknown
  ): this;
  on(
    event: 'data_complete',
    listener: (
      project: DataModel.ProjectObject,
      active: ExistingActiveDoc,
      data: LocalDB<DataModel.EncodedObservation>
    ) => unknown
  ): this;
  on(
    event: 'complete',
    listener: (
      project: DataModel.ProjectObject,
      active: ExistingActiveDoc,
      meta: LocalDB<DataModel.ProjectMetaObject>,
      data: LocalDB<DataModel.EncodedObservation>
    ) => unknown
  ): this;
  on(
    event: 'processing',
    listener: (
      project: DataModel.ProjectObject,
      active: ExistingActiveDoc,
      meta: LocalDB<DataModel.ProjectMetaObject>,
      data: LocalDB<DataModel.EncodedObservation>
    ) => unknown
  ): this;
  on(event: 'error', listener: (err: unknown) => unknown): this;

  emit(
    event: 'meta_complete',
    project: DataModel.ProjectObject,
    active: ExistingActiveDoc,
    meta: LocalDB<DataModel.ProjectMetaObject>
  ): boolean;
  emit(
    event: 'data_complete',
    project: DataModel.ProjectObject,
    active: ExistingActiveDoc,
    data: LocalDB<DataModel.EncodedObservation>
  ): boolean;
  emit(
    event: 'complete',
    project: DataModel.ProjectObject,
    active: ExistingActiveDoc,
    meta: LocalDB<DataModel.ProjectMetaObject>,
    data: LocalDB<DataModel.EncodedObservation>
  ): boolean;
  emit(
    event: 'processing',
    project: DataModel.ProjectObject,
    active: ExistingActiveDoc,
    meta: LocalDB<DataModel.ProjectMetaObject>,
    data: LocalDB<DataModel.EncodedObservation>
  ): boolean;
  emit(event: 'error', err: unknown): boolean;
}

async function process_project(
  emitter: ProjectEmitter,
  active_project: PouchDB.Core.ExistingDocument<DataModel.ActiveDoc>
): Promise<void> {
  const active_id = active_project._id;
  const listing_id = active_project.listing_id;
  const project_id = active_project.project_id;

  const projects_db = projects_dbs[listing_id];
  const projects_connection = projects_db.connection_info;

  const project_info: DataModel.ProjectObject = await projects_db.local.get(
    project_id
  );

  // Defaults to the same couch as the projects db, but different database name:
  const meta_connection_info = project_info.metadata_db || {
    ...projects_connection,
    db_name: METADATA_DBNAME_PREFIX + project_info._id,
  };

  const data_connection_info = project_info.data_db || {
    ...projects_connection,
    db_name: DATA_DBNAME_PREFIX + project_info._id,
  };

  const meta_db = ensure_instance_db_is_local_and_synced(
    'metadata',
    active_id,
    meta_connection_info,
    metadata_dbs
  );

  const data_db = ensure_instance_db_is_local_and_synced(
    'data',
    active_id,
    data_connection_info,
    data_dbs
  );

  function synced_callback<T>(
    evt_name: 'meta_complete' | 'data_complete',
    complete_marker: {[key: string]: boolean},
    db: LocalDB<T>
  ) {
    return () => {
      complete_marker[active_id] = true;
      (emitter.emit as (
        evt: string,
        project: DataModel.ProjectObject,
        active: ExistingActiveDoc,
        arg: LocalDB<T>
      ) => boolean)(evt_name, project_info, active_project, db);
    };
  }

  meta_db.connection.on(
    'paused',
    synced_callback('meta_complete', meta_db_created, meta_db)
  );
  meta_db.connection.on(
    'error',
    synced_callback('meta_complete', meta_db_created, meta_db)
  );

  data_db.connection.on(
    'paused',
    synced_callback('data_complete', data_db_created, data_db)
  );
  data_db.connection.on(
    'error',
    synced_callback('data_complete', data_db_created, data_db)
  );

  let incompleteness = 2;
  function complete_one() {
    if ((incompleteness -= 1) === 0) {
      emitter.emit('complete', project_info, active_project, meta_db, data_db);
    }
  }

  emitter.on('meta_complete', complete_one);
  emitter.on('data_complete', complete_one);

  emitter.emit('processing', project_info, active_project, meta_db, data_db);
}

export function getDataDB(
  active_id: string
): PouchDB.Database<DataModel.EncodedObservation> {
  if (data_db_created[active_id]) {
    return data_dbs[active_id].local;
  } else {
    throw 'Projects not initialized yet';
  }
}

export function getProjectDB(
  active_id: string
): PouchDB.Database<DataModel.ProjectMetaObject> {
  if (meta_db_created[active_id]) {
    return metadata_dbs[active_id].local;
  } else {
    throw 'Projects not initialized yet';
  }
}
