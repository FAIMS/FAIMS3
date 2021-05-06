import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import * as DataModel from '../datamodel';
import * as Events from 'events';
import {setupExampleForm} from '../dummyData';

const DEFAULT_LISTING_ID = 'default';
const METADATA_DBNAME_PREFIX = 'metadata-';
const DATA_DBNAME_PREFIX = 'data-';
const DIRECTORY_TIMEOUT = 1000;
const LISTINGS_TIMEOUT = 2000;
const PROJECT_TIMEOUT = 3000;

const USE_REAL_DATA = process.env.REACT_APP_USE_REAL_DATA;
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
 * Directory: All (public, anyways) Faims instances
 */
export const directory_db: LocalDB<DataModel.ListingsObject> = {
  local: new PouchDB('directory'),
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
 * @param prefix Name to use to run new PouchDB(prefix + '/' + id), objects of the same type have the same prefix
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
        local: new PouchDB(prefix + '/' + local_db_id),
        remote: null,
      }),
    ];
  }
}

/**
 * @param local_db_id id is per-object of type, to discriminate between them. i.e. a project ID
 * @param global_dbs projects_db or people_db
 * @param connection_info Info to use to connect to remote
 * @returns Flag if newly created =true, already existing=false & The local DB & remote
 */
function ensure_synced_db<Content extends {}>(
  local_db_id: string,
  connection_info: DataModel.ConnectionInfo,
  global_dbs: LocalDBList<Content>,
  options?: PouchDB.Replication.ReplicateOptions
): [boolean, LocalDB<Content> & {remote: LocalDBRemote<Content>}] {
  if (global_dbs[local_db_id] === undefined) {
    throw 'Logic eror: ensure_local_db must be called before this code';
  }

  // Already connected/connecting
  if (global_dbs[local_db_id].remote !== null) {
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
  const test_doc3: {
    _rev?: string;
    _id: string;
    listing_id: string;
    project_id: string;
    username: string;
    password: string;
  } = {
    _id: 'default/projectA',
    listing_id: 'default',
    project_id: 'projectA',
    username: 'test1',
    password: 'apple',
  };
  const test_doc4: {
    _rev?: string;
    _id: string;
    listing_id: string;
    project_id: string;
    username: string;
    password: string;
  } = {
    _id: 'default/projectB',
    listing_id: 'default',
    project_id: 'projectB',
    username: 'test1',
    password: 'apple',
  };
  const test_doc5: {
    _rev?: string;
    _id: string;
    listing_id: string;
    project_id: string;
    username: string;
    password: string;
  } = {
    _id: 'default/projectC',
    listing_id: 'default',
    project_id: 'projectC',
    username: 'test1',
    password: 'apple',
  };

  const test_docs = [test_doc1, test_doc2, test_doc3, test_doc4, test_doc5];

  for (const doc of test_docs) {
    try {
      const current_test_doc = await active_db.get(doc._id);
      doc._rev = current_test_doc._rev;
    } catch (err) {
      // Not in the DB means _rev is unnecessary for put()
    }
    await active_db.put(doc);
  }
}

/**
 * This is appended to whenever a project has its
 * meta & data local dbs come into existance.
 *
 * This is essentially accumulating 'project_paused' events.
 */
export const createdProjects: {
  [key: string]: {
    project: DataModel.ProjectObject;
    active: ExistingActiveDoc;
    meta: LocalDB<DataModel.ProjectMetaObject>;
    data: LocalDB<DataModel.EncodedObservation>;
  };
} = {};

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
    throw 'Projects not initialized yet';
  }
}

export function getProjectDB(
  active_id: string
): PouchDB.Database<DataModel.ProjectMetaObject> {
  if (metadata_dbs[active_id] !== undefined) {
    return metadata_dbs[active_id].local;
  } else {
    throw 'Projects not initialized yet';
  }
}

export function getAvailableProjectsMetaData(): DataModel.ProjectsList {
  return {
    'default/projectA': {
      _id: 'projectA',
      name: 'Project A',
      description: 'A dummy project',
    },
    'default/projectB': {
      _id: 'projectB',
      name: 'Project B',
      description: 'A dummy project',
    },
    'default/projectC': {
      _id: 'projectC',
      name: 'Project C',
      description: 'A dummy project',
    },
  };
}

export const initializeEvents: DirectoryEmitter = new EventEmitter();

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
  emit(
    event: 'metas_complete',
    metas: {
      [key: string]:
        | null
        | [
            DataModel.ActiveDoc,
            DataModel.ProjectObject,
            LocalDB<DataModel.ProjectMetaObject>
          ];
    }
  ): boolean;
}

/**
 * Adds event handlers to initializeEvents to:
 * Enable 'Propagation' of completion of all known projects meta & other databases.
 * Completion, here, means that the meta database has errored/paused syncing.
 *
 * Resulting from this funciton, initializeEvents adds the following behaviour:
 * Once all projects are reasonably 'known' (i.e. the directory has errored/paused AND
 * all listings have errored/paused), a 'projects_known' event is emitted
 *
 * When all known projects have their project_meta_paused event triggered,
 * metas_complete event is triggered with list of all projects.
 *
 * Note: All of these events may emit more than once. Use .once('event_name', ...)
 * to only listen for the first trigger.
 */
function register_completion_detectors() {
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
  const map_has_all_known_projects = (map_obj: {[key: string]: unknown}) =>
    listing_statuses_complete() &&
    Array.from(known_projects.values()).every(v => v in map_obj);

  // Emits project_known if all listings have their projects added to known_projects.
  const emit_if_complete = () =>
    listing_statuses_complete()
      ? initializeEvents.emit('projects_known', known_projects)
      : undefined;

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

  // The following events essentially only trigger (possibly multiple times) once
  // projects_known is true, AND once all project_meta_pauseds have been triggered.
  const metas: {
    [key: string]:
      | null
      | [
          DataModel.ActiveDoc,
          DataModel.ProjectObject,
          LocalDB<DataModel.ProjectMetaObject>
        ];
  } = {};

  const emit_if_metas_complete = () =>
    map_has_all_known_projects(metas)
      ? initializeEvents.emit('metas_complete', metas)
      : undefined;

  initializeEvents.on(
    'project_meta_paused',
    (listing, active, project, meta) => {
      metas[active._id] = [active, project, meta];
      emit_if_metas_complete();
    }
  );
  initializeEvents.on('project_error', (lsting, active) => {
    metas[active._id] = null;
    emit_if_metas_complete();
  });
  initializeEvents.on('projects_known', () => {
    emit_if_metas_complete();
  });
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
  await populate_test_data();
  console.log('adding directory test data');

  const initialized = new Promise(resolve => {
    initializeEvents.once('metas_complete', resolve);
  });
  initialize_dbs({
    proto: 'http',
    host: '10.80.11.44',
    port: 5984,
    db_name: 'directory',
  });
  await initialized;
  console.log('initialised dbs');

  console.log('setting up form');
}

function initialize_dbs(
  directory_connection_info: DataModel.ConnectionInfo
): DirectoryEmitter {
  // Main sync propagation downwards to individual projects:
  initializeEvents
    .on('directory_local', listings => process_listings(listings, true))
    .on('directory_paused', listings => process_listings(listings, false))
    .on('listing_local', (...args) => process_projects(...args, true))
    .on('listing_paused', (...args) => process_projects(...args, false));

  register_completion_detectors();

  // It all starts here, once the events are all registered
  console.log('SYNCHRONIZE START');
  process_directory(directory_connection_info).catch(err =>
    initializeEvents.emit('directory_error', err)
  );
  return initializeEvents;
}

async function process_directory(
  directory_connection_info: DataModel.ConnectionInfo
) {
  const listings = await active_db
    .allDocs({include_docs: true})
    .then(all_docs =>
      all_docs.rows.reduce(
        (listing, row) => listing.add(row.doc!.listing_id),
        new Set<string>()
      )
    );

  initializeEvents.emit('directory_local', listings);

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

  let waiting = true;
  const synced_callback = () => {
    waiting = false;
    initializeEvents.emit('directory_paused', listings);
  };
  directory_connection.on('error', synced_callback);
  directory_connection.on('paused', synced_callback);
  directory_connection.on('active', () => {
    waiting = true;
    initializeEvents.emit('directory_active', listings);
  });
  setTimeout(() => {
    if (waiting) {
      // Timeout error when still waiting here
      console.error('Timed out waiting for', directory_connection);
      synced_callback();
    }
  }, DIRECTORY_TIMEOUT);
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
  const projects_connection =
    listing_object['projects_db'] ||
    (await get_default_instance())['projects_db'];

  const people_local_id = listing_object['people_db']
    ? listing_id
    : DEFAULT_LISTING_ID;
  const people_connection =
    listing_object['people_db'] || (await get_default_instance())['people_db'];

  // Only sync active projects:
  const active_projects = (
    await active_db.find({selector: {listing_id: listing_id}})
  ).docs;

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
  initializeEvents.emit(
    'listing_local',
    listing_object,
    active_projects,
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
    {doc_ids: active_projects.map(v => v.project_id)}
  );
  const [projects_is_fresh, projects_db] = ensure_synced_db(
    projects_db_id,
    projects_connection,
    projects_dbs,
    // Filters to only projects that are active
    {doc_ids: active_projects.map(v => v.project_id)}
  );
  if (!projects_is_fresh) {
    return;
  }

  let waiting = true;
  const synced_callback = () => {
    waiting = false;
    initializeEvents.emit(
      'listing_paused',
      listing_object,
      active_projects,
      local_people_db,
      local_projects_db,
      projects_connection
    );
  };
  projects_db.remote.connection.on('paused', synced_callback);
  projects_db.remote.connection.on('error', synced_callback);
  projects_db.remote.connection.on('active', () => {
    waiting = true;
    initializeEvents.emit(
      'listing_active',
      listing_object,
      active_projects,
      local_people_db,
      local_projects_db,
      projects_connection
    );
  });
  setTimeout(() => {
    if (waiting) {
      // Timeout error when still waiting here
      console.error('Timed out waiting for ', projects_db.remote);
      synced_callback();
    }
  }, LISTINGS_TIMEOUT);
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
  initializeEvents.emit(
    'project_local',
    listing,
    active_project,
    project_object,
    meta_db_local,
    data_db_local
  );

  // Defaults to the same couch as the projects db, but different database name:
  const meta_connection_info = project_object.metadata_db || {
    ...projects_db_connection,
    db_name: METADATA_DBNAME_PREFIX + project_object._id,
  };

  const data_connection_info = project_object.data_db || {
    ...projects_db_connection,
    db_name: DATA_DBNAME_PREFIX + project_object._id,
  };

  const [meta_is_fresh, meta_db] = ensure_synced_db(
    active_id,
    meta_connection_info,
    metadata_dbs
  );
  const [data_is_fresh, data_db] = ensure_synced_db(
    active_id,
    data_connection_info,
    data_dbs
  );
  createdProjects[active_id] = {
    project: project_object,
    active: active_project,
    meta: meta_db,
    data: data_db,
  };

  if (meta_is_fresh) {
    let waiting = true;
    const synced_callback = () => {
      waiting = false;
      if (USE_REAL_DATA !== '' && USE_REAL_DATA !== undefined) {
        initializeEvents.emit(
          'project_meta_paused',
          listing,
          active_project,
          project_object,
          meta_db
        );
      } else {
        setupExampleForm(active_project._id, meta_db).then(() => {
          initializeEvents.emit(
            'project_meta_paused',
            listing,
            active_project,
            project_object,
            meta_db
          );
        });
      }
    };
    meta_db.remote.connection.on('paused', synced_callback);
    meta_db.remote.connection.on('error', synced_callback);
    meta_db.remote.connection.on('active', () => {
      waiting = true;
      initializeEvents.emit(
        'project_meta_active',
        listing,
        active_project,
        project_object,
        meta_db
      );
    });
    setTimeout(() => {
      if (waiting) {
        // Timeout error when still waiting here
        console.error('Timed out waiting for ', meta_db.remote);
        synced_callback();
      }
    }, PROJECT_TIMEOUT);
  }

  if (data_is_fresh) {
    let waiting = true;
    const synced_callback = () => {
      waiting = false;
      initializeEvents.emit(
        'project_data_paused',
        listing,
        active_project,
        project_object,
        data_db
      );
    };
    data_db.remote.connection.on('paused', synced_callback);
    data_db.remote.connection.on('error', synced_callback);
    data_db.remote.connection.on('active', () => {
      waiting = true;
      initializeEvents.emit(
        'project_data_active',
        listing,
        active_project,
        project_object,
        data_db
      );
    });
    setTimeout(() => {
      if (waiting) {
        // Timeout error when still waiting here
        console.error('Timed out waiting for ', data_db.remote);
        synced_callback();
      }
    }, PROJECT_TIMEOUT);
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
