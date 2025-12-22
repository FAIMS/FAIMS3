import {
  compileUiSpecConditionals,
  decodeUiSpec,
  EncodedProjectUIModel,
  GetNotebookResponse,
  ProjectUIModel,
} from '@faims3/data-model';
import PouchDB from 'pouchdb-browser';
import {
  DEBUG_APP,
  POUCH_BATCH_SIZE,
  POUCH_BATCHES_LIMIT,
  RUNNING_UNDER_TEST,
} from '../../../buildconfig';
import {DatabaseConnectionConfig, ProjectIdentity} from '../projectSlice';
import {PouchDBWrapper} from './pouchDBWrapper';

type DBReplicateOptions =
  | PouchDB.Replication.ReplicateOptions
  | {
      pull: PouchDB.Replication.ReplicateOptions;
      push: PouchDB.Replication.ReplicateOptions;
    };

export const ATTACHMENT_FILTER_CONFIG = {
  filter: '_view',
  view: 'attachment_filter/attachment_filter',
};

// This is the PouchDB type which provides options for instantiating a database
type LocalDatabaseOptions = PouchDB.Configuration.DatabaseConfiguration;

// Default local options is none
export const LOCAL_POUCH_OPTIONS: LocalDatabaseOptions = {};

// enable memory adapter for testing
if (RUNNING_UNDER_TEST) {
  LOCAL_POUCH_OPTIONS['adapter'] = 'memory';
}

/**
 * Builds a PouchDB sync object identifier for use in the databaseService
 * @param localId The local database identifier (which is unique)
 * @param remoteId The remote database identifier (which is unique)
 * @returns A suitable identifier which uniquely identifies a sync object
 */
export const buildSyncId = ({
  localId,
  remoteId,
}: {
  localId: string;
  remoteId: string;
}): string => {
  return `${localId}-${remoteId}`;
};

/**
 * Builds an identifier for the compiled spec service
 * @param id A project identity which includes the server + project
 * @returns A suitable identifier which uniquely identifies a compiled spec
 */
export const buildCompiledSpecId = (id: ProjectIdentity): string => {
  return `${id.serverId}-${id.projectId}`;
};

/**
 * Generates a predictable (deterministic) unique identifier for local pouch
 * databases. This is unique for the whole app given it combines the server and
 * project IDs.
 *
 * @param projectId
 * @param serverId
 *
 * @returns The ID to use
 */
export function buildPouchIdentifier({
  projectId,
  serverId,
}: ProjectIdentity): string {
  return `${serverId}_${projectId}_data`;
}

export const DATA_DB_PREFIX = 'data-';

/**
 * Generates the couch DB name from the project ID.
 *
 * TODO is it safe to generate this here? We could use the database name from
 * the API.
 *
 * @param projectId The ID of the project
 * @returns The name of the couch DB to connect to
 */
export function getRemoteDatabaseNameFromId({
  projectId,
}: {
  projectId: string;
}): string {
  return DATA_DB_PREFIX + projectId;
}

/**
 * Simple function which creates a Pouch database which is local only.
 *
 * @param id The unique identifier for this database
 *
 * @returns PouchDB
 */
export function createLocalPouchDatabase<Content extends {}>({
  id,
}: {
  id: string;
}): PouchDBWrapper<Content> {
  return new PouchDBWrapper<Content>(id);
}

/**
 * Creates a PouchDBWrapper used to access a remote Couch/Pouch instance
 *
 * @param jwtToken The token to authorise with
 * @param couchUrl The couch URL e.g. https://couch.domain.com:443
 * @param databaseName The database name e.g. myDatabase
 *
 * @return {id, db} The ID is a unique id suitable for the databaseService, db
 * is the PouchDB instance
 */
export function createRemotePouchDbFromConnectionInfo<Content extends {}>({
  jwtToken,
  couchUrl,
  databaseName,
}: DatabaseConnectionConfig): {id: string; db: PouchDB.Database<Content>} {
  // Ensure that there is no attempt to create this database remotely
  const pouchOptions: PouchDB.Configuration.RemoteDatabaseConfiguration = {
    skip_setup: true,
  };

  // TODO: Use a new enough pouchdb such that we don't need the fetch hook, see
  // https://github.com/pouchdb/pouchdb/issues/8387

  // Patches the fetch with the jwt to authorise to remote DB
  pouchOptions.fetch = function (url: any, opts: any) {
    // Embed the JWT into the payload
    opts.headers.set('Authorization', `Bearer ${jwtToken}`);
    return PouchDB.fetch(url, opts);
  };

  // Derive the connection string (includes port if needed)
  const dbConnectionString = couchUrl.endsWith('/')
    ? couchUrl + databaseName
    : couchUrl + '/' + databaseName;

  return {
    db: new PouchDB(dbConnectionString, pouchOptions),
    id: dbConnectionString,
  };
}

/**
 * Type definitions for PouchDB sync/replication event handlers
 */

/**
 * Information about replication progress/completion
 */
export interface ChangeSyncInfo {
  /** Which sync direction is this? */
  direction: 'push' | 'pull';
  change: {
    /** Number of document write failures */
    doc_write_failures: number;
    /** Number of documents read during replication */
    docs_read: number;
    /** Number of documents written during replication */
    docs_written: number;
    /** Array of errors that occurred during replication */
    errors: Error[];
    /** Last sequence number processed */
    last_seq: number | string;
    /** Whether the replication was successful */
    ok: boolean;
    /** How many records pending sync? */
    pending: number;
    /** Start time of the replication */
    start_time: string;
    /** Documents involved in the change */
    docs?: Array<{
      _id: string;
      _rev: string;
      [key: string]: any;
    }>;
  };
}

/**
 * Map of sync event names to their handler function signatures
 */
export interface SyncEventHandlers {
  /**
   * Fired when the replication has written a new document
   * @param info Information about the change, including the docs involved
   */
  change?: (info: ChangeSyncInfo) => void;

  /**
   * Fired when replication is paused, either because a live replication is waiting
   * for changes, or replication has temporarily failed and is attempting to resume
   * @param err Error object if replication was paused due to an error
   */
  paused?: (err?: Error) => void;

  /**
   * Fired when the replication starts actively processing changes;
   * e.g. when it recovers from an error or new changes are available
   */
  active?: () => void;

  /**
   * Fired when a document failed to replicate due to validation or authorization errors
   * @param err Information about the document that failed to replicate
   */
  denied?: (err: Error) => void;

  /**
   * Fired when the replication is stopped due to an unrecoverable failure
   * If retry is false, this will also fire when the user goes offline
   * or another network error occurs
   * @param err Error that caused replication to fail
   */
  error?: (err: Error) => void;
}

let DEFAULT_SYNC_HANDLERS: SyncEventHandlers = {};

if (DEBUG_APP) {
  DEFAULT_SYNC_HANDLERS = {
    active: () => {
      console.log('🔄 Sync: Active - Replication resumed');
    },
    change: info => {
      console.log('🔄 Sync: Change', info);
    },
    paused: err => {
      console.log(
        '🔄 Sync: Paused',
        err ? {error: err} : '(replication up to date)'
      );
    },
    denied: err => {
      console.log('🔄 Sync: Denied - Document failed to replicate', {
        error: err,
      });
    },
    error: err => {
      console.log('🔄 Sync: Error', {error: err});
    },
  };
}

/**
 * Creates a new synchronisation (PouchDB.sync) between the specified local and
 * remote DB. This uses the preferred sync options to avoid misconfiguration in
 * caller functions. Two way sync is always enabled, with live and retry. If
 * attachment filter is supplied, the pull sync options are overridden with a
 * filter.
 *
 * @param attachmentDownload Download attachments iff true
 * @param localDb The local DB to sync
 * @param remoteDb The remote DB to sync
 * @param eventHandlers Optional event handlers for sync events
 *
 * @returns The new sync object
 */
export function createPouchDbSync<Content extends {}>({
  attachmentDownload,
  localDb,
  remoteDb,
  eventHandlers = DEFAULT_SYNC_HANDLERS,
}: {
  attachmentDownload: boolean;
  localDb: PouchDBWrapper<Content>;
  remoteDb: PouchDB.Database<Content>;
  eventHandlers?: SyncEventHandlers;
}) {
  // Configure attachment filtering if needed
  const pullFilter = attachmentDownload ? {} : ATTACHMENT_FILTER_CONFIG;
  const options: DBReplicateOptions = {
    // Live sync mode (i.e. poll)
    live: true,
    // Retry on fail
    retry: true,
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

  // Create the sync object
  let sync = PouchDB.sync(localDb.db, remoteDb, options);

  // Attach all provided event handlers These types provided in the library are
  // completely wrong - e.g. see the docs here https://pouchdb.com/api.html#sync
  // - these events are not even available in the types and the interfaces are
  //   incomplete/too-restrictive
  if (eventHandlers.change) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    sync = sync.on('change', eventHandlers.change);
  }
  if (eventHandlers.paused) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    sync = sync.on('paused', eventHandlers.paused);
  }
  if (eventHandlers.active) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    sync = sync.on('active', eventHandlers.active);
  }
  if (eventHandlers.denied) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    sync = sync.on('denied', eventHandlers.denied);
  }
  if (eventHandlers.error) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    sync = sync.on('error', eventHandlers.error);
  }

  return sync;
}

/**
 * Fetch project metadata from the server.
 */
export const fetchProjectMetadataAndSpec = async ({
  token,
  serverUrl,
  projectId,
  compile = true,
}: {
  token: string;
  serverUrl: string;
  projectId: string;
  compile: boolean;
}): Promise<GetNotebookResponse & {decodedSpec: ProjectUIModel}> => {
  const url = `${serverUrl}/api/notebooks/${projectId}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const notebook = (await response.json()) as GetNotebookResponse;

  // TODO runtime validation. This is a dangerous assumption! This should do a
  // cast this because of poor typing!!
  const rawUiSpec = notebook[
    'ui-specification'
  ] as any as EncodedProjectUIModel;
  const uiSpec = decodeUiSpec(rawUiSpec);
  if (compile) {
    compileUiSpecConditionals(uiSpec);
  }
  return {...notebook, decodedSpec: uiSpec};
};
