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
import PouchDBFind from 'pouchdb-find';
import PouchDBAdaptorMemory from 'pouchdb-adapter-memory';
import * as DataModel from '../datamodel';
import * as Events from 'events';
import {
  setupExampleListing,
  setupExampleDirectory,
  setupExampleActive,
  setupExampleProjectMetadata,
  setupExampleData,
} from '../dummyData';
import {
  USE_REAL_DATA,
  DIRECTORY_PROTOCOL,
  DIRECTORY_HOST,
  DIRECTORY_PORT,
  RUNNING_UNDER_TEST,
} from '../buildconfig';

const POUCH_SEPARATOR = '_';
const DEFAULT_LISTING_ID = 'default';
const METADATA_DBNAME_PREFIX = 'metadata-';
const DATA_DBNAME_PREFIX = 'data-';
const DIRECTORY_TIMEOUT = 1000;
const LISTINGS_TIMEOUT = 2000;
const PROJECT_TIMEOUT = 3000;

export interface LocalDB<Content extends {}> {
  local: PouchDB.Database<Content>;
  remote: null | LocalDBRemote<Content>;
}

export interface LocalDBRemote<Content extends {}> {
  db: PouchDB.Database<Content>;
  is_sync: boolean;
  connection:
    | PouchDB.Replication.Replication<Content>
    | PouchDB.Replication.Sync<Content>;
  info: DataModel.ConnectionInfo;
}

export interface LocalDBList<Content extends {}> {
  [key: string]: LocalDB<Content>;
}

export type ExistingActiveDoc = PouchDB.Core.ExistingDocument<DataModel.ActiveDoc>;
export type ExistingListings = PouchDB.Core.ExistingDocument<DataModel.ListingsObject>;

/**
 * Configure local pouchdb settings; note that this applies to *ALL* local
 * databases (remote ones are handled separately), so don't add db-specific
 * logic to this
 */

const local_pouch_options: any = {};
if (RUNNING_UNDER_TEST) {
  // enable memory adapter for testing
  console.error('Using memory store');
  PouchDB.plugin(PouchDBAdaptorMemory);
  local_pouch_options['adapter'] = 'memory';
}

/**
 * Directory: All (public, anyways) Faims instances
 */
export const directory_db: LocalDB<DataModel.ListingsObject> = {
  local: new PouchDB('directory', local_pouch_options),
  remote: null,
};

class EventEmitter extends Events.EventEmitter {
  constructor(opts?: {captureRejections?: boolean}) {
    super(opts);
  }
  emit(event: string | symbol, ...args: unknown[]): boolean {
    console.debug(event, args);
    return super.emit(event, ...args);
  }
}

let default_instance: null | DataModel.NonNullListingsObject = null; //Set to directory_db.get(DEFAULT_LISTING_ID) by get_default_instance

/**
 * Active: A local (NOT synced) list of:
 *   {_id, username, password, project_id, listing_id}
 *   For each project the current device is part of (so this is keyed by listing id + project id),
 *   * listing_id: A couchdb instance object's id (from "directory" db)
 *   * project_id: A project id (from the project_db in the couchdb instance object.)
 *   * username, password: A device login (mostly the same across all docs in this db, except for differences in people_db of the instance),
 */
export const active_db = new PouchDB<DataModel.ActiveDoc>(
  'active',
  local_pouch_options
);

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

export function materializeConnectionInfo(
  base_info: DataModel.ConnectionInfo,
  ...overlays: DataModel.PossibleConnectionInfo[]
): DataModel.ConnectionInfo {
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
function ConnectionInfo_create_pouch<Content extends {}>(
  connection_info: DataModel.ConnectionInfo,
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

/**
 * @param prefix Name to use to run new PouchDB(prefix + POUCH_SEPARATOR + id), objects of the same type have the same prefix
 * @param local_db_id id is per-object of type, to discriminate between them. i.e. a project ID
 * @param global_dbs projects_db or people_db
 * @returns Flag if newly created =true, already existing=false & The local DB
 */
function ensure_local_db<Content extends {}>(
  prefix: string,
  local_db_id: string,
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
function ensure_synced_db<Content extends {}>(
  local_db_id: string,
  connection_info: DataModel.ConnectionInfo,
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
      local: global_dbs[local_db_id].local,
      remote: {
        db: remote,
        is_sync: false,
        connection: connection,
        info: connection_info,
      },
    }),
  ];
}

async function get_default_instance(): Promise<DataModel.NonNullListingsObject> {
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

PouchDB.plugin(PouchDBFind);

/**
 * This is appended to whneever a listing has its
 * projects_db & people_db come into existance
 *
 * This is essentially accumulating 'listing_paused' events
 */
export const createdListings: {
  [key: string]: {
    listing: DataModel.ListingsObject;
    projects: ExistingActiveDoc[];
  };
} = {};

export function getDataDB(
  active_id: string
): PouchDB.Database<DataModel.EncodedObservation> {
  if (data_dbs[active_id] !== undefined) {
    return data_dbs[active_id].local;
  } else {
    console.warn(`Failed to look up ${active_id}`);
    throw 'Projects not initialized yet';
  }
}

export function getProjectDB(
  active_id: string
): PouchDB.Database<DataModel.ProjectMetaObject> {
  if (metadata_dbs[active_id] !== undefined) {
    return metadata_dbs[active_id].local;
  } else {
    console.warn(`Failed to look up ${active_id}`);
    throw 'Projects not initialized yet';
  }
}

export const initializeEvents: DirectoryEmitter = new EventEmitter();

interface EmissionsArg {
  active(): unknown;
  paused(err?: {}): unknown;
  error(err: {}): unknown;
}
class SyncHandler {
  lastActive?: ReturnType<typeof Date.now>;
  timeout: number;
  timeout_track?: ReturnType<typeof setTimeout>;
  emissions: EmissionsArg;

  constructor(timeout: number, emissions: EmissionsArg) {
    this.timeout = timeout;

    this.emissions = emissions;

    this.setTimeout().then(() => {
      // After 2 seconds of no initial activity,
      // Mark the data as stopped coming in
      this.emissions.paused();
    });
  }
  _inactiveCheckLoop() {
    if (this.lastActive! + this.timeout - 20 <= Date.now()) {
      // Timeout (minus wiggle room) (or more) has elapsed since being active
      this.lastActive = undefined;
      this.emissions.paused();
    } else {
      // Set a new timeout for the remaining time of the 2 seconds.
      this.setTimeout(this.lastActive! + this.timeout - Date.now()).then(
        this._inactiveCheckLoop.bind(this)
      );
    }
  }

  listen(
    db: PouchDB.Replication.ReplicationEventEmitter<{}, unknown, unknown>
  ) {
    db.on('paused', (err?: {}) => {
      /*
      This event fires when the replication is paused, either because a live
      replication is waiting for changes, or replication has temporarily
      failed, with err, and is attempting to resume.
      */
      this.lastActive = undefined;
      this.clearTimeout();
      this.emissions.paused(err);
    });
    db.on('change', () => {
      /*
      This event fires when the replication starts actively processing changes;
      e.g. when it recovers from an error or new changes are available.
      */

      if (
        this.lastActive !== undefined &&
        this.lastActive! + this.timeout - 20 <= Date.now()
      ) {
        console.warn(
          "someone didn't clear the lastActive when clearTimeout called"
        );
        this.lastActive = undefined;
      }

      if (this.lastActive === undefined) {
        this.lastActive = Date.now();
        this.clearTimeout();
        this.emissions.active();

        // After 2 seconds of no more 'active' events,
        // assume it's up to date
        // (Otherwise, if it's still active, keep checking until it's not)
        this.setTimeout().then(this._inactiveCheckLoop.bind(this));
      } else {
        this.lastActive = Date.now();
      }
    });
    db.on('error', err => {
      /*
      This event is fired when the replication is stopped due to an
      unrecoverable failure.
      */
      // Prevent any further events
      this.lastActive = undefined;
      this.clearTimeout();
      this.emissions.error(err);
    });
  }
  clearTimeout() {
    if (this.timeout_track !== undefined) {
      clearTimeout(this.timeout_track);
      this.timeout_track = undefined;
    }
  }
  setTimeout(time?: number): Promise<void> {
    return new Promise(resolve => {
      this.timeout_track = setTimeout(() => {
        resolve();
      }, time || this.timeout);
    });
  }
}

interface DirectoryEmitter extends EventEmitter {
  on(
    event: 'project_meta_paused',
    listener: (
      listing: DataModel.ListingsObject,
      active: ExistingActiveDoc,
      project: DataModel.ProjectObject,
      meta: LocalDB<DataModel.ProjectMetaObject>
    ) => unknown
  ): this;
  on(
    event: 'project_meta_active',
    listener: (
      listing: DataModel.ListingsObject,
      active: ExistingActiveDoc,
      project: DataModel.ProjectObject,
      meta: LocalDB<DataModel.ProjectMetaObject>
    ) => unknown
  ): this;
  on(
    event: 'project_data_active',
    listener: (
      listing: DataModel.ListingsObject,
      active: ExistingActiveDoc,
      project: DataModel.ProjectObject,
      data: LocalDB<DataModel.EncodedObservation>
    ) => unknown
  ): this;
  on(
    event: 'project_data_paused',
    listener: (
      listing: DataModel.ListingsObject,
      active: ExistingActiveDoc,
      project: DataModel.ProjectObject,
      data: LocalDB<DataModel.EncodedObservation>
    ) => unknown
  ): this;
  on(
    event: 'project_local',
    listener: (
      listing: DataModel.ListingsObject,
      active: ExistingActiveDoc,
      project: DataModel.ProjectObject,
      meta: LocalDB<DataModel.ProjectMetaObject>,
      data: LocalDB<DataModel.EncodedObservation>
    ) => unknown
  ): this;
  on(
    event: 'project_error',
    listener: (
      listing: DataModel.ListingsObject,
      active: ExistingActiveDoc,
      err: unknown
    ) => unknown
  ): this;
  on(
    event: 'listing_local',
    listener: (
      listing: DataModel.ListingsObject,
      projects: ExistingActiveDoc[],
      people_db: LocalDB<DataModel.PeopleDoc>,
      projects_db: LocalDB<DataModel.ProjectObject>,
      default_connection: DataModel.ConnectionInfo
    ) => unknown
  ): this;
  on(
    event: 'listing_paused',
    listener: (
      listing: DataModel.ListingsObject,
      projects: ExistingActiveDoc[],
      people_db: LocalDB<DataModel.PeopleDoc>,
      projects_db: LocalDB<DataModel.ProjectObject>,
      default_connection: DataModel.ConnectionInfo
    ) => unknown
  ): this;
  on(
    event: 'listing_active',
    listener: (
      listing: DataModel.ListingsObject,
      projects: ExistingActiveDoc[],
      people_db: LocalDB<DataModel.PeopleDoc>,
      projects_db: LocalDB<DataModel.ProjectObject>,
      default_connection: DataModel.ConnectionInfo
    ) => unknown
  ): this;
  on(
    event: 'listing_error',
    listener: (listing_id: string, err: unknown) => unknown
  ): this;
  on(
    event: 'directory_local',
    listener: (listings: Set<string>) => unknown
  ): this;
  on(
    event: 'directory_paused',
    listener: (listings: Set<string>) => unknown
  ): this;
  on(
    event: 'directory_active',
    listener: (listings: Set<string>) => unknown
  ): this;
  on(event: 'directory_error', listener: (err: unknown) => unknown): this;

  on(
    event: 'projects_known',
    listener: (projects: Set<string>) => unknown
  ): this;
  on(event: 'projects_created', listener: () => unknown): this;

  emit(
    event: 'project_meta_paused',
    listing: DataModel.ListingsObject,
    active: ExistingActiveDoc,
    project: DataModel.ProjectObject,
    meta: LocalDB<DataModel.ProjectMetaObject>
  ): boolean;
  emit(
    event: 'project_meta_active',
    listing: DataModel.ListingsObject,
    active: ExistingActiveDoc,
    project: DataModel.ProjectObject,
    meta: LocalDB<DataModel.ProjectMetaObject>
  ): boolean;
  emit(
    event: 'project_data_paused',
    listing: DataModel.ListingsObject,
    active: ExistingActiveDoc,
    project: DataModel.ProjectObject,
    data: LocalDB<DataModel.EncodedObservation>
  ): boolean;
  emit(
    event: 'project_data_active',
    listing: DataModel.ListingsObject,
    active: ExistingActiveDoc,
    project: DataModel.ProjectObject,
    data: LocalDB<DataModel.EncodedObservation>
  ): boolean;
  emit(
    event: 'project_local',
    listing: DataModel.ListingsObject,
    active: ExistingActiveDoc,
    project: DataModel.ProjectObject,
    meta: LocalDB<DataModel.ProjectMetaObject>,
    data: LocalDB<DataModel.EncodedObservation>
  ): boolean;
  emit(
    event: 'project_error',
    listing: DataModel.ListingsObject,
    active: ExistingActiveDoc,
    err: unknown
  ): boolean;
  emit(
    event: 'listing_local',
    listing: DataModel.ListingsObject,
    projects: ExistingActiveDoc[],
    people_db: LocalDB<DataModel.PeopleDoc>,
    projects_db: LocalDB<DataModel.ProjectObject>,
    default_connection: DataModel.ConnectionInfo
  ): boolean;
  emit(
    event: 'listing_paused',
    listing: DataModel.ListingsObject,
    projects: ExistingActiveDoc[],
    people_db: LocalDB<DataModel.PeopleDoc>,
    projects_db: LocalDB<DataModel.ProjectObject>,
    default_connection: DataModel.ConnectionInfo
  ): boolean;
  emit(
    event: 'listing_active',
    listing: DataModel.ListingsObject,
    projects: ExistingActiveDoc[],
    people_db: LocalDB<DataModel.PeopleDoc>,
    projects_db: LocalDB<DataModel.ProjectObject>,
    default_connection: DataModel.ConnectionInfo
  ): boolean;
  emit(event: 'listing_error', listing_id: string, err: unknown): boolean;
  emit(event: 'directory_local', listings: Set<string>): boolean;
  emit(event: 'directory_paused', listings: Set<string>): boolean;
  emit(event: 'directory_active', listings: Set<string>): boolean;
  emit(event: 'directory_error', err: unknown): boolean;
  emit(event: 'projects_known', projects: Set<string>): boolean;
  emit(event: 'metas_complete', metas: MetasCompleteType): boolean;
  emit(event: 'projects_created'): boolean;
}

/**
 * To prevent initialize() being called multiple times
 * This is false when the app starts,
 * True when initialize() has finished, and
 * the initialize promise when it's still in the process of initializing
 */
let initialize_state: boolean | Promise<void> = false;

export function initialize() {
  if (initialize_state === true) {
    return Promise.resolve(); //Already initialized
  } else if (initialize_state === false) {
    // Real initialization
    return (initialize_state = initialize_nocheck());
  } else {
    // Already initializing
    return initialize_state;
  }
}

async function initialize_nocheck() {
  await setupExampleActive(active_db);
  console.log('adding directory test data');

  const initialized = new Promise(resolve => {
    initializeEvents.once('projects_created', resolve);
  });
  initialize_dbs();
  await initialized;

  console.log('initialised dbs');

  console.log('setting up form');
}

const directory_connection_info: DataModel.ConnectionInfo = {
  proto: DIRECTORY_PROTOCOL,
  host: DIRECTORY_HOST,
  port: DIRECTORY_PORT,
  db_name: 'directory',
};

/**
 * List of functions to call before  the initialization starts
 * I.e. initialize_dbs() calls each one of these, once only, before
 * the first 'directory_local' event even starts.
 */
const registering_funcs: ((emitter: DirectoryEmitter) => unknown)[] = [];
const registered_unique_ids: Set<unknown> = new Set();

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
  if (initialize_state !== false && !registered_unique_ids.has(unique_id)) {
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

function initialize_dbs(): DirectoryEmitter {
  // Main sync propagation downwards to individual projects:
  initializeEvents
    .on('directory_local', listings => process_listings(listings, true))
    .on('directory_paused', listings => process_listings(listings, false))
    .on('listing_local', (...args) => process_projects(...args, true))
    .on('listing_paused', (...args) => process_projects(...args, false));

  registering_funcs.forEach(func => func(initializeEvents));

  // It all starts here, once the events are all registered
  console.log('SYNCHRONIZE START');
  process_directory(directory_connection_info).catch(err =>
    initializeEvents.emit('directory_error', err)
  );
  return initializeEvents;
}

add_initial_listener(register_projects_known);
/**
 * Once all projects are reasonably 'known' (i.e. the directory has errored/paused AND
 * all listings have errored/paused), this is set to the set of known project active ids
 *
 * This is set to just before 'projects_known' event is emitted.
 */
export let projects_known: null | Set<string> = null;

/**
 * Adds event handlers to initializeEvents to:
 * Enable 'Propagation' of completion of all known projects meta & other databases.
 * Completion, here, means that the meta database has errored/paused syncing.
 *
 * Resulting from this function, initializeEvents adds the following behaviour:
 * Once all projects are reasonably 'known' (i.e. the directory has errored/paused AND
 * all listings have errored/paused), a 'projects_known' event is emitted
 *
 * Note: All of these events may emit more than once. Use .once('event_name', ...)
 * to only listen for the first trigger.
 */
function register_projects_known(initializeEvents: DirectoryEmitter) {
  // This is more complicated, as we have to first ensure that it's in a reasonable state to say
  // that everything is known & created, before waiting for project meta downloads.
  // (So that we don't accidentally trigger things if local DBs are empty but waiting)

  // Directory has errored/paused: (so that listings_statuses will not have any more keys)
  let listings_known = false;

  // Mapping from listing_id: (boolean) if the listing has had its projects added to known_projects yet
  const listing_statuses = new Map<string, boolean>();
  const listing_statuses_complete = () =>
    listings_known && Array.from(listing_statuses.values()).every(v => v);

  // All projects accumulated here
  const known_projects = new Set<string>();

  // Emits project_known if all listings have their projects added to known_projects.
  const emit_if_complete = () => {
    if (listing_statuses_complete()) {
      projects_known = known_projects;
      initializeEvents.emit('projects_known', known_projects);
    }
  };

  initializeEvents.on('directory_paused', listings => {
    // Make sure listing_statuses has the key for listing
    // If it's already set to true, don't set it to false
    listings.forEach(listing =>
      listing_statuses.set(listing, listing_statuses.get(listing) || false)
    );
    for (const listing_id of Array.from(listing_statuses.keys())) {
      if (!listings.has(listing_id)) listing_statuses.delete(listing_id);
    }
    listings_known = true;

    emit_if_complete();
  });
  initializeEvents.on('directory_active', () => {
    // Wait for all listings to be re-synced before any 'completion events' trigger
    listings_known = false;
  });

  initializeEvents.on('listing_paused', (listing, active_projects) => {
    active_projects.forEach(active => known_projects.add(active._id));
    listing_statuses.set(listing._id, true);

    emit_if_complete();
  });
  initializeEvents.on('listing_error', listing_id => {
    // Don't hold up other things waiting for it to not be an error:
    listing_statuses.set(listing_id, true);

    emit_if_complete();
  });
  initializeEvents.on('listing_active', listing => {
    // Wait for listing to sync before everything is known.
    listing_statuses.set(listing._id, false);
  });
}

/**
 * This is appended to whenever a project has its
 * meta & data local dbs come into existance.
 *
 * This is essentially accumulating 'project_paused' events.
 */
export type createdProjectsInterface = {
  project: DataModel.ProjectObject;
  active: ExistingActiveDoc;
  meta: LocalDB<DataModel.ProjectMetaObject>;
  data: LocalDB<DataModel.EncodedObservation>;
};

export const createdProjects: {
  [key: string]: {
    project: DataModel.ProjectObject;
    active: ExistingActiveDoc;
    meta: LocalDB<DataModel.ProjectMetaObject>;
    data: LocalDB<DataModel.EncodedObservation>;
  };
} = {};

export let projects_created = false;

add_initial_listener(register_metas_complete);

function register_projects_created(initializeEvents: DirectoryEmitter) {
  const project_statuses = new Map<string, boolean>();

  const emit_if_complete = () => {
    if (projects_known && Array.from(project_statuses.values()).every(v => v)) {
      projects_created = true;
      initializeEvents.emit('projects_created');
    }
  };

  initializeEvents.on('project_local', (listing, active) => {
    project_statuses.set(active._id, true);
    emit_if_complete();
  });

  initializeEvents.on('projects_known', projects => {
    projects.forEach(project_id => {
      if (!project_statuses.has(project_id)) {
        // Add a project that hasn't triggered its project_local yet
        project_statuses.set(project_id, false);
      }
    });
    emit_if_complete();
  });
}

add_initial_listener(register_projects_created);

export type MetasCompleteType = {
  [active_id: string]:
    | [
        DataModel.ActiveDoc,
        DataModel.ProjectObject,
        LocalDB<DataModel.ProjectMetaObject>
      ]
    // Error'd out metadata db
    | [DataModel.ActiveDoc, unknown];
};

/**
 * When all known projects have their project_meta_paused event triggered,
 * and when all projects are known (see register_projects_known)
 * This is filled with metadata dbs of all known projects
 */
export let metas_complete: null | MetasCompleteType = null;
/**
 * When all known projects have their project_meta_paused event triggered,
 * and when all projects are known (see register_projects_known)
 * metas_complete event is triggered with list of all projects.
 */
function register_metas_complete(initializeEvents: DirectoryEmitter) {
  const map_has_all_known_projects = (map_obj: {[key: string]: unknown}) =>
    projects_known !== null &&
    Array.from(projects_known.values()).every(v => v in map_obj);

  // The following events essentially only trigger (possibly multiple times) once
  // projects_known is true, AND once all project_meta_pauseds have been triggered.
  const metas: MetasCompleteType = {};

  const emit_if_metas_complete = () => {
    if (map_has_all_known_projects(metas)) {
      metas_complete = metas;
      initializeEvents.emit('metas_complete', metas);
    }
  };

  initializeEvents.on(
    'project_meta_paused',
    (listing, active, project, meta) => {
      metas[active._id] = [active, project, meta];
      emit_if_metas_complete();
    }
  );
  initializeEvents.on('project_error', (listing, active, err) => {
    metas[active._id] = [active, err];
    emit_if_metas_complete();
  });
  initializeEvents.on('projects_known', () => {
    emit_if_metas_complete();
  });
}

async function process_directory(
  directory_connection_info: DataModel.ConnectionInfo
) {
  // Only sync active listings:
  const get_active_listings_in_this_directory = async () => {
    const all_listing_ids_in_this_directory = (
      await directory_db.local.allDocs()
    ).rows.map(row => row.id);

    const active_listings_in_this_directory = (
      await active_db.find({
        selector: {
          listing_id: {$in: all_listing_ids_in_this_directory},
        },
      })
    ).docs;

    return new Set(
      active_listings_in_this_directory.map(doc => doc.listing_id)
    );
  };
  const unupdated_listings_in_this_directory = await get_active_listings_in_this_directory();

  initializeEvents.emit(
    'directory_local',
    unupdated_listings_in_this_directory
  );

  if (directory_db.remote !== null) {
    return; //Already hooked up
  }
  const directory_paused = ConnectionInfo_create_pouch<DataModel.ListingsObject>(
    directory_connection_info
  );

  const directory_connection = PouchDB.replicate(
    directory_paused,
    directory_db.local,
    {
      live: false,
      retry: false,
    }
  );

  directory_db.remote = {
    db: directory_paused,
    is_sync: false,
    connection: directory_connection,
    info: directory_connection_info,
  };

  const sync_handler = new SyncHandler(DIRECTORY_TIMEOUT, {
    active: async () =>
      initializeEvents.emit(
        'directory_active',
        await get_active_listings_in_this_directory()
      ),
    paused: async () => {
      if (!USE_REAL_DATA) await setupExampleDirectory(directory_db.local);
      initializeEvents.emit(
        'directory_paused',
        await get_active_listings_in_this_directory()
      );
    },
    error: async () => {
      if (!USE_REAL_DATA) await setupExampleDirectory(directory_db.local);
      initializeEvents.emit(
        'directory_paused',
        await get_active_listings_in_this_directory()
      );
    },
  });
  sync_handler.listen(directory_connection);
}

function process_listings(listings: Set<string>, allow_nonexistant: boolean) {
  listings.forEach(listing_id => {
    directory_db.local
      .get(listing_id)
      .then(listing_object => {
        process_listing(listing_object).catch(err => {
          initializeEvents.emit('listing_error', listing_id, err);
        });
      })
      .catch(err => {
        console.log(
          err,
          'No local (listings object) for active DB',
          listing_id,
          'yet'
        );
        if (!allow_nonexistant) {
          console.error(
            'directory_synced emitted, but listing ',
            listing_id,
            'is missing'
          );
          initializeEvents.emit('listing_error', listing_id, err);
        }
      });
  });
}

async function process_listing(listing_object: DataModel.ListingsObject) {
  const listing_id = listing_object._id;

  const projects_db_id = listing_object['projects_db']
    ? listing_id
    : DEFAULT_LISTING_ID;

  const projects_connection = materializeConnectionInfo(
    (await get_default_instance())['projects_db'],
    listing_object['projects_db']
  );

  const people_local_id = listing_object['people_db']
    ? listing_id
    : DEFAULT_LISTING_ID;

  const people_connection = materializeConnectionInfo(
    (await get_default_instance())['people_db'],
    listing_object['people_db']
  );

  const [, local_people_db] = ensure_local_db(
    'people',
    people_local_id,
    people_dbs
  );
  const [, local_projects_db] = ensure_local_db(
    'projects',
    projects_db_id,
    projects_dbs
  );

  // Only sync active projects:
  const get_active_projects_in_this_listing = async () => {
    const all_project_ids_in_this_listing = (
      await local_projects_db.local.allDocs()
    ).rows.map(row => row.id);

    const active_projects_in_this_listing = (
      await active_db.find({
        selector: {
          listing_id: listing_id,
          project_id: {$in: all_project_ids_in_this_listing},
        },
      })
    ).docs;

    return active_projects_in_this_listing;
  };
  /**
   * List of projects in this listing that are also in the active DB
   * NOTE: This isn't updated, call get_active_projects_in_this_listing
   * after sufficient time (i.e. if the code you're writing is in a pause handler)
   */
  const unupdated_projects_in_this_listing = await get_active_projects_in_this_listing();

  initializeEvents.emit(
    'listing_local',
    listing_object,
    unupdated_projects_in_this_listing,
    local_people_db,
    local_projects_db,
    projects_connection
  );

  // TODO: Ensure that when the user adds a new active project
  // that these filters are updated.
  ensure_synced_db(
    people_local_id,
    people_connection,
    people_dbs,
    // Filters to only projects that are active
    unupdated_projects_in_this_listing.map(v => v._id)
  );
  const [projects_is_fresh, projects_db] = ensure_synced_db(
    projects_db_id,
    projects_connection,
    projects_dbs,
    // Filters to only projects that are active
    unupdated_projects_in_this_listing.map(v => v._id)
  );
  if (!projects_is_fresh) {
    return;
  }

  const sync_handler = new SyncHandler(LISTINGS_TIMEOUT, {
    active: async () =>
      initializeEvents.emit(
        'listing_active',
        listing_object,
        await get_active_projects_in_this_listing(),
        local_people_db,
        local_projects_db,
        projects_connection
      ),
    paused: async () => {
      if (!USE_REAL_DATA)
        await setupExampleListing(listing_object._id, local_projects_db.local);
      initializeEvents.emit(
        'listing_paused',
        listing_object,
        await get_active_projects_in_this_listing(),
        local_people_db,
        local_projects_db,
        projects_connection
      );
    },
    error: async () => {
      if (!USE_REAL_DATA)
        await setupExampleListing(listing_object._id, local_projects_db.local);
      initializeEvents.emit(
        'listing_paused',
        listing_object,
        await get_active_projects_in_this_listing(),
        local_people_db,
        local_projects_db,
        projects_connection
      );
    },
  });
  sync_handler.listen(projects_db.remote.connection);
}

function process_projects(
  listing: DataModel.ListingsObject,
  active_projects: ExistingActiveDoc[],
  people_db: LocalDB<DataModel.PeopleDoc>,
  projects_db: LocalDB<DataModel.ProjectObject>,
  default_connection: DataModel.ConnectionInfo,
  allow_nonexistant: boolean
) {
  active_projects.forEach(ap => {
    projects_db.local
      .get(ap.project_id)
      .then(project_object => {
        process_project(listing, ap, default_connection, project_object).catch(
          err => {
            initializeEvents.emit('project_error', listing, ap, err);
          }
        );
      })
      .catch(err => {
        console.log(err, 'No', ap.project_id, 'in', projects_db.local);
        if (!allow_nonexistant) {
          initializeEvents.emit('project_error', listing, ap, err);
        }
      });
  });
}

async function process_project(
  listing: DataModel.ListingsObject,
  active_project: ExistingActiveDoc,
  projects_db_connection: DataModel.ConnectionInfo,
  project_object: DataModel.ProjectObject
): Promise<void> {
  /**
   * Each project needs to know it's active_id to lookup the local
   * metadata/data databases.
   */
  const active_id = active_project._id;

  const [, meta_db_local] = ensure_local_db(
    'metadata',
    active_id,
    metadata_dbs
  );
  const [, data_db_local] = ensure_local_db('data', active_id, data_dbs);

  createdProjects[active_id] = {
    project: project_object,
    active: active_project,
    meta: meta_db_local,
    data: data_db_local,
  };

  initializeEvents.emit(
    'project_local',
    listing,
    active_project,
    project_object,
    meta_db_local,
    data_db_local
  );

  // Defaults to the same couch as the projects db, but different database name:
  const meta_connection_info = materializeConnectionInfo(
    {
      ...projects_db_connection,
      db_name: METADATA_DBNAME_PREFIX + project_object._id,
    },
    project_object.metadata_db
  );

  const data_connection_info = materializeConnectionInfo(
    {
      ...projects_db_connection,
      db_name: DATA_DBNAME_PREFIX + project_object._id,
    },
    project_object.data_db
  );

  const [meta_is_fresh, meta_db] = ensure_synced_db(
    active_id,
    meta_connection_info,
    metadata_dbs
  );
  const [data_is_fresh, data_db] = ensure_synced_db(
    active_id,
    data_connection_info,
    data_dbs,
    {push: {}}
  );

  if (meta_is_fresh) {
    const meta_sync_handler = new SyncHandler(PROJECT_TIMEOUT, {
      active: async () =>
        initializeEvents.emit(
          'project_meta_active',
          listing,
          active_project,
          project_object,
          meta_db
        ),
      paused: async () => {
        if (!USE_REAL_DATA)
          await setupExampleProjectMetadata(active_project._id, meta_db.local);
        initializeEvents.emit(
          'project_meta_paused',
          listing,
          active_project,
          project_object,
          meta_db
        );
      },
      error: async () => {
        if (!USE_REAL_DATA)
          await setupExampleProjectMetadata(active_project._id, meta_db.local);
        initializeEvents.emit(
          'project_meta_paused',
          listing,
          active_project,
          project_object,
          meta_db
        );
      },
    });
    meta_sync_handler.listen(meta_db.remote.connection);
  }

  if (data_is_fresh) {
    const data_sync_handler = new SyncHandler(PROJECT_TIMEOUT, {
      active: async () =>
        initializeEvents.emit(
          'project_data_active',
          listing,
          active_project,
          project_object,
          data_db
        ),
      paused: async () => {
        if (!USE_REAL_DATA)
          await setupExampleData(active_project._id, data_db.local);
        initializeEvents.emit(
          'project_data_paused',
          listing,
          active_project,
          project_object,
          data_db
        );
      },
      error: async () => {
        if (!USE_REAL_DATA)
          await setupExampleData(active_project._id, data_db.local);
        initializeEvents.emit(
          'project_data_paused',
          listing,
          active_project,
          project_object,
          data_db
        );
      },
    });
    data_sync_handler.listen(data_db.remote.connection);
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
