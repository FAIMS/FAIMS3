import {GetNotebookResponse, ProjectStatus} from '@faims3/data-model';
import {projectInformationFromGetNotebook} from './notebookDefinition';
import PouchDB from 'pouchdb-browser';
import {config} from '../../../buildconfig';
import type {ReplicatingSyncMode} from '../../../sync/syncMode';
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
if (config.runningUnderTest) {
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
/** Progress payload shared by PouchDB replicate() change events. */
export type ReplicationChangeStats = ChangeSyncInfo['change'];

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

if (config.debugApp) {
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
 * Live PouchDB replication handle returned by {@link createPouchDbReplication}.
 *
 * Either a two-way {@link PouchDB.Replication.Sync} (`syncMode: 'both'`) or a
 * one-way {@link PouchDB.Replication.Replication} for push/pull-only modes.
 */
export type PouchReplicationHandle =
  | PouchDB.Replication.Sync<{}>
  | PouchDB.Replication.Replication<{}>;

/**
 * Normalise PouchDB change events to the shape produced by two-way sync.
 *
 * `PouchDB.sync` emits `{direction, change}`, while one-way `PouchDB.replicate`
 * emits the change stats object directly (no nested `change` property).
 */
export function normalizeChangeSyncInfo(
  info: ChangeSyncInfo | ReplicationChangeStats,
  defaultDirection: 'push' | 'pull'
): ChangeSyncInfo {
  if ('direction' in info && info.change) {
    return {
      direction: info.direction ?? defaultDirection,
      change: info.change,
    };
  }

  return {
    direction: defaultDirection,
    change: info as ReplicationChangeStats,
  };
}

/**
 * PouchDB sync/replicate event surface at runtime.
 *
 * `@types/pouchdb` omits several replication events (e.g. `change`, `active`);
 * see https://pouchdb.com/api.html#sync.
 */
type ReplicationEventEmitter = {
  on(
    event: 'change' | 'paused' | 'active' | 'denied' | 'error',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listener: (...args: any[]) => any
  ): PouchReplicationHandle;
};

function asReplicationEventEmitter(
  handle: PouchReplicationHandle
): ReplicationEventEmitter {
  return handle as unknown as ReplicationEventEmitter;
}

/**
 * Attach replication event handlers to a sync/replicate handle.
 *
 * Shared by all sync modes so callers register handlers once regardless of
 * direction.
 *
 * @param replication The live sync or replicate object from PouchDB
 * @param eventHandlers Optional handlers for replication lifecycle events
 * @returns The same handle with handlers attached (for chaining)
 */
function attachReplicationEventHandlers(
  replication: PouchReplicationHandle,
  eventHandlers: SyncEventHandlers,
  defaultDirection: 'push' | 'pull'
): PouchReplicationHandle {
  let handle: PouchReplicationHandle = replication;

  if (eventHandlers.change) {
    const onChange = eventHandlers.change;
    handle = asReplicationEventEmitter(handle).on(
      'change',
      (info: ChangeSyncInfo | ReplicationChangeStats) => {
        onChange(normalizeChangeSyncInfo(info, defaultDirection));
      }
    );
  }
  if (eventHandlers.paused) {
    handle = asReplicationEventEmitter(handle).on(
      'paused',
      eventHandlers.paused
    );
  }
  if (eventHandlers.active) {
    handle = asReplicationEventEmitter(handle).on(
      'active',
      eventHandlers.active
    );
  }
  if (eventHandlers.denied) {
    handle = asReplicationEventEmitter(handle).on(
      'denied',
      eventHandlers.denied
    );
  }
  if (eventHandlers.error) {
    handle = asReplicationEventEmitter(handle).on('error', eventHandlers.error);
  }
  return handle;
}

/**
 * Creates live replication between the specified local and remote DBs.
 *
 * This is the preferred replication factory: it centralises PouchDB options so
 * callers cannot misconfigure live/retry/batch sizing. Behaviour depends on
 * {@link syncMode}:
 *
 * - **`both`**: two-way sync via `PouchDB.sync` (push + pull), with optional
 *   attachment filtering on the pull side.
 * - **`push`**: one-way replicate local → remote only.
 * - **`pull`**: one-way replicate remote → local only, with optional attachment
 *   filtering on the pull side.
 *
 * Live replication and retry-on-failure are always enabled. When
 * `attachmentDownload` is false, pull replication uses
 * {@link ATTACHMENT_FILTER_CONFIG} so attachments created on other devices are
 * not downloaded (records still sync).
 *
 * @param syncMode Replication direction (`push`, `pull`, or `both`)
 * @param attachmentDownload Download attachments from other devices when pull is active
 * @param localDb The local DB to replicate
 * @param remoteDb The remote DB to replicate
 * @param eventHandlers Optional event handlers for replication events
 *
 * @returns The new live sync/replicate object (with handlers attached)
 */
export function createPouchDbReplication<Content extends {}>({
  syncMode,
  attachmentDownload,
  localDb,
  remoteDb,
  eventHandlers = DEFAULT_SYNC_HANDLERS,
}: {
  syncMode: ReplicatingSyncMode;
  attachmentDownload: boolean;
  localDb: PouchDBWrapper<Content>;
  remoteDb: PouchDB.Database<Content>;
  eventHandlers?: SyncEventHandlers;
}): PouchReplicationHandle {
  // Configure attachment filtering if needed (applies to pull direction only)
  const pullFilter = attachmentDownload ? {} : ATTACHMENT_FILTER_CONFIG;
  const baseOpts: PouchDB.Replication.ReplicateOptions = {
    // Live sync mode (i.e. poll)
    live: true,
    // Retry on fail
    retry: true,
    // Timeout after 15 seconds
    timeout: 15000,
    // Sync batch sizing options
    batch_size: config.pouchBatchSize,
    batches_limit: config.pouchBatchesLimit,
  };

  let replication: PouchReplicationHandle;

  switch (syncMode) {
    case 'both': {
      const options: DBReplicateOptions = {
        ...baseOpts,
        // Push and pull specific options
        push: {
          checkpoint: 'source',
        },
        pull: {
          checkpoint: 'target',
          ...pullFilter,
        },
      };
      // Create the two-way sync object
      replication = PouchDB.sync(localDb.db, remoteDb, options);
      break;
    }
    case 'push':
      replication = PouchDB.replicate(localDb.db, remoteDb, {
        ...baseOpts,
        checkpoint: 'source',
      });
      break;
    case 'pull':
      replication = PouchDB.replicate(remoteDb, localDb.db, {
        ...baseOpts,
        checkpoint: 'target',
        ...pullFilter,
      });
      break;
  }

  const defaultDirection: 'push' | 'pull' =
    syncMode === 'pull' ? 'pull' : 'push';

  return attachReplicationEventHandlers(
    replication,
    eventHandlers,
    defaultDirection
  );
}

/**
 * Creates a new synchronisation (PouchDB.sync) between the specified local and
 * remote DB. This uses the preferred sync options to avoid misconfiguration in
 * caller functions. Two way sync is always enabled, with live and retry. If
 * attachment filter is supplied, the pull sync options are overridden with a
 * filter.
 *
 * @deprecated Use {@link createPouchDbReplication} with `syncMode: 'both'`.
 *
 * @param attachmentDownload Download attachments iff true
 * @param localDb The local DB to sync
 * @param remoteDb The remote DB to sync
 * @param eventHandlers Optional event handlers for sync events
 *
 * @returns The new sync object
 */
export function createPouchDbSync<Content extends {}>(params: {
  attachmentDownload: boolean;
  localDb: PouchDBWrapper<Content>;
  remoteDb: PouchDB.Database<Content>;
  eventHandlers?: SyncEventHandlers;
}): PouchReplicationHandle {
  return createPouchDbReplication({
    syncMode: 'both',
    ...params,
  });
}

/**
 * Fetch full notebook details (including inlined uiSpecification) from the server.
 * Listing comes from GET /api/directory; per-notebook design bundle from here.
 */
export const fetchNotebookDetails = async ({
  token,
  serverUrl,
  projectId,
}: {
  token: string;
  serverUrl: string;
  projectId: string;
}): Promise<
  GetNotebookResponse & ReturnType<typeof projectInformationFromGetNotebook>
> => {
  const url = `${serverUrl}/api/notebooks/${projectId}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(
      `Notebook request failed for ${projectId}: HTTP ${response.status}`
    );
  }
  const notebook = (await response.json()) as GetNotebookResponse;
  const information = projectInformationFromGetNotebook(notebook);
  return {...notebook, ...information};
};

/** @deprecated Use {@link fetchNotebookDetails}. */
export const fetchProjectMetadataAndSpec = fetchNotebookDetails;

/**
 * How the server classifies a notebook that is absent from the active directory
 * listing (`includeArchived=false`). Used to decide immediate archival cleanup
 * vs absent-id streak confirmation.
 */
export type NotebookServerLifecycleProbe =
  | 'active'
  | 'archived'
  | 'missing'
  | 'unreachable';

/**
 * GET `/api/notebooks/:id` for a local notebook missing from the active directory.
 *
 * - `archived`: remove locally on first successful read
 * - `missing`: deleted or no access (401/403/404) — caller applies absent streak
 * - `active`: still exists but not directory-listed (unexpected); keep local copy
 * - `unreachable`: network/other HTTP failure — do not advance absent streak
 */
export async function probeNotebookServerLifecycle({
  projectId,
  serverUrl,
  token,
}: {
  projectId: string;
  serverUrl: string;
  token: string;
}): Promise<NotebookServerLifecycleProbe> {
  const url = `${serverUrl}/api/notebooks/${projectId}`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    return 'unreachable';
  }

  if (
    response.status === 401 ||
    response.status === 403 ||
    response.status === 404
  ) {
    return 'missing';
  }

  if (!response.ok) {
    return 'unreachable';
  }

  const notebook = (await response.json()) as Pick<
    GetNotebookResponse,
    'status'
  >;
  if (notebook.status === ProjectStatus.ARCHIVED) {
    return 'archived';
  }

  return 'active';
}
