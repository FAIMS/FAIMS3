import {
  couchInitialiser,
  initDataDB,
  ProjectDataObject,
  ProjectDocument,
  ProjectStatus,
  ProjectUIModel,
  PublicServerInfo,
} from '@faims3/data-model';
import {
  createAsyncThunk,
  createSelector,
  createSlice,
  PayloadAction,
} from '@reduxjs/toolkit';
import {CONDUCTOR_URLS} from '../../buildconfig';
import {AppDispatch, RootState, store} from '../store';
import {isTokenValid, selectActiveServerId} from './authSlice';
import {compiledSpecService} from './helpers/compiledSpecService';
import {
  buildCompiledSpecId,
  buildPouchIdentifier,
  buildSyncId,
  createLocalPouchDatabase,
  createPouchDbSync,
  createRemotePouchDbFromConnectionInfo,
  fetchProjectMetadataAndSpec,
  getRemoteDatabaseNameFromId,
  SyncEventHandlers,
} from './helpers/databaseHelpers';
import {databaseService} from './helpers/databaseService';

// TYPES
// =====

// Server info
export interface ApiServerInfo {
  // The identity of the server (which is the serverId)
  id: string;
  // The display name for the server
  name: string;
  // The URL of conductor (which presumably we already know if we got this far!)
  conductor_url: string;
  // A description of the server
  description: string;
  // The short-code prefix used/expected by this server
  prefix: string;
}

// Database types
export interface DatabaseAuth {
  // The access token required to talk to this database - this is refreshed
  // when the token is refreshed
  jwtToken: string;
}

export interface DatabaseConnectionConfig extends DatabaseAuth {
  // The complete couch DB URL minus the database name (includes port)
  couchUrl: string;
  // The name of the database
  databaseName: string;
}

/**
 * Represents the current state of a PouchDB sync operation
 */
export interface SyncState {
  /** Current status of the sync operation */
  status: 'initial' | 'active' | 'paused' | 'error' | 'denied';
  /** Timestamp of the last status update */
  lastUpdated: number;
  /** Number of records pending sync */
  pendingRecords: number;
  /** Error message if status is 'error' or 'denied' */
  errorMessage?: string;
  /** Error object if status is 'error' or 'denied' */
  isError?: boolean;
  /** Stats from the most recent change event */
  lastChangeStats?: {
    docsRead: number;
    docsWritten: number;
    direction: 'push' | 'pull';
  };
}

/**
 * This manages a remote couch connection - a remote connection is a combination
 * of the remote database ID (see databaseService to retrieve it), the sync
 * object (which is only instantiated/active if isSyncing = true)
 */
export interface RemoteCouchConnection {
  // ID of the remote DB - use databaseService to fetch
  remoteDbId: string;
  // The sync object ID - use databaseService to fetch - can be undefined if
  // isSyncing = false
  syncId: string | undefined;
  // Sync state
  syncState: SyncState;
  // The configuration for the remote connection e.g. auth, endpoint etc
  connectionConfiguration: DatabaseConnectionConfig;
}
export interface DatabaseConnection {
  // A reference to the local data database - retrieve from databaseService
  localDbId: string;

  // This defines whether the database synchronisation is active
  isSyncing: boolean;

  // Is pouch configured to download attachments? Attachment download is managed
  // through a filter on the sync object
  isSyncingAttachments: boolean;

  // Remote database connection (this is always defined since we will always
  // have a remoteDb even if sync is not active)
  remote: RemoteCouchConnection;
}

// This is metadata which is defined as part of the design file
export interface KnownProjectMetadata {
  // The survey name
  name: string;
  // The description
  description?: string;
}

// This represents the true metadata which is a combination of mandatory + user added
export type ProjectMetadata = KnownProjectMetadata & {[key: string]: any};

// Maps a project ID -> project
export type ProjectIdToProjectMap = {[projectId: string]: Project};

/** This is the subset of project information which is modifiable/trivial */
export interface ProjectInformation {
  // Name of the project
  name: string;

  // This is metadata information about the project
  metadata: ProjectMetadata;

  // The UI Specification which is NOT compiled - see compiledSpecId for the
  // reference to the compiledSpecService instance of the compiled spec.
  rawUiSpecification: ProjectUIModel;

  // What is the status of the project?
  status: ProjectStatus;
}

// A project is a 'notebook'/'survey' - it is relevant to a server, can be
// inactive or active, and was activated by someone. This extends with
// non-trivial or side-effecting elements like database connections and
// activated status
export interface Project extends ProjectInformation {
  // the unique project ID (unique within the server)
  projectId: string;

  // the non-unique name of the project
  name: string;

  // Which server is this in? (including here too since it's helpful)
  serverId: string;

  // Is the project activated? (Use active/deactive to change)
  isActivated: boolean;

  // Data database (if activated is false -> this is undefined)
  database?: DatabaseConnection;

  // [Compiled] Key to get the compiled UI Spec from storage - this should not
  // be persisted/serialised as it has live JS functions in it
  uiSpecificationId: string;
}

export interface Server {
  // What is the URL for the server?
  serverUrl: string;

  // Server unique ID
  serverId: string;

  // Display title
  serverTitle: string;

  // What is the URL of the couch database for this server?
  couchDbUrl?: string;

  // Short code prefix
  shortCodePrefix: string;

  // server description
  description: string;

  // Map from project ID -> Project details
  projects: ProjectIdToProjectMap;
}

// The unique key for a project
export interface ProjectIdentity {
  projectId: string;
  serverId: string;
}

// Map from server ID to server details
export type ServerIdToServerMap = {[serverId: string]: Server};

// The top level project state - servers + initialised flag
export interface ProjectsState {
  servers: ServerIdToServerMap;
  isInitialised: boolean;
}

// UTILITY FUNCTIONS
// =================

// SLICE
// =====

export const initialProjectState: ProjectsState = {
  // initial state is empty
  servers: {},
  // start out uninitialised
  isInitialised: false,
};

const projectsSlice = createSlice({
  name: 'projects',
  initialState: initialProjectState,
  reducers: {
    /**
     * Sets the initialised flag to true
     */
    markInitialised: state => {
      state.isInitialised = true;
    },

    /**
     * Adds a new server - currently this is used only during initialisation but
     * could eventually form a dynamic server management system
     */
    addServer: (
      state,
      action: PayloadAction<{
        serverId: string;
        serverTitle: string;
        serverUrl: string;
        couchDbUrl?: string;
        description: string;
        shortCodePrefix: string;
      }>
    ) => {
      const {
        serverId,
        description,
        shortCodePrefix,
        serverTitle,
        serverUrl,
        couchDbUrl,
      } = action.payload;
      // Create a new server with no projects
      state.servers[serverId] = {
        projects: {},
        couchDbUrl,
        serverId,
        description,
        serverTitle,
        serverUrl,
        shortCodePrefix,
      };
    },

    /**
     * Update modifiable details for an existing server
     */
    updateServerDetails: (
      state,
      action: PayloadAction<{
        serverId: string;
        serverTitle: string;
        serverUrl: string;
        shortCodePrefix: string;
        description: string;
      }>
    ) => {
      const {serverId, description, serverTitle, shortCodePrefix, serverUrl} =
        action.payload;
      if (!state.servers[serverId]) {
        throw Error(`Could not find server with ID: ${serverId}`);
      }

      // Create a new server with no projects
      state.servers[serverId] = {
        // don't update projects
        projects: state.servers[serverId].projects,

        // We don't update the couch DB url as this would require re-creating local connections
        // TODO do we want to enable this kind of update?
        couchDbUrl: state.servers[serverId].couchDbUrl,

        // Other details we overwrite
        serverId,
        serverTitle,
        serverUrl,
        shortCodePrefix,
        description,
      };
    },

    /**
     * Add a new project for an existing server - you must specify the couchDB
     * URL to be used for all databases within this project at this point
     */
    addProject: (
      state,
      action: PayloadAction<
        ProjectInformation & ProjectIdentity & {couchDbUrl: string}
      >
    ) => {
      const payload = action.payload;

      // Identify the server
      const server = serverById(state, payload.serverId);

      if (!server) {
        throw new Error(
          `Cannot add project to non-existent server with ID ${payload.serverId}.`
        );
      }

      // Check if already have project with this ID
      if (server.projects[payload.projectId]) {
        throw new Error(
          `Cannot add project since this server already has project with ID ${payload.projectId}.`
        );
      }

      const compiledSpecId = buildCompiledSpecId({
        projectId: payload.projectId,
        serverId: server.serverId,
      });
      compiledSpecService.compileAndRegisterSpec(
        compiledSpecId,
        payload.rawUiSpecification
      );

      // Update the couch DB URL (since we presume this to be an
      // update/accurate)
      // TODO handle couch DB URLs on a per project basis
      server.couchDbUrl = payload.couchDbUrl;

      // Now we can add one
      server.projects[payload.projectId] = {
        // Project ID and server ID
        projectId: payload.projectId,
        serverId: payload.serverId,

        // Superficial details
        metadata: payload.metadata,
        name: payload.name,

        uiSpecificationId: compiledSpecId,
        rawUiSpecification: payload.rawUiSpecification,

        // Default not activated with no database
        isActivated: false,
        database: undefined,
        status: payload.status,
      };
    },

    /**
     * Remove a project. This involves
     *
     * - remove and close sync
     * - remove and close remote db (pouchDB reference to remote)
     * - destroy, close and remove local db (pouchDB local DB containing data)
     * - deregister compiled spec
     * - remove entry in store
     *
     * NOTE: currently there is no protection against data loss here.
     *
     */
    removeProject: (state, action: PayloadAction<ProjectIdentity>) => {
      const payload = action.payload;

      // Check the server exists
      const server = serverById(state, payload.serverId);
      if (!server) {
        // abort
        throw new Error(
          `Cannot remove project from non-existent server with ID ${payload.serverId}.`
        );
      }

      // Check if project exists
      const project = projectByIdentity(state, payload);
      if (!project) {
        throw new Error(
          `Cannot remove project that does not exist. Server ID: ${payload.serverId}, Project ID: ${payload.projectId}.`
        );
      }

      // If the project is activated, we need to deactivate it first
      if (project.isActivated) {
        // Clean up resources: close and remove databases/syncs
        if (project.database) {
          // If there's a remote connection with sync
          if (project.database.remote) {
            // Close sync (if active/available)
            const syncId = project.database.remote.syncId;
            if (syncId) {
              databaseService.closeAndRemoveSync(syncId);
            }

            // Close remote database
            const remoteDatabaseId = project.database.remote.remoteDbId;
            if (remoteDatabaseId) {
              // NOTE this is an async operation, deletion will not happen immediately
              databaseService.closeAndRemoveRemoteDatabase(remoteDatabaseId);
            }
          }

          // Close and clean local database
          const localDatabaseId = project.database.localDbId;
          if (localDatabaseId) {
            // NOTE that this is an async operation, the deletion will not
            // happen immediately
            databaseService.closeAndRemoveLocalDatabase(localDatabaseId, {
              // For the time being - don't clean up deactivated databases as a last
              // resort data recovery mechanism

              // TODO determine a more suitable approach for validating data is synced to allow true cleanup
              clean: false,
            });
          }
        }

        // Remove compiled spec from service
        compiledSpecService.removeSpec(project.uiSpecificationId);
      }

      // Remove the project from the server's projects map
      delete server.projects[payload.projectId];
    },

    /**
     * Update superficial details of a project (e.g. name, description etc)
     *
     * Will recompile uiSpec
     */
    updateProjectDetails: (
      state,
      action: PayloadAction<
        ProjectInformation & ProjectIdentity & {couchDbUrl: string}
      >
    ) => {
      const payload = action.payload;

      // Identify the server
      const server = serverById(state, payload.serverId);

      if (!server) {
        throw new Error(
          `Cannot add project to non-existent server with ID ${payload.serverId}.`
        );
      }

      // Check if already have project with this ID
      if (!server.projects[payload.projectId]) {
        throw new Error(
          `Cannot update project since it does not exist! Server ID ${payload.serverId}, project ID ${payload.projectId}.`
        );
      }

      const compiledSpecId = buildCompiledSpecId({
        projectId: payload.projectId,
        serverId: server.serverId,
      });
      compiledSpecService.compileAndRegisterSpec(
        compiledSpecId,
        payload.rawUiSpecification
      );

      server.couchDbUrl = payload.couchDbUrl;

      // Now we can update it
      server.projects[payload.projectId] = {
        ...server.projects[payload.projectId],

        // Superficial details updated only! You cannot change activated/sync
        // status here - these are controlled actions
        metadata: payload.metadata,
        uiSpecificationId: compiledSpecId,
        rawUiSpecification: payload.rawUiSpecification,
        status: payload.status,
      };
    },

    /**
     * Record the activation of a new project.
     *
     * This reducer just updates the state after a project has been activated
     * by the activateProject async thunk.  This reducer is not exported and
     * should not be called directly.
     *
     */
    activateProjectSuccess: (
      state,
      action: PayloadAction<ActivateProjectSuccessPayload>
    ) => {
      const {
        project,
        serverId,
        localDatabaseId,
        connectionConfiguration,
        remoteDbId,
        syncId,
      } = action.payload;

      // updates the state with all of this new information
      state.servers[serverId].projects[project.projectId] = {
        // These are retained
        metadata: project.metadata,
        projectId: project.projectId,
        rawUiSpecification: project.rawUiSpecification,
        uiSpecificationId: project.uiSpecificationId,
        serverId: project.serverId,
        status: project.status,
        name: project.name,

        // These are updated
        isActivated: true,
        database: {
          isSyncing: true,
          isSyncingAttachments: false,
          localDbId: localDatabaseId,
          remote: {
            connectionConfiguration,
            syncState: createInitialSyncState(),
            remoteDbId: remoteDbId,
            syncId: syncId,
          },
        },
      };
    },

    /**
     * De-activates an existing (active) project.
     *
     * This involves
     *
     * - destroying the sync object which performs the
     *   synchronisation between the two databases
     * - destroying the remote pouch DB which is a connection point to the
     *   remote data-database
     * - destroying (and cleaning) local pouch DB which stores the data synced
     *   from the remote (and new records)
     * - de-registering the above entries
     * - marking the project as de-activated and updating store state
     *
     */
    deactivateProject: (state, action: PayloadAction<ProjectIdentity>) => {
      const payload = action.payload;

      // Check the server exists
      const server = serverById(state, payload.serverId);
      if (!server) {
        // abort
        throw new Error(
          `You cannot deactivate a project for a server which does not exist. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
        );
      }

      // check the project exists
      const project = projectByIdentity(state, payload);
      if (!project) {
        // abort
        throw new Error(
          `You cannot deactivate a project which does not exist. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
        );
      }

      // check it's already active
      if (!project.isActivated) {
        throw new Error(
          `You cannot deactivate a project which is not already active. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
        );
      }

      // creates and/or links to the local data database
      if (!project.database) {
        throw new Error(
          `Failed to deactivate active project due to missing local database. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
        );
      }
      if (!project.database.remote) {
        throw new Error(
          `Failed to deactivate active project due to missing remote database. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
        );
      }

      // close and remove sync (if it's available)
      const syncId = project.database.remote.syncId;
      if (syncId) {
        databaseService.closeAndRemoveSync(syncId);
      }

      // establish ID of remote DB
      const remoteDatabaseId = project.database.remote.remoteDbId;
      // remove (no need to wipe/clean records)
      // NOTE this is an async operation, deletion may not happen immediately
      databaseService.closeAndRemoveRemoteDatabase(remoteDatabaseId);

      // establish ID of local DB
      const localDatabaseId = project.database.localDbId;
      // wipe and remove local database (cleaning records)
      // NOTE this is an async operation, deletion may not happen immediately
      databaseService.closeAndRemoveLocalDatabase(localDatabaseId, {
        // For the time being - don't clean up deactivated databases as a last
        // resort data recovery mechanism

        // TODO determine a more suitable approach for validating data is synced to allow true cleanup
        clean: false,
      });

      // updates the state with all of this new information
      state.servers[payload.serverId].projects[payload.projectId] = {
        // These are retained
        metadata: project.metadata,
        projectId: project.projectId,
        rawUiSpecification: project.rawUiSpecification,
        uiSpecificationId: project.uiSpecificationId,
        serverId: project.serverId,
        status: project.status,
        name: project.name,

        // These are updated (to indicate de-activation)
        isActivated: false,
        database: undefined,
      };
    },

    /**
     * Updates the database auth status for a given project.
     *  dispatched by the async thunk updateDatabaseCredentials
     *  this reducer just updates the state after the work is done
     */
    updateDatabaseAuthSuccess: (
      state: ProjectsState,
      action: PayloadAction<{
        projectId: string;
        serverId: string;
        connectionConfiguration: DatabaseConnectionConfig;
        remoteDbId: string;
        syncId: string | undefined;
        isSyncing: boolean;
        isSyncingAttachments: boolean;
        localDbId: string;
      }>
    ) => {
      const {
        projectId,
        serverId,
        connectionConfiguration,
        remoteDbId,
        syncId,
        isSyncing,
        isSyncingAttachments,
        localDbId,
      } = action.payload;

      const project = projectByIdentity(state, {projectId, serverId});
      if (!project) {
        console.error(`Project not found: ${projectId} on server ${serverId}`);
        return;
      }

      // updates the state with all of this new information
      state.servers[serverId].projects[projectId] = {
        // These are retained
        metadata: project.metadata,
        projectId: project.projectId,
        rawUiSpecification: project.rawUiSpecification,
        uiSpecificationId: project.uiSpecificationId,
        serverId: project.serverId,
        status: project.status,
        name: project.name,

        // These are updated
        isActivated: true,
        database: {
          isSyncing,
          isSyncingAttachments,
          localDbId,
          remote: {
            connectionConfiguration,
            remoteDbId,
            syncState: createInitialSyncState(),
            syncId,
          },
        },
      };
    },

    // update the state after we have turned off sync for a project
    stopSyncingProjectSuccess: (state, action: PayloadAction<Project>) => {
      // check project/server exists
      const project = action.payload;

      if (!project.database)
        throw new Error('Project database not properly initialised');

      // updates the state to indicate no syncing
      state.servers[project.serverId].projects[project.projectId] = {
        // These are retained
        metadata: project.metadata,
        projectId: project.projectId,
        rawUiSpecification: project.rawUiSpecification,
        uiSpecificationId: project.uiSpecificationId,
        serverId: project.serverId,
        status: project.status,
        name: project.name,

        // Project remains activated, but syncing is stopped
        isActivated: true,
        database: {
          // Update sync state to indicate no syncing
          isSyncing: false,
          // Retain attachment sync setting for when sync is resumed
          isSyncingAttachments: project.database.isSyncingAttachments,
          // Retain local database reference
          localDbId: project.database.localDbId,
          // Retain remote connection info for future re-sync
          remote: {
            // Keep connection configuration for when sync is resumed
            connectionConfiguration:
              project.database.remote.connectionConfiguration,
            remoteDbId: project.database.remote.remoteDbId,
            syncState: project.database.remote.syncState,
            // No sync object when syncing is paused
            syncId: undefined,
          },
        },
      };
    },

    // update the state after we have turned sync back on for a project
    resumeSyncingProjectSuccess: (state, action: PayloadAction<Project>) => {
      // check project/server exists
      const project = action.payload;

      if (!project.database)
        throw new Error('Project database not properly initialised');

      // updates the state with all of this new information
      state.servers[project.serverId].projects[project.projectId] = {
        // These are retained
        metadata: project.metadata,
        projectId: project.projectId,
        rawUiSpecification: project.rawUiSpecification,
        uiSpecificationId: project.uiSpecificationId,
        serverId: project.serverId,
        status: project.status,
        name: project.name,

        // These are updated
        isActivated: true,
        database: {
          // Set syncing to true
          isSyncing: true,
          // Retain attachment sync setting
          isSyncingAttachments: project.database.isSyncingAttachments,
          // Retain local database reference
          localDbId: project.database.localDbId,
          remote: {
            // Keep existing connection configuration
            connectionConfiguration:
              project.database.remote.connectionConfiguration,
            remoteDbId: project.database.remote.remoteDbId,
            syncState: project.database.remote.syncState,
            // Set new sync ID
            syncId: project.database.remote.syncId,
          },
        },
      };
    },

    /**
     * Attachment syncing is managed by a filter which can be applied to the
     * Sync object. This method destroys the existing sync then re-establishes
     * it with the attachment filter active.
     */
    stopSyncingAttachments: (state, action: PayloadAction<ProjectIdentity>) => {
      // check project/server exists
      const payload = action.payload;

      // Check the server exists
      const server = serverById(state, payload.serverId);
      if (!server) {
        // abort
        throw new Error(
          `You cannot disable attachments for a project for a server which does not exist. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
        );
      }

      // check the project exists
      const project = projectByIdentity(state, payload);
      if (!project) {
        // abort
        throw new Error(
          `You cannot disable attachments for a project which does not exist. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
        );
      }

      // check it's already active
      if (!project.isActivated) {
        throw new Error(
          `You cannot disable attachments for an inactive project. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
        );
      }

      // check database and remote are defined
      if (!project.database || !project.database.remote) {
        throw new Error(
          `You cannot disable attachments for a project which has no database object and/or remote connection. Activate it first. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}.`
        );
      }

      // fetch the existing local DB
      const localDb = databaseService.getLocalDatabase(
        project.database.localDbId
      );
      if (!localDb) {
        throw new Error(
          `The local DB with ID ${project.database.localDbId} does not exist, so cannot update connection.`
        );
      }

      // fetch the existing remote DB
      const remoteDb = databaseService.getRemoteDatabase(
        project.database.remote.remoteDbId
      );
      if (!remoteDb) {
        throw new Error(
          `The remote DB with ID ${project.database.remote.remoteDbId} does not exist, so cannot update connection.`
        );
      }

      // cleanup old sync
      let updatedSyncId: undefined | string = undefined;

      // Remove if needed
      const oldSyncId = project.database.remote.syncId;
      if (project.database.isSyncing && oldSyncId) {
        databaseService.closeAndRemoveSync(oldSyncId);

        updatedSyncId = buildSyncId({
          localId: project.database.localDbId,
          remoteId: project.database.remote.remoteDbId,
        });

        const handlers = createSyncStateHandlers(
          payload.projectId,
          payload.serverId,
          store.dispatch
        );
        // creates the sync object (PouchDB.Replication.Sync)
        const sync = createPouchDbSync({
          // STOP syncing attachments
          attachmentDownload: false,
          // local is fine to continue using!
          localDb,
          // reuse existing remote db
          remoteDb,
          eventHandlers: handlers,
        });

        // Register the sync
        databaseService.registerSync(updatedSyncId, sync);
      }

      // updates the state with all of this new information
      state.servers[payload.serverId].projects[payload.projectId] = {
        // These are retained
        metadata: project.metadata,
        projectId: project.projectId,
        rawUiSpecification: project.rawUiSpecification,
        uiSpecificationId: project.uiSpecificationId,
        serverId: project.serverId,
        status: project.status,
        name: project.name,

        // These are updated
        isActivated: true,
        database: {
          // retain
          isSyncing: project.database.isSyncing,
          // This is UPDATED
          isSyncingAttachments: false,
          // This is retained
          localDbId: project.database.localDbId,
          remote: {
            // reuse connection and remote
            connectionConfiguration:
              project.database.remote.connectionConfiguration,
            remoteDbId: project.database.remote.remoteDbId,
            syncState: project.database.remote.syncState,
            // new sync
            syncId: updatedSyncId,
          },
        },
      };
    },

    /**
     * Attachment syncing is managed by a filter which can be applied to the
     * Sync object. This method destroys the existing sync then re-establishes
     * it with the attachment filter not-active.
     */
    startSyncingAttachments: (
      state,
      action: PayloadAction<ProjectIdentity>
    ) => {
      // check project/server exists
      const payload = action.payload;

      // Check the server exists
      const server = serverById(state, payload.serverId);
      if (!server) {
        // abort
        throw new Error(
          `You cannot disable attachments for a project for a server which does not exist. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
        );
      }

      // check the project exists
      const project = projectByIdentity(state, payload);
      if (!project) {
        // abort
        throw new Error(
          `You cannot disable attachments for a project which does not exist. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
        );
      }

      // check it's already active
      if (!project.isActivated) {
        throw new Error(
          `You cannot disable attachments for an inactive project. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
        );
      }

      // check database and remote are defined
      if (!project.database || !project.database.remote) {
        throw new Error(
          `You cannot disable attachments for a project which has no database object and/or remote connection. Activate it first. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}.`
        );
      }

      // fetch the existing local DB
      const localDb = databaseService.getLocalDatabase(
        project.database.localDbId
      );
      if (!localDb) {
        throw new Error(
          `The local DB with ID ${project.database.localDbId} does not exist, so cannot update connection.`
        );
      }

      // fetch the existing remote DB
      const remoteDb = databaseService.getRemoteDatabase(
        project.database.remote.remoteDbId
      );
      if (!remoteDb) {
        throw new Error(
          `The remote DB with ID ${project.database.remote.remoteDbId} does not exist, so cannot update connection.`
        );
      }

      // cleanup old sync
      let updatedSyncId: undefined | string = undefined;

      // Remove if needed
      const oldSyncId = project.database.remote.syncId;
      if (project.database.isSyncing && oldSyncId) {
        databaseService.closeAndRemoveSync(oldSyncId);

        updatedSyncId = buildSyncId({
          localId: project.database.localDbId,
          remoteId: project.database.remote.remoteDbId,
        });

        const handlers = createSyncStateHandlers(
          payload.projectId,
          payload.serverId,
          store.dispatch
        );
        // creates the sync object (PouchDB.Replication.Sync)
        const sync = createPouchDbSync({
          // START syncing attachments
          attachmentDownload: true,
          // local is fine to continue using!
          localDb,
          // reuse existing remote db
          remoteDb,
          eventHandlers: handlers,
        });

        // Register the sync
        databaseService.registerSync(updatedSyncId, sync);
      }

      // updates the state with all of this new information
      state.servers[payload.serverId].projects[payload.projectId] = {
        // These are retained
        metadata: project.metadata,
        projectId: project.projectId,
        rawUiSpecification: project.rawUiSpecification,
        uiSpecificationId: project.uiSpecificationId,
        serverId: project.serverId,
        status: project.status,
        name: project.name,

        // These are updated
        isActivated: true,
        database: {
          // retained
          isSyncing: project.database.isSyncing,
          // This is UPDATED
          isSyncingAttachments: true,
          // This is retained
          localDbId: project.database.localDbId,
          remote: {
            // reuse connection and remote
            connectionConfiguration:
              project.database.remote.connectionConfiguration,
            remoteDbId: project.database.remote.remoteDbId,
            syncState: project.database.remote.syncState,
            // new sync
            syncId: updatedSyncId,
          },
        },
      };
    },

    /**
     * Updates the sync state for a specific project
     */
    setSyncState: (
      state,
      action: PayloadAction<
        ProjectIdentity & {
          syncState: Partial<SyncState>;
        }
      >
    ) => {
      const {projectId, serverId, syncState} = action.payload;

      // Check the server exists
      const server = serverById(state, serverId);
      if (!server) {
        throw new Error(
          `Cannot update sync state for non-existent server with ID ${serverId}`
        );
      }

      // Check the project exists
      const project = server.projects[projectId];
      if (!project) {
        throw new Error(
          `Cannot update sync state for non-existent project with ID ${projectId}`
        );
      }

      // Check project is activated and has database with remote
      if (
        !project.isActivated ||
        !project.database ||
        !project.database.remote
      ) {
        throw new Error(
          `Cannot update sync state for project that is not properly activated with remote database. Project ID: ${projectId}`
        );
      }

      // Create a new sync state if none exists, otherwise update existing
      const currentSyncState =
        project.database.remote.syncState || createInitialSyncState();

      // Update the sync state with the provided changes and set lastUpdated
      server.projects[projectId].database!.remote.syncState = {
        ...currentSyncState,
        ...syncState,
        lastUpdated: Date.now(),
      };
    },
  },
});

// STATE HELPERS
// =============

/**
 * Returns server if present
 * @param state The projects state
 * @param serverId Server ID
 * @returns Server if present or undefined
 */
export const serverById = (
  state: ProjectsState,
  serverId: string
): Server | undefined => state.servers[serverId] ?? undefined;

/**
 * Returns server if present
 * @param state The projects state
 * @param serverId Server ID
 * @returns Server if present or undefined
 */
export const projectByIdentity = (
  state: ProjectsState,
  identity: ProjectIdentity
): Project | undefined =>
  state.servers[identity.serverId]?.projects[identity.projectId] ?? undefined;

/**
 * Gets all active data DBs
 */
export function getAllDataDbs(
  state: RootState
): PouchDB.Database<ProjectDataObject>[] {
  const databases: PouchDB.Database<ProjectDataObject>[] = [];
  for (const server of Object.values(state.projects.servers)) {
    for (const project of Object.values(server.projects)) {
      if (project.isActivated && project.database?.localDbId) {
        const db = databaseService.getLocalDatabase(project.database.localDbId);
        if (db) {
          databases.push(db);
        } else {
          console.warn(
            `Project store includes activated project with non registered local database. Project ID ${project.projectId}`
          );
        }
      }
    }
  }

  return databases;
}

// SELECTORS
// =========

/**
 * Returns all projects from all servers as a flat array.
 * Memoized to prevent unnecessary re-renders.
 *
 * @param state Redux state
 * @returns Array of all projects
 */
export const selectAllProjects = createSelector(
  (state: RootState) => state.projects.servers,
  servers => {
    let allProjects: Project[] = [];
    for (const server of Object.values(servers)) {
      allProjects = allProjects.concat(Object.values(server.projects));
    }
    return allProjects;
  }
);

/**
 * Returns all servers as an array.
 * Memoized to prevent unnecessary re-renders.
 *
 * @param state Redux state
 * @returns Array of all servers
 */
export const selectServers = createSelector(
  (state: RootState) => state.projects.servers,
  servers => Object.values(servers)
);

/**
 * Finds a project by its ID across all servers.
 * Memoized to prevent unnecessary re-renders.
 *
 * @param state Redux state
 * @param projectId ID of the project to find
 * @returns The found project or undefined
 */
export const selectProjectById = createSelector(
  [
    (state: RootState) => state.projects.servers,
    (_, projectId: string) => projectId,
  ],
  (servers, projectId): Project | undefined => {
    // Loop through all servers
    for (const server of Object.values(servers)) {
      // Check if this server has the project
      const project = server.projects[projectId];
      if (project) {
        return project;
      }
    }
    // Project not found in any server
    return undefined;
  }
);

/**
 * Returns all projects for a specific server as an array.
 * Memoized to prevent unnecessary re-renders.
 *
 * @param state Redux state
 * @param serverId ID of the server to get projects from
 * @returns Array of all projects for the specified server
 */
export const selectProjectsByServerId = createSelector(
  [
    (state: RootState) => state.projects.servers,
    (_, serverId: string) => serverId,
  ],
  (servers, serverId): Project[] => {
    const server = servers[serverId];
    if (!server) {
      return [];
    }
    return Object.values(server.projects);
  }
);

/**
 * Combined selector that gets projects for the active server.
 * This avoids the need to use two separate selectors in components.
 */
export const selectActiveServerProjects = createSelector(
  [
    (state: RootState) => state.projects.servers,
    (state: RootState) => selectActiveServerId(state),
  ],
  (servers, activeServerId): Project[] => {
    if (!activeServerId || !servers[activeServerId]) {
      return [];
    }
    return Object.values(servers[activeServerId].projects);
  }
);

// THUNKS
// ======

// These are actions which can be dispatched which can dispatch other store
// actions safely and run asynchronous operations.

/**
 * Dispatches a set of actions which update the connection of all projects
 * within the given server with the specified token
 */
export const updateDatabaseCredentials = createAsyncThunk<
  void,
  {token: string; serverId: string}
>('projects/updateDatabaseCredentials', async (args, {dispatch, getState}) => {
  // cast and get state
  const state = (getState() as RootState).projects;
  const appDispatch = dispatch as AppDispatch;
  const {token, serverId} = args;

  // Check the server exists
  const server = serverById(state, serverId);
  if (!server) {
    // abort
    throw new Error(
      `You cannot refresh credentials for a server which does not exist. Server ID: ${serverId}.`
    );
  }

  // For each project in this server, if it is active, update it's token
  for (const project of Object.values(server.projects)) {
    if (project.isActivated && project.database) {
      try {
        // Check the couch DB url has been populated
        if (!server.couchDbUrl) {
          // abort
          throw new Error(
            `Cannot update connection when we don't know the couchDBUrl. Server ID: ${server.serverId}. Project ID: ${project.projectId}`
          );
        }

        // check database and remote are defined
        if (!project.database || !project.database.remote) {
          throw new Error(
            `You cannot update the connection of a project which has no database object and/or remote connection. Activate it first. Server ID: ${server.serverId}. Project ID: ${project.projectId}.`
          );
        }
        // check it's already active
        if (!project.isActivated) {
          throw new Error(
            `You cannot update the connection of an inactive project. Server ID: ${server.serverId}. Project ID: ${project.projectId}`
          );
        }

        // Step 1: Clean up old database connections and sync
        // wait for these to complete before we make anything new
        const oldSyncId = project.database.remote.syncId;
        // Only update sync object if we are syncing
        if (oldSyncId) {
          await databaseService.closeAndRemoveSync(oldSyncId);
        }

        // cleanup old remote DB
        const oldRemoteId = project.database.remote.remoteDbId;
        await databaseService.closeAndRemoveRemoteDatabase(oldRemoteId);

        // Step 2: Get local DB reference
        const localDb = databaseService.getLocalDatabase(
          project.database.localDbId
        );
        if (!localDb) {
          throw new Error(
            `The local DB with ID ${project.database.localDbId} does not exist for project ${project.projectId}`
          );
        }

        // Step 3: Create new connection configuration
        const connectionConfiguration: DatabaseConnectionConfig = {
          // push in the specified jwt
          jwtToken: token,
          // these are not configurable from this thunk
          couchUrl: server.couchDbUrl || '',
          databaseName: getRemoteDatabaseNameFromId({
            projectId: project.projectId,
          }),
        };

        // Step 4: Create new remote database
        const {db: remoteDb, id: remoteDbId} =
          createRemotePouchDbFromConnectionInfo<ProjectDataObject>(
            connectionConfiguration
          );
        databaseService.registerRemoteDatabase(remoteDbId, remoteDb);

        // Step 5: Create new sync if needed
        let updatedSyncId: string | undefined = undefined;
        if (project.database.isSyncing) {
          const handlers = createSyncStateHandlers(
            project.projectId,
            project.serverId,
            store.dispatch
          );
          const sync = createPouchDbSync({
            // re-use existing attachment sync setting
            attachmentDownload: project.database.isSyncingAttachments,
            // use the same local database
            localDb: localDb,
            remoteDb,
            eventHandlers: handlers,
          });
          // register the sync
          updatedSyncId = buildSyncId({
            localId: project.database.localDbId,
            remoteId: remoteDbId,
          });
          databaseService.registerSync(updatedSyncId, sync);
        }

        // Step 6: Update Redux state with new configuration
        appDispatch(
          updateDatabaseAuthSuccess({
            projectId: project.projectId,
            serverId,
            connectionConfiguration,
            remoteDbId,
            syncId: updatedSyncId,
            isSyncing: project.database.isSyncing,
            isSyncingAttachments: project.database.isSyncingAttachments,
            localDbId: project.database.localDbId,
          })
        );
      } catch (error) {
        console.error(
          `Failed to update database credentials for project ${project.projectId}:`,
          error
        );
        // Optionally dispatch an error action or continue with other projects
        // You might want to collect errors and handle them appropriately
      }
    }
  }
});

/**
 * Activates an existing project
 *
 * This involves
 *
 * - creating local pouch DB which stores the data synced from the remote
 *   (and new records)
 * - creating the remote pouch DB which is a connection point to the remote
 *   data-database
 * - creating the sync object which performs the synchronisation between the
 *   two databases
 * - registering the above non-serialisable objects into databaseService
 * - marking the project as activated and updating store state
 * - inclusion of design documents
 *
 */
export const activateProject = createAsyncThunk<
  void,
  ProjectIdentity & DatabaseAuth
>('projects/activateProject', async (payload, {dispatch, getState}) => {
  // First, activate the project, then add the design docs (synchronous)
  //dispatch(activateProjectSync(payload));

  const state = (getState() as RootState).projects;

  // below is the former content of the activateProjectSync reducer, moved here because
  // it now involves async actions

  // Check the server exists
  const server = serverById(state, payload.serverId);
  if (!server) {
    // abort
    throw new Error(
      `You cannot activate a project for a server which does not exist. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
    );
  }

  // Check the couch DB url has been populated
  if (!server.couchDbUrl) {
    // abort
    throw new Error(
      `Cannot activate when we don't know the couchDBUrl. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
    );
  }

  // check the project exists
  const project = projectByIdentity(state, payload);
  if (!project) {
    // abort
    throw new Error(
      `You cannot activate a project which does not exist. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
    );
  }

  // check it's not already active
  if (project.isActivated) {
    throw new Error(
      `You cannot activate a project which is already active. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
    );
  }

  // build the connection info
  const connectionConfiguration: DatabaseConnectionConfig = {
    // push in the specified jwt
    jwtToken: payload.jwtToken,
    couchUrl: server.couchDbUrl,
    databaseName: getRemoteDatabaseNameFromId({
      projectId: project.projectId,
    }),
  };

  // creates and/or links to the local data database
  const localDatabaseId = buildPouchIdentifier({
    projectId: payload.projectId,
    serverId: payload.serverId,
  });
  const localDb = createLocalPouchDatabase<ProjectDataObject>({
    id: localDatabaseId,
  });
  await databaseService.registerLocalDatabase(localDatabaseId, localDb);

  // creates the remote database (pouch remote)
  const {db: remoteDb, id: remoteDbId} =
    createRemotePouchDbFromConnectionInfo<ProjectDataObject>(
      connectionConfiguration
    );
  await databaseService.registerRemoteDatabase(remoteDbId, remoteDb);

  // creates the sync object (PouchDB.Replication.Sync)
  const handlers = createSyncStateHandlers(
    payload.projectId,
    payload.serverId,
    store.dispatch
  );
  const sync = createPouchDbSync({
    attachmentDownload: false,
    localDb,
    remoteDb,
    eventHandlers: handlers,
  });
  const syncId = buildSyncId({
    localId: localDatabaseId,
    remoteId: remoteDbId,
  });
  await databaseService.registerSync(syncId, sync);

  // now call the reducer to update the state
  dispatch(
    activateProjectSuccess({
      project,
      serverId: server.serverId,
      localDatabaseId,
      connectionConfiguration,
      remoteDbId,
      syncId,
    })
  );

  // Perform async initialisation outside of reducer
  await couchInitialiser({
    db: localDb,
    config: {forceWrite: true, applyPermissions: false},
    content: initDataDB({projectId: payload.projectId}),
  });
});

interface ActivateProjectSuccessPayload {
  project: Project;
  serverId: string;
  localDatabaseId: string;
  connectionConfiguration: DatabaseConnectionConfig;
  remoteDbId: string;
  syncId: string;
}

/**
 * Initialises servers from the specified conductor URLs.
 * Creates the server if it doesn't exist, otherwise updates details.
 */
export const initialiseServers = createAsyncThunk<void>(
  'projects/initialiseServers',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (_, {dispatch, getState}) => {
    // cast and get state
    const state = getState() as RootState;
    const projectState = state.projects;
    const appDispatch = dispatch as AppDispatch;

    // for each URL in the conductor URLs - fetch directory
    const discoveredServers: PublicServerInfo[] = [];
    for (const conductorUrl of CONDUCTOR_URLS) {
      // firstly - try and call the info endpoint
      await fetch(`${conductorUrl}/api/info`, {})
        .then(response => response.json())
        .then(info => {
          discoveredServers.push(info as PublicServerInfo);
        });
    }

    for (const apiServerInfo of discoveredServers) {
      // pull out the server ID
      const serverId = apiServerInfo.id;

      // see if we already have that server
      const existingServer = serverById(projectState, serverId);
      if (existingServer) {
        // Update
        appDispatch(
          updateServerDetails({
            serverId,
            serverTitle: apiServerInfo.name,
            serverUrl: apiServerInfo.conductor_url,
            shortCodePrefix: apiServerInfo.prefix,
            description: apiServerInfo.description,
          })
        );
      } else {
        // Create
        appDispatch(
          addServer({
            serverId,
            serverTitle: apiServerInfo.name,
            serverUrl: apiServerInfo.conductor_url,
            shortCodePrefix: apiServerInfo.prefix,
            // We don't know this yet - it's considered sensitive so we need authentication.
            couchDbUrl: undefined,
            description: apiServerInfo.description,
          })
        );
      }
    }
  }
);

/**
 * Initialises projects for the specified server. Merges superficial details for
 * existing projects, creates new ones for new.
 *
 * Expects there to be a logged in active user for the given server.
 *
 * Expects that the state knows about this server.
 *
 * Also updates the couchDBUrl - warning if there is a difference between
 * discovered project couchDB urls.
 *
 * TODO consider deletion - i.e. what happens if the server removes a project?
 */
export const initialiseProjects = createAsyncThunk<void, {serverId: string}>(
  'projects/initialiseProjects',
  async (args, {dispatch, getState}) => {
    // cast and get state
    const state = getState() as RootState;
    const projectState = state.projects;
    const authState = state.auth;
    const appDispatch = dispatch as AppDispatch;
    const {serverId} = args;

    // Get server and check we know about it
    const server = serverById(projectState, serverId);
    if (!server) {
      throw new Error(
        `Cannot initialise projects for missing server: ${serverId}.`
      );
    }

    // Try and find the best possible user to fetch with
    const activeUser = authState.activeUser;
    let token: string | undefined = undefined;

    // Try the active user - this is the best bet
    if (activeUser && activeUser.serverId === server.serverId) {
      if (!authState.isAuthenticated) {
        // This means we have an active user matching the server but they
        // are logged out! Abort.
        throw new Error(
          `You cannot refresh the project list for a logged out active user. Server ID ${serverId}.`
        );
      } else {
        token = activeUser.token;
      }
    }

    if (!token) {
      const serverUsers = authState.servers[serverId]?.users ?? {};
      for (const user of Object.values(serverUsers)) {
        // Found a nice valid token - lucky!
        if (isTokenValid(user)) {
          token = user.token;
          break;
        } else {
          // Didn't find one
          continue;
        }
      }
    }

    if (!token) {
      // Failed to find any token to use for this server - the user needs to
      // login
      throw new Error(
        `Could not find a suitable active token for the server ${serverId}.`
      );
    }

    // Now we have a token that is active - so let's fetch the directory (which
    // lists projects)
    let directoryResults: ProjectDocument[] = [];
    await fetch(`${server.serverUrl}/api/directory`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(response => response.json())
      .then(rawDirectory => {
        directoryResults = rawDirectory as ProjectDocument[];
      })
      .catch(e => {
        console.warn(
          `Directory request failed despite valid token. Server ID ${serverId}. URL: ${server.serverUrl}. ${e}`
        );
      });

    // Now for each result, merge details
    for (const details of directoryResults) {
      const projectId = details._id;
      let meta = undefined;
      try {
        // compile the spec here - it's only recompiled on refresh
        meta = await fetchProjectMetadataAndSpec({
          compile: false,
          projectId: projectId,
          serverUrl: server.serverUrl,
          token,
        });
      } catch (e) {
        console.warn(
          `Failed to get metadata from API for project ${projectId}.`
        );
        console.error(e);
      }

      // See if we have an existing matching project
      const project = projectByIdentity(projectState, {
        projectId,
        serverId,
      });

      if (!details.dataDb?.base_url) {
        throw new Error(
          'Could not initialise from server as the base URL for the couch DB was not defined.'
        );
      }

      if (!project) {
        if (!meta) {
          // noop here since we don't have mandatory metadata!
          console.warn(
            `Failed to get metadata from API for project ${projectId} which doesn't exist yet - minimum sufficient information not known so we won't show this record.`
          );
          continue;
        }

        // create
        appDispatch(
          addProject({
            // Name is included in the GetNotebookResponse
            name: meta.name,
            metadata: meta.metadata as ProjectMetadata,
            projectId,
            serverId,
            rawUiSpecification: meta.decodedSpec,
            couchDbUrl: details.dataDb.base_url,
            status: meta.status,
          })
        );
      } else {
        // update existing record
        appDispatch(
          updateProjectDetails({
            // Name can't change atm but might as well update it if present
            name: meta?.name ?? project.name,
            metadata:
              (meta?.metadata as ProjectMetadata | undefined) ??
              project.metadata,
            projectId: projectId,
            serverId,
            rawUiSpecification: meta?.decodedSpec ?? project.rawUiSpecification,
            couchDbUrl: details.dataDb.base_url,
            status: meta?.status ?? project.status,
          })
        );
      }
    }
  }
);

/**
 * Combines initialisation of all servers' projects.
 */
export const initialiseAllProjects = createAsyncThunk<void>(
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  'projects/initialiseAllProjects',
  async (_, {dispatch, getState}) => {
    // cast and get state
    const state = getState() as RootState;
    const projectState = state.projects;
    const appDispatch = dispatch as AppDispatch;

    // dispatch update to all projects
    for (const server of Object.values(projectState.servers)) {
      appDispatch(initialiseProjects({serverId: server.serverId}));
    }
  }
);

/**
 * A syncing database is one where the sync object exists between the local
 * and remote pouch DBs. This stops this sync by destroying this sync
 * object. Updates databaseService registrations and store states.
 */
export const stopSyncingProject = createAsyncThunk<void, ProjectIdentity>(
  'projects/stopSyncingProject',
  async (payload, {dispatch, getState}) => {
    const state = getState() as RootState;
    const projectState = state.projects;

    // Check the server exists
    const server = serverById(projectState, payload.serverId);
    if (!server) {
      // abort
      throw new Error(
        `You cannot stop syncing a project for a server which does not exist. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
      );
    }

    // check the project exists
    const project = projectByIdentity(projectState, payload);
    if (!project) {
      // abort
      throw new Error(
        `You cannot stop syncing a project which does not exist. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
      );
    }

    // check it's already active
    if (!project.isActivated) {
      throw new Error(
        `You cannot stop syncing an inactive project. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
      );
    }

    // check database and remote are defined
    if (!project.database || !project.database.remote) {
      throw new Error(
        `You cannot stop syncing a project which has no database object and/or remote connection. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}.`
      );
    }

    // If already not syncing, nothing to do
    if (!project.database.isSyncing) {
      return;
    }

    // cleanup existing sync
    const syncId = project.database.remote.syncId;
    if (!syncId) {
      throw new Error(
        `Failed to stop syncing project due to missing sync. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
      );
    }
    // async...
    await databaseService.closeAndRemoveSync(syncId);

    // Create updated project with new sync state
    const updatedProject: Project = {
      ...project,
      database: {
        ...project.database,
        isSyncing: false,
        remote: {
          ...project.database.remote,
        },
      },
    };

    // update store
    dispatch(stopSyncingProjectSuccess(updatedProject));
  }
);

/**
 * A syncing database is one where the sync object exists between the local
 * and remote pouch DBs. This stops resumes this sync by establishing this
 * sync object. Updates databaseService registrations and store states.
 */
export const resumeSyncingProject = createAsyncThunk<void, ProjectIdentity>(
  'projects/resumeSyncingProject',
  async (payload, {dispatch, getState}) => {
    const state = getState() as RootState;
    const projectState = state.projects;

    console.log('resumeSyncingProject', payload);

    // Check the server exists
    const server = serverById(projectState, payload.serverId);
    if (!server) {
      // abort
      throw new Error(
        `You cannot resume syncing a project for a server which does not exist. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
      );
    }

    // check the project exists
    const project = projectByIdentity(projectState, payload);
    if (!project) {
      // abort
      throw new Error(
        `You cannot resume syncing a project which does not exist. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
      );
    }

    // check it's already active
    if (!project.isActivated) {
      throw new Error(
        `You cannot resume syncing an inactive project. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
      );
    }

    // check database and remote are defined
    if (!project.database || !project.database.remote) {
      throw new Error(
        `You cannot resume syncing a project which has no database object and/or remote connection. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}.`
      );
    }

    // If already syncing, nothing to do
    if (project.database.isSyncing) {
      return;
    }

    // fetch the existing local DB
    const localDb = databaseService.getLocalDatabase(
      project.database.localDbId
    );
    if (!localDb) {
      throw new Error(
        `The local DB with ID ${project.database.localDbId} does not exist, so cannot resume syncing.`
      );
    }

    // fetch the existing remote DB
    const remoteDb = databaseService.getRemoteDatabase(
      project.database.remote.remoteDbId
    );
    if (!remoteDb) {
      throw new Error(
        `The remote DB with ID ${project.database.remote.remoteDbId} does not exist, so cannot resume syncing.`
      );
    }

    const handlers = createSyncStateHandlers(
      payload.projectId,
      payload.serverId,
      store.dispatch
    );
    // creates the sync object (PouchDB.Replication.Sync)
    const sync = createPouchDbSync({
      // Use existing setting for attachments
      attachmentDownload: project.database.isSyncingAttachments,
      // Use existing local DB
      localDb,
      // Use existing remote DB
      remoteDb,
      eventHandlers: handlers,
    });

    // Register the sync
    const syncId = buildSyncId({
      localId: project.database.localDbId,
      remoteId: project.database.remote.remoteDbId,
    });
    await databaseService.registerSync(syncId, sync);

    // Create updated project with new sync state
    const updatedProject: Project = {
      ...project,
      database: {
        ...project.database,
        isSyncing: true,
        remote: {
          ...project.database.remote,
          syncId: syncId,
        },
      },
    };

    dispatch(resumeSyncingProjectSuccess(updatedProject));
  }
);

/**
 * As part of initialisation, rebuilds and registers all databases (local,
 * remote) and sync objects, based on the current store configuration.
 *
 * Does not make any change to store state. Hence, it is not a reducer.
 */
export const rebuildDbs = async (
  state: Readonly<ProjectsState>
): Promise<void> => {
  // For all DBs in the project, create local, sync and remote as configured
  for (const server of Object.values(state.servers)) {
    for (const project of Object.values(server.projects)) {
      // We have a server/project
      // Now determine what we need to build
      if (project.isActivated) {
        if (project.database) {
          // here we already have stuff ready to go (config etc)
          const dbInfo = project.database;

          // First - build the local DB
          const localDb = createLocalPouchDatabase<ProjectDataObject>({
            id: dbInfo.localDbId,
          });
          // Setup design documents and permissions for local data DB
          await couchInitialiser({
            content: initDataDB({projectId: project.projectId}),
            db: localDb,
            config: {applyPermissions: false, forceWrite: true},
          });
          databaseService.registerLocalDatabase(dbInfo.localDbId, localDb, {
            tolerant: true,
          });

          // Next - setup the remote if we need it
          if (dbInfo.remote) {
            // creates the remote database (pouch remote)
            const {db: remoteDb, id: remoteDbId} =
              createRemotePouchDbFromConnectionInfo<ProjectDataObject>(
                dbInfo.remote.connectionConfiguration
              );
            databaseService.registerRemoteDatabase(remoteDbId, remoteDb, {
              tolerant: true,
            });

            // and the sync (if needed)
            if (dbInfo.isSyncing && dbInfo.remote.syncId) {
              const handlers = createSyncStateHandlers(
                project.projectId,
                project.serverId,
                store.dispatch
              );
              // creates the sync object (PouchDB.Replication.Sync)
              const sync = createPouchDbSync({
                attachmentDownload: dbInfo.isSyncingAttachments,
                localDb,
                remoteDb,
                eventHandlers: handlers,
              });
              await databaseService.registerSync(dbInfo.remote.syncId, sync, {
                tolerant: true,
              });
            }
          }
          // otherwise we are all good - just local db needed
        } else {
          // This is weird - we have an activated survey but the database
          // object is missing TODO determine behaviour
        }
      }
    }
  }
};

/**
 * Iterates through all servers and projects and compiles the spec.
 *
 * Compiled specs are saved in a separate store due to them containing
 * unserialisable JS snippets.
 */
export const compileSpecs = (state: Readonly<ProjectsState>): void => {
  // For all specs in the project - compile and store
  for (const server of Object.values(state.servers)) {
    for (const project of Object.values(server.projects)) {
      compiledSpecService.compileAndRegisterSpec(
        project.uiSpecificationId,
        project.rawUiSpecification
      );
    }
  }
};

/**
 * Creates an initial sync state
 */
export function createInitialSyncState(): SyncState {
  return {
    status: 'initial',
    lastUpdated: Date.now(),
    pendingRecords: 0,
  };
}

/**
 * Creates event handlers that dispatch setSyncState actions
 *
 * @param projectId ID of the project this sync belongs to
 * @param serverId ID of the server this project belongs to
 * @param dispatch Redux dispatch function
 * @returns Event handlers that dispatch sync state updates
 */
export function createSyncStateHandlers(
  projectId: string,
  serverId: string,
  dispatch: AppDispatch
): SyncEventHandlers {
  return {
    active: () => {
      dispatch(
        setSyncState({
          projectId,
          serverId,
          syncState: {
            status: 'active',
            isError: false,
          },
        })
      );
    },

    change: info => {
      dispatch(
        setSyncState({
          projectId,
          serverId,
          syncState: {
            status: 'active',
            pendingRecords: info.change.pending,
            isError: false,
            lastChangeStats: {
              docsRead: info.change.docs_read,
              docsWritten: info.change.docs_written,
              direction: info.direction,
            },
          },
        })
      );
    },

    paused: err => {
      if (err) {
        dispatch(
          setSyncState({
            projectId,
            serverId,
            syncState: {
              status: 'error',
              errorMessage: err.message,
              isError: true,
            },
          })
        );
      } else {
        dispatch(
          setSyncState({
            projectId,
            serverId,
            syncState: {
              status: 'paused',
              isError: false,
            },
          })
        );
      }
    },

    denied: err => {
      dispatch(
        setSyncState({
          projectId,
          serverId,
          syncState: {
            status: 'denied',
            errorMessage: err.message,
            isError: true,
          },
        })
      );
    },

    error: err => {
      dispatch(
        setSyncState({
          projectId,
          serverId,
          syncState: {
            status: 'error',
            errorMessage: err.message,
            isError: true,
          },
        })
      );
    },
  };
}

// Private reducers
const {
  activateProjectSuccess,
  stopSyncingProjectSuccess,
  resumeSyncingProjectSuccess,
} = projectsSlice.actions;

// Public reducers
export const {
  addProject,
  addServer,
  startSyncingAttachments,
  stopSyncingAttachments,
  removeProject,
  updateDatabaseAuthSuccess,
  updateProjectDetails,
  updateServerDetails,
  markInitialised,
  deactivateProject,
  setSyncState,
} = projectsSlice.actions;

export default projectsSlice.reducer;
