import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import * as DataModel from '../datamodel';
import * as Events from 'events';

const DEFAULT_LISTING_ID = 'default';
const METADATA_DBNAME_PREFIX = 'metadata-';
const DATA_DBNAME_PREFIX = 'data-';

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
export const directory_db = new PouchDB<DataModel.ListingsObject>('directory');

class EventEmitter extends Events.EventEmitter {
  name: string;
  constructor(name: string, opts?: {captureRejections?: boolean}) {
    super(opts);
    this.name = name;
  }
  emit(event: string | symbol, ...args: unknown[]): boolean {
    console.debug(this.name, event, args);
    return super.emit(event, ...args);
  }
  emit_nolog(event: string | symbol, ...args: unknown[]): boolean {
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

export let is_dbs_created = false;
export let is_metas_created = false;
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
 * @param prefix Name to use to run new PouchDB(prefix + '/' + id), objects of the same type have the same prefix
 * @param local_db_id id is per-object of type, to discriminate between them. i.e. a project ID
 * @param global_dbs projects_db or people_db
 * @returns The local DB
 */
function ensure_local_db<Content extends {}>(
  prefix: string,
  local_db_id: string,
  global_dbs: LocalDBList<Content>
): LocalDB<Content> {
  if (global_dbs[local_db_id]) {
    return global_dbs[local_db_id];
  } else {
    return (global_dbs[local_db_id] = {
      local: new PouchDB(prefix + '/' + local_db_id),
      remote: null,
    });
  }
}

/**
 * @param local_db_id id is per-object of type, to discriminate between them. i.e. a project ID
 * @param global_dbs projects_db or people_db
 * @param connection_info Info to use to connect to remote
 * @returns The local DB
 */
function ensure_synced_db<Content extends {}>(
  local_db_id: string,
  connection_info: DataModel.ConnectionInfo,
  global_dbs: LocalDBList<Content>,
  options?: PouchDB.Replication.ReplicateOptions
): LocalDB<Content> & {remote: LocalDBRemote<Content>} {
  if (global_dbs[local_db_id] === undefined) {
    throw 'Logic eror: ensure_local_db must be called before this code';
  }

  // Already connected/connecting
  if (global_dbs[local_db_id].remote !== null) {
    return {
      ...global_dbs[local_db_id],
      remote: global_dbs[local_db_id].remote!,
    };
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

  return (global_dbs[local_db_id] = {
    local: global_dbs[local_db_id].local,
    remote: {
      db: remote,
      is_sync: false,
      connection: connection,
      info: connection_info,
    },
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

// class ContextualEventEmitfunction<
//   Args extends unknown[],
//   Context extends unknown[]
// > extends EventEmitter {
//   emit(event: string | Symbol, ...with_context: [...Context, ...Args]): boolean;

//   contextualizeEvent(
//     contextless_name: string | Symbol,
//     event_from: EventEmitter & {on(string, ...args: unknown[]): EventEmitter},
//     new_name: string | Symbol,
//     ...context: Context
//   ): this {
//     event_from.on(contextless_name, (...orig_args: Args) => {
//       this.emit(new_name, ...context, ...orig_args);
//     });
//     return this;
//   }
// }

function contextualizeEvents(
  name: string,
  emit_to: EventEmitter,
  mappings: [string, string][],
  ...context: unknown[]
): EventEmitter {
  const event_from = new EventEmitter(name);

  mappings.forEach(([new_name, contextless_name]) =>
    event_from.on(contextless_name, (...orig_args: unknown[]) => {
      // Emit new_name with the new arguments THEN the old arguments
      emit_to.emit_nolog(new_name, ...context, ...orig_args);
    })
  );

  return event_from;
}

/**
 * When you have a lot of EventEmitters, and you want to trigger another event to run
 * when they have all each triggered an event, use this. For each individual EventEmitter,
 * it must have a corresponding string 'id'. After all emitters have triggered, the named event,
 * the primary emit_to emitter has its emit_as[0] event emitted.
 * The triggering_amount_of_identifiers is the count of the number of indiviudual EventEmitters.
 *
 * Currently used to trigger a 'listing_complete' when all projects in said listing
 * have triggered their 'project_complete' event
 *
 * WARNING: If triggering_amount_of_identifers == 0, then events are emitted IMMEDIATELY,
 * So be sure to order the creation of propagateWhenAllEmitted properly.
 * (This can be relaxed if this func is modified to use process.nextTick to emit, but
 * this isn't necessary for current uses.)
 *
 * @param triggering_amount_of_identifiers Amount of unique identifires for which an event must be triggered with to cause the main event to be emitted
 * @param emit_to Where events are emitted to after the required number of unique id's are accumulated
 * @param emit_as Event name and event arguments emitted to emit_to
 * @returns '*_one' function that you use on a 'contextualizedEventEmitter' to register it as one of the events that accumulates an id.
 */
function propagateWhenAllEmitted(
  triggering_amount_of_identifiers: number,
  emit_to: EventEmitter,
  ...emit_as: [string, ...unknown[]]
): (identifier: string, event_from: EventEmitter, event_name: string) => void {
  if (triggering_amount_of_identifiers === 0) {
    // The event should be triggered immediately
    // The returned function most likely will never be called
    emit_to.emit(...emit_as);
  }

  // All identifiers for which the event has triggered
  const marked = new Set<string>();

  const mark_one = (id: string) => {
    marked.add(id);
    if (marked.size === triggering_amount_of_identifiers) {
      emit_to.emit(...emit_as);
    }
  };

  return (identifier: string, event_from: EventEmitter, event_name: string) => {
    event_from.once(event_name, () => mark_one(identifier));
  };
}

/**
 * This is appended to whenever a project has its
 * meta & data local dbs come into existance.
 *
 * This is essentially accumulating 'project_syncing' events.
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
 * This is essentially accumulating 'listing_syncing' events
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

export const initializeEvents: DirectoryEmitter = new EventEmitter('directory');

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
    event: 'project_created',
    listener: (
      listing: DataModel.ListingsObject,
      active: ExistingActiveDoc,
      meta: LocalDB<DataModel.ProjectMetaObject>,
      data: LocalDB<DataModel.EncodedObservation>
    ) => unknown
  ): this;
  on(
    event: 'project_syncing',
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
    listener: (
      listing: DataModel.ListingsObject,
      active: ExistingActiveDoc,
      err: unknown
    ) => unknown
  ): this;
  on(
    event: 'listing_complete',
    listener: (
      listing: DataModel.ListingsObject,
      active_projects: ExistingActiveDoc[]
    ) => unknown
  ): this;
  on(
    event: 'listing_created',
    listener: (listing: DataModel.ListingsObject) => unknown
  ): this;
  on(
    event: 'listing_syncing',
    listener: (
      listing: DataModel.ListingsObject,
      projects: ExistingActiveDoc[]
    ) => unknown
  ): this;
  on(
    event: 'listing_dbs_created',
    listener: (
      listing: DataModel.ListingsObject,
      active_projects: ExistingActiveDoc[]
    ) => unknown
  ): this;
  on(
    event: 'listing_metas_created',
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
  on(event: 'created', listener: () => unknown): this;
  on(
    event: 'dbs_created',
    listener: (listings: ExistingListings[]) => unknown
  ): this;
  on(
    event: 'metas_created',
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
    event: 'project_created',
    listing: DataModel.ListingsObject,
    active: ExistingActiveDoc,
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
    event: 'listing_complete',
    listing: DataModel.ListingsObject,
    active_projects: ExistingActiveDoc[]
  ): boolean;
  emit(event: 'listing_created', listing: DataModel.ListingsObject): boolean;
  emit(
    event: 'listing_syncing',
    listing: DataModel.ListingsObject,
    projects: ExistingActiveDoc[]
  ): boolean;
  emit(
    event: 'listing_dbs_created',
    listing: DataModel.ListingsObject,
    active_projects: ExistingActiveDoc[]
  ): boolean;
  emit(
    event: 'listing_metas_created',
    listing: DataModel.ListingsObject,
    active_projects: ExistingActiveDoc[]
  ): boolean;
  emit(event: 'listing_error', err: unknown): boolean;
  emit(event: 'complete', listings: ExistingListings[]): boolean;
  emit(event: 'syncing'): boolean;
  emit(event: 'dbs_created', listings: ExistingListings[]): boolean;
  emit(event: 'metas_created', listings: ExistingListings[]): boolean;
  emit(event: 'error', err: unknown): boolean;
}

export function initialize_dbs(
  directory_connection: DataModel.ConnectionInfo
): DirectoryEmitter {
  console.log('SYNCHRONIZE START');
  initializeEvents
    .once('dbs_created', () => {
      is_dbs_created = true;
    })
    .once('metas_created', () => {
      is_metas_created = true;
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
  emitter.emit('syncing');
}

function process_listings(
  emitter: DirectoryEmitter,
  listing_objects: ExistingListings[]
) {
  // This is the order they should be propagated in
  // (Should there be 0 listing_objects, they are emitted immediately)
  const one_created = propagateWhenAllEmitted(
    listing_objects.length,
    emitter,
    'dbs_created',
    listing_objects
  );
  const one_meta = propagateWhenAllEmitted(
    listing_objects.length,
    emitter,
    'metas_created',
    listing_objects
  );
  const one_completed = propagateWhenAllEmitted(
    listing_objects.length,
    emitter,
    'complete',
    listing_objects
  );

  listing_objects.forEach(el => {
    const contextualizingEmitter: ListingEmitter = contextualizeEvents(
      'listing_' + el._id,
      emitter,
      [
        ['project_complete', 'project_complete'],
        ['project_created', 'project_created'],
        ['project_syncing', 'project_syncing'],
        ['project_data_complete', 'project_data_complete'],
        ['project_meta_complete', 'project_meta_complete'],
        ['project_error', 'project_error'],

        ['listing_complete', 'complete'],
        ['listing_dbs_created', 'dbs_created'],
        ['listing_metas_created', 'metas_created'],
        ['listing_created', 'created'],
        ['listing_syncing', 'syncing'],
        ['listing_error', 'error'],
      ]
    );

    // Only once the listing has dbs_created all its own projects
    // this is different that process_projects,
    // on(listing_dbs_created) instead of _created

    one_created(el._id, contextualizingEmitter, 'dbs_created');
    one_created(el._id, contextualizingEmitter, 'error');

    one_meta(el._id, contextualizingEmitter, 'metas_created');
    one_meta(el._id, contextualizingEmitter, 'error');

    one_completed(el._id, contextualizingEmitter, 'complete');

    process_listing(contextualizingEmitter, el).catch(err =>
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
    event: 'project_created',
    listener: (
      listing: DataModel.ListingsObject,
      active: ExistingActiveDoc,
      meta: LocalDB<DataModel.ProjectMetaObject>,
      data: LocalDB<DataModel.EncodedObservation>
    ) => unknown
  ): this;
  on(
    event: 'project_syncing',
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
    listener: (
      listing: DataModel.ListingsObject,
      active: ExistingActiveDoc,
      err: unknown
    ) => unknown
  ): this;
  on(
    event: 'complete',
    listener: (
      listing: DataModel.ListingsObject,
      active_projects: ExistingActiveDoc[]
    ) => unknown
  ): this;
  on(
    event: 'created',
    listener: (listing: DataModel.ListingsObject) => unknown
  ): this;
  on(
    event: 'syncing',
    listener: (
      listing: DataModel.ListingsObject,
      projects: ExistingActiveDoc[]
    ) => unknown
  ): this;
  on(
    event: 'dbs_created',
    listener: (
      listing: DataModel.ListingsObject,
      active_projects: ExistingActiveDoc[]
    ) => unknown
  ): this;
  on(
    event: 'metas_created',
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
    event: 'project_created',
    listing: DataModel.ListingsObject,
    active: ExistingActiveDoc,
    meta: LocalDB<DataModel.ProjectMetaObject>,
    data: LocalDB<DataModel.EncodedObservation>
  ): boolean;
  emit(
    event: 'project_syncing',
    listing: DataModel.ListingsObject,
    project: DataModel.ProjectObject,
    active: ExistingActiveDoc,
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
    event: 'complete',
    listing: DataModel.ListingsObject,
    active_projects: ExistingActiveDoc[]
  ): boolean;
  emit(event: 'created', listing: DataModel.ListingsObject): boolean;
  emit(
    event: 'syncing',
    listing: DataModel.ListingsObject,
    projects: ExistingActiveDoc[]
  ): boolean;
  emit(
    event: 'dbs_created',
    listing: DataModel.ListingsObject,
    active_projects: ExistingActiveDoc[]
  ): boolean;
  emit(
    event: 'metas_created',
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

  ensure_local_db('people', people_local_id, people_dbs);
  ensure_local_db('projects', projects_db_id, projects_dbs);
  emitter.emit('created', listing_object);

  // Only sync active projects:
  const active_projects = (
    await active_db.find({selector: {listing_id: listing_object._id}})
  ).docs;

  // TODO: Ensure that when the user adds a new active project
  // that these filters are updated.
  ensure_synced_db(
    people_local_id,
    people_connection,
    people_dbs,
    // Filters to only projects that are active
    {doc_ids: active_projects.map(v => v.project_id)}
  );

  const projects_db = ensure_synced_db(
    projects_db_id,
    projects_connection,
    projects_dbs,
    // Filters to only projects that are active
    {doc_ids: active_projects.map(v => v.project_id)}
  );

  emitter.emit('syncing', listing_object, active_projects);

  const synced_callback = () => {
    process_projects(emitter, listing_object, active_projects);
  };
  projects_db.remote.connection.on('paused', synced_callback);
  projects_db.remote.connection.on('error', synced_callback);
  projects_db.remote.connection.on('error', err =>
    console.log(listing_object._id, err)
  );
  synced_callback();
}

function process_projects(
  emitter: ListingEmitter,
  listing: DataModel.ListingsObject,
  active_projects: ExistingActiveDoc[]
) {
  // This is the order they should be propagated in
  // (Should there be 0 listing_objects, they are emitted immediately)
  const one_created = propagateWhenAllEmitted(
    active_projects.length,
    emitter,
    'dbs_created',
    listing,
    active_projects
  );
  const one_meta = propagateWhenAllEmitted(
    active_projects.length,
    emitter,
    'metas_created',
    listing,
    active_projects
  );
  const one_completed = propagateWhenAllEmitted(
    active_projects.length,
    emitter,
    'complete',
    listing,
    active_projects
  );

  active_projects.forEach(ap => {
    const contextualizingEmitter: ProjectEmitter = contextualizeEvents(
      'project_' + ap._id,
      emitter,
      [
        ['project_complete', 'complete'],
        ['project_created', 'created'],
        ['project_syncing', 'syncing'],
        ['project_data_complete', 'data_complete'],
        ['project_meta_complete', 'meta_complete'],
        ['project_error', 'error'],
      ],
      listing
    );

    // Only once the listing has dbs_created all its own projects
    // this is different that process_projects,
    // on(listing_dbs_created) instead of _created
    one_created(ap._id, contextualizingEmitter, 'syncing');
    one_created(ap._id, contextualizingEmitter, 'error');

    one_meta(ap._id, contextualizingEmitter, 'meta_complete');
    one_meta(ap._id, contextualizingEmitter, 'error');

    one_completed(ap._id, contextualizingEmitter, 'complete');

    process_project(contextualizingEmitter, ap).catch(err => {
      contextualizingEmitter.emit('error', ap, err);
    });
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
    event: 'created',
    listener: (
      active: ExistingActiveDoc,
      meta: LocalDB<DataModel.ProjectMetaObject>,
      data: LocalDB<DataModel.EncodedObservation>
    ) => unknown
  ): this;
  on(
    event: 'syncing',
    listener: (
      project: DataModel.ProjectObject,
      active: ExistingActiveDoc,
      meta: LocalDB<DataModel.ProjectMetaObject>,
      data: LocalDB<DataModel.EncodedObservation>
    ) => unknown
  ): this;
  on(
    event: 'error',
    listener: (active: ExistingActiveDoc, err: unknown) => unknown
  ): this;

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
    event: 'created',
    active: ExistingActiveDoc,
    meta: LocalDB<DataModel.ProjectMetaObject>,
    data: LocalDB<DataModel.EncodedObservation>
  ): boolean;
  emit(
    event: 'syncing',
    project: DataModel.ProjectObject,
    active: ExistingActiveDoc,
    meta: LocalDB<DataModel.ProjectMetaObject>,
    data: LocalDB<DataModel.EncodedObservation>
  ): boolean;
  emit(event: 'error', active: ExistingActiveDoc, err: unknown): boolean;
}

async function process_project(
  emitter: ProjectEmitter,
  active_project: PouchDB.Core.ExistingDocument<DataModel.ActiveDoc>
): Promise<void> {
  /**
   * Each project needs to know it's active_id to lookup the local
   * metadata/data databases.
   */
  const active_id = active_project._id;
  const project_id = active_project.project_id;

  const meta_db_localonly = ensure_local_db(
    'metadata',
    active_id,
    metadata_dbs
  );
  const data_db_localonly = ensure_local_db('data', active_id, data_dbs);
  emitter.emit('created', active_project, meta_db_localonly, data_db_localonly);

  /*
  The following is now
  Stuff that may fail due to network, or authentication, issues.
  When this is all starting, 'syncing' event is emitted onto ProjectEmitter

  Like a listing has sub-projects, a project has sub-dbs. But it's less complex:
  Just meta & data dbs. They don't have a 'meta_syncing' event, only 'complete' events.

  Errors are handled by the caller. The caller should emit 'error' on 
  the ProjectEmitter.
  */

  const listing_id = active_project.listing_id;
  const projects_db = projects_dbs[listing_id];
  const projects_connection = projects_db.remote!.info;

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

  const meta_db = ensure_synced_db(
    active_id,
    meta_connection_info,
    metadata_dbs
  );
  const data_db = ensure_synced_db(active_id, data_connection_info, data_dbs);
  createdProjects[active_id] = {
    project: project_info,
    active: active_project,
    meta: meta_db,
    data: data_db,
  };
  emitter.emit('syncing', project_info, active_project, meta_db, data_db);

  function synced_callback<T>(
    evt_name: 'meta_complete' | 'data_complete',
    complete_marker: {[key: string]: boolean},
    db: LocalDB<T>
  ) {
    return () => {
      complete_marker[active_id] = true;
      ((emitter.emit as unknown) as (
        evt: string,
        project: DataModel.ProjectObject,
        active: ExistingActiveDoc,
        arg: LocalDB<T>
      ) => boolean)(evt_name, project_info, active_project, db);
    };
  }

  meta_db.remote.connection.on(
    'paused',
    synced_callback('meta_complete', meta_db_created, meta_db)
  );
  meta_db.remote.connection.on(
    'error',
    synced_callback('meta_complete', meta_db_created, meta_db)
  );
  meta_db.remote.connection.on('error', err =>
    console.log(active_project.listing_id, project_id, 'meta', err)
  );

  data_db.remote.connection.on(
    'paused',
    synced_callback('data_complete', data_db_created, data_db)
  );
  data_db.remote.connection.on(
    'error',
    synced_callback('data_complete', data_db_created, data_db)
  );
  data_db.remote.connection.on('error', err =>
    console.log(active_project.listing_id, project_id, 'data', err)
  );

  const complete_one = propagateWhenAllEmitted(
    2,
    emitter,
    'complete',
    project_info,
    active_project,
    meta_db,
    data_db
  );

  complete_one('meta', emitter, 'meta_complete');
  complete_one('data', emitter, 'data_complete');
}
/* eslint-enable @typescript-eslint/no-unused-vars */
