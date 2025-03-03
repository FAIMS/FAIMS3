import {EncodedProjectUIModel, ProjectUIModel} from '@faims3/data-model';
import PouchDB from 'pouchdb-browser';
import {
  POUCH_BATCH_SIZE,
  POUCH_BATCHES_LIMIT,
  RUNNING_UNDER_TEST,
} from '../../../buildconfig';
import {compileUiSpecConditionals} from '../../../uiSpecification';
import {
  DatabaseConnectionConfig,
  ProjectIdentity,
  ProjectMetadata,
} from '../projectSlice';

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
}): PouchDB.Database<Content> {
  return new PouchDB<Content>(id, LOCAL_POUCH_OPTIONS);
}

/**
 * Creates a PouchDB.Database used to access a remote Couch/Pouch instance
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

  // Derivce the connection string (includes port if needed)
  const dbConnectionString = couchUrl.endsWith('/')
    ? couchUrl + databaseName
    : couchUrl + '/' + databaseName;

  return {
    db: new PouchDB(dbConnectionString, pouchOptions),
    id: dbConnectionString,
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
 *
 * @returns The new sync object
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

  return PouchDB.sync(localDb, remoteDb, options)
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
    });
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
}): Promise<{uiSpec: ProjectUIModel; metadata: ProjectMetadata}> => {
  const url = `${serverUrl}/api/notebooks/${projectId}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const notebook = await response.json();

  // TODO runtime validation. This is a dangerous assumption! This should do a
  // Zod model validation.
  const metadata = notebook.metadata as ProjectMetadata;
  const rawUiSpec = notebook['ui-specification'] as EncodedProjectUIModel;
  const uiSpec = {
    _id: rawUiSpec._id,
    _rev: rawUiSpec._rev,
    fields: rawUiSpec.fields,
    views: rawUiSpec.fviews,
    viewsets: rawUiSpec.viewsets,
    visible_types: rawUiSpec.visible_types,
  };
  if (compile) {
    compileUiSpecConditionals(uiSpec);
  }
  return {metadata, uiSpec};
};
