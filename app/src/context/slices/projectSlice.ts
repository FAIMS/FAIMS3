import {
  NonUniqueProjectID,
  PossibleConnectionInfo,
  ProjectDataObject,
  ProjectUIModel,
} from '@faims3/data-model';
import {
  createAsyncThunk,
  createSelector,
  createSlice,
  PayloadAction,
} from '@reduxjs/toolkit';
import {CONDUCTOR_URLS} from '../../buildconfig';
import {AppDispatch, RootState} from '../store';
import {isTokenValid} from './authSlice';
import {compiledSpecService} from './helpers/compiledSpecService';
import {
  buildPouchIdentifier,
  createLocalPouchDatabase,
  createPouchDbSync,
  createRemotePouchDbFromConnectionInfo,
  fetchProjectMetadataAndSpec,
  getRemoteDatabaseNameFromId,
} from './helpers/databaseHelpers';
import {databaseService} from './helpers/databaseService';

export const buildSyncId = ({
  localId,
  remoteId,
}: {
  localId: string;
  remoteId: string;
}): string => {
  return `${localId}-${remoteId}`;
};

export const buildCompiledSpecId = (id: ProjectIdentity): string => {
  return `${id.serverId}-${id.projectId}`;
};

// TODO move this into a store

// TYPES
// =====

// Server info
export interface ApiServerInfo {
  id: string;
  name: string;
  conductor_url: string;
  description: string;
  prefix: string;
}

// Database types

// We connect to databases with a JWT
export interface DatabaseAuth {
  jwtToken: string;
}

export interface DatabaseConnectionConfig {
  // The complete couch DB URL minus the database name (includes port)
  couchUrl: string;
  // The name of the database
  databaseName: string;
  // The JWT to authorise with
  jwtToken: string;
}

/**
 * This manages a remote couch connection
 */
export interface RemoteCouchConnection {
  // Id of the remote DB - use service to fetch
  remoteDbId: string;
  // The sync object (this is created which initiates sync)
  syncId: string | undefined;
  // The configuration for the remote connection e.g. auth, endpoint etc
  connectionConfiguration: DatabaseConnectionConfig;
}
export interface DatabaseConnection {
  // A reference to the local data database
  localDbId: string;

  // This defines whether the database synchronisation is active

  // TODO this is not yet implemented - what behaviour should it have?
  isSyncing: boolean;

  // Is pouch configured to download attachments?
  isSyncingAttachments: boolean;

  // Remote database connection (if the database is not syncing - this is
  // undefined and guarantees no leaking of old connections)
  remote?: RemoteCouchConnection;
}

// This is metadata which is defined as part of the design file
export interface KnownProjectMetadata {
  name: string;
  description?: string;
}
export type ProjectMetadata = KnownProjectMetadata & {[key: string]: any};

// Maps a project ID -> project
export type ProjectIdToProjectMap = {[projectId: string]: Project};

/** This is the subset of project information which is modifiable/trivial */
export interface ProjectInformation {
  // last updated (datetime string)
  lastUpdated?: string;

  // created time (datetime string)
  createdAt?: string;

  // This is metadata information about the project
  metadata: ProjectMetadata;

  // [Stored uncompiled]
  rawUiSpecification: ProjectUIModel;
}

// A project is a 'notebook'/'survey' - it is relevant to a server, can be
// inactive or active, and was activated by someone. This extends with
// non-trivial or side-effecting elements like database connections and
// activated status
export interface Project extends ProjectInformation {
  // the unique project ID (unique within the server)
  projectId: string;

  // Which server is this in?
  serverId: string;

  // Is the project activated?
  isActivated: boolean;

  // Data database (if activated is false -> this is undefined)
  database?: DatabaseConnection;

  // [Compiled] Key to get the compiled UI Spec from storage - this should not
  // be persisted as it has live JS functions in it
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
  isInitialised: false,
};

const projectsSlice = createSlice({
  name: 'projects',
  initialState: initialProjectState,
  reducers: {
    markInitialised: state => {
      state.isInitialised = true;
    },

    compileSpecs: state => {
      // For all specs in the project - compile and store
      for (const server of Object.values(state.servers)) {
        for (const project of Object.values(server.projects)) {
          compiledSpecService.compileAndRegisterSpec(
            project.uiSpecificationId,
            project.rawUiSpecification
          );
        }
      }
    },
    rebuildDbs: state => {
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

                // and the sync
                let updatedSyncId: string | undefined = undefined;
                if (dbInfo.isSyncing) {
                  // creates the sync object (PouchDB.Replication.Sync)
                  const sync = createPouchDbSync({
                    attachmentDownload: dbInfo.isSyncingAttachments,
                    localDb,
                    remoteDb,
                  });
                  updatedSyncId = buildSyncId({
                    localId: dbInfo.localDbId,
                    remoteId: remoteDbId,
                  });
                  databaseService.registerSync(updatedSyncId, sync, {
                    tolerant: true,
                  });
                }

                // Also worth noting we should update the remote db ID just in case the function changed (to avoid broken store)
                dbInfo.remote.remoteDbId = remoteDbId;
                dbInfo.remote.syncId = updatedSyncId;
              }
              // otherwise we are all good - just local db needed
            } else {
              // This is weird - we have an activated survey but the database
              // object is missing TODO determine behaviour
            }
          }
        }
      }
    },
    // Add and remove servers
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

    // removeServer: (state, action: PayloadAction<{serverId: string}>) => {
    //   // TODO - will we ever do this? What should happen - this will require
    //   // deactivating things/deleting databases.
    // },

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

    // Add and remove projects
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

        uiSpecificationId: compiledSpecId,
        rawUiSpecification: payload.rawUiSpecification,
        lastUpdated: payload.lastUpdated,
        createdAt: payload.createdAt,

        // Default not activated with no database
        isActivated: false,
        database: undefined,
      };
    },

    // Remove a project from local storage
    // Note: This doesn't delete the project from the server, only removes it from local state
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
              databaseService.closeAndRemoveRemoteDatabase(remoteDatabaseId);
            }
          }

          // Close and clean local database
          const localDatabaseId = project.database.localDbId;
          if (localDatabaseId) {
            databaseService.closeAndRemoveLocalDatabase(localDatabaseId, {
              clean: true,
            });
          }
        }

        // Remove compiled spec from service
        compiledSpecService.removeSpec(project.uiSpecificationId);
      }

      // Remove the project from the server's projects map
      delete server.projects[payload.projectId];
    },

    // Update a project (metadata / details)
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
        lastUpdated: payload.lastUpdated,
        createdAt: payload.createdAt,
      };
    },

    // Activate a project
    activateProject: (
      state,
      action: PayloadAction<ProjectIdentity & DatabaseAuth>
    ) => {
      const payload = action.payload;

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
      databaseService.registerLocalDatabase(localDatabaseId, localDb);

      // creates the remote database (pouch remote)
      const {db: remoteDb, id: remoteDbId} =
        createRemotePouchDbFromConnectionInfo<ProjectDataObject>(
          connectionConfiguration
        );
      databaseService.registerRemoteDatabase(remoteDbId, remoteDb);

      // creates the sync object (PouchDB.Replication.Sync)
      const sync = createPouchDbSync({
        attachmentDownload: false,
        localDb,
        remoteDb,
      });
      const syncId = buildSyncId({
        localId: localDatabaseId,
        remoteId: remoteDbId,
      });
      databaseService.registerSync(syncId, sync);

      // updates the state with all of this new information
      state.servers[payload.serverId].projects[payload.projectId] = {
        // These are retained
        metadata: project.metadata,
        projectId: project.projectId,
        rawUiSpecification: project.rawUiSpecification,
        uiSpecificationId: project.uiSpecificationId,
        createdAt: project.createdAt,
        lastUpdated: project.lastUpdated,
        serverId: project.serverId,

        // These are updated
        isActivated: true,
        database: {
          isSyncing: true,
          isSyncingAttachments: false,
          localDbId: localDatabaseId,
          remote: {
            connectionConfiguration,
            remoteDbId: remoteDbId,
            syncId: syncId,
          },
        },
      };
    },

    // Deactivate a project
    deactivateProject: (state, action: PayloadAction<ProjectIdentity>) => {
      const payload = action.payload;

      // Check the server exists
      const server = serverById(state, payload.serverId);
      if (!server) {
        // abort
        throw new Error(
          `You cannot activate a project for a server which does not exist. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
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
      databaseService.closeAndRemoveRemoteDatabase(remoteDatabaseId);

      // establish ID of local DB
      const localDatabaseId = project.database.localDbId;
      // wipe and remove local database (cleaning records)
      databaseService.closeAndRemoveLocalDatabase(localDatabaseId, {
        clean: true,
      });

      // updates the state with all of this new information
      state.servers[payload.serverId].projects[payload.projectId] = {
        // These are retained
        metadata: project.metadata,
        projectId: project.projectId,
        rawUiSpecification: project.rawUiSpecification,
        uiSpecificationId: project.uiSpecificationId,
        createdAt: project.createdAt,
        lastUpdated: project.lastUpdated,
        serverId: project.serverId,

        // These are updated (to indicate de-activation)
        isActivated: false,
        database: undefined,
      };
    },

    // Update connection details for activated project
    updateConnection: (
      state,
      action: PayloadAction<{jwtToken: string} & ProjectIdentity>
    ) => {
      // check project/server exists
      const payload = action.payload;

      // Check the server exists
      const server = serverById(state, payload.serverId);
      if (!server) {
        // abort
        throw new Error(
          `You cannot update connection for a project for a server which does not exist. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
        );
      }

      // Check the couch DB url has been populated
      if (!server.couchDbUrl) {
        // abort
        throw new Error(
          `Cannot update connection when we don't know the couchDBUrl. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
        );
      }

      // check the project exists
      const project = projectByIdentity(state, payload);
      if (!project) {
        // abort
        throw new Error(
          `You cannot update a connection for a project which does not exist. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
        );
      }

      // check it's already active
      if (!project.isActivated) {
        throw new Error(
          `You cannot update the connection of an inactive project. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
        );
      }

      // check database and remote are defined
      if (!project.database || !project.database.remote) {
        throw new Error(
          `You cannot update the connection of a project which has no database object and/or remote connection. Activate it first. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}.`
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

      // cleanup old sync
      const oldSyncId = project.database.remote.syncId;
      if (oldSyncId) {
        // Only update sync object if we are syncing
        databaseService.closeAndRemoveSync(oldSyncId);
      }

      // cleanup old remote DB
      const oldRemoteId = project.database.remote.remoteDbId;
      databaseService.closeAndRemoveRemoteDatabase(oldRemoteId);

      // setup updated connection configuration
      const connectionConfiguration: DatabaseConnectionConfig = {
        // push in the specified jwt
        jwtToken: payload.jwtToken,

        // These are not configurable from this reducer
        couchUrl: server.couchDbUrl,
        databaseName: getRemoteDatabaseNameFromId({
          projectId: project.projectId,
        }),
      };

      // creates the remote database (pouch remote)
      const {db: remoteDb, id: remoteDbId} =
        createRemotePouchDbFromConnectionInfo<ProjectDataObject>(
          connectionConfiguration
        );
      databaseService.registerRemoteDatabase(remoteDbId, remoteDb);

      // creates the sync object (PouchDB.Replication.Sync) (only if necessary)
      let updatedSyncId: string | undefined = undefined;
      if (project.database.isSyncing) {
        const sync = createPouchDbSync({
          // reuse existing attachment setting
          attachmentDownload: project.database.isSyncingAttachments,
          // local is fine to continue using!
          localDb: localDb,
          remoteDb,
        });
        // Register the sync
        updatedSyncId = buildSyncId({
          localId: project.database.localDbId,
          remoteId: remoteDbId,
        });
        databaseService.registerSync(updatedSyncId, sync);
      }

      // updates the state with all of this new information
      state.servers[payload.serverId].projects[payload.projectId] = {
        // These are retained
        metadata: project.metadata,
        projectId: project.projectId,
        rawUiSpecification: project.rawUiSpecification,
        uiSpecificationId: project.uiSpecificationId,
        createdAt: project.createdAt,
        lastUpdated: project.lastUpdated,
        serverId: project.serverId,

        // These are updated
        isActivated: true,
        database: {
          // Retained
          isSyncing: project.database.isSyncing,
          // This is retained
          isSyncingAttachments: project.database.isSyncingAttachments,
          // This is retained
          localDbId: project.database.localDbId,
          remote: {
            // new connection configuration
            connectionConfiguration,
            // new remote database
            remoteDbId: remoteDbId,
            // new sync
            syncId: updatedSyncId,
          },
        },
      };
    },

    // Temporarily stop syncing a project without deactivating it
    stopSyncingProject: (state, action: PayloadAction<ProjectIdentity>) => {
      // check project/server exists
      const payload = action.payload;

      // Check the server exists
      const server = serverById(state, payload.serverId);
      if (!server) {
        // abort
        throw new Error(
          `You cannot stop syncing a project for a server which does not exist. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
        );
      }

      // check the project exists
      const project = projectByIdentity(state, payload);
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
      databaseService.closeAndRemoveSync(syncId);

      // updates the state to indicate no syncing
      state.servers[payload.serverId].projects[payload.projectId] = {
        // These are retained
        metadata: project.metadata,
        projectId: project.projectId,
        rawUiSpecification: project.rawUiSpecification,
        uiSpecificationId: project.uiSpecificationId,
        createdAt: project.createdAt,
        lastUpdated: project.lastUpdated,
        serverId: project.serverId,

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
            // No sync object when syncing is paused
            syncId: undefined,
          },
        },
      };
    },

    // Resume syncing for a project with syncing temporarily stopped
    resumeSyncingProject: (state, action: PayloadAction<ProjectIdentity>) => {
      // check project/server exists
      const payload = action.payload;

      // Check the server exists
      const server = serverById(state, payload.serverId);
      if (!server) {
        // abort
        throw new Error(
          `You cannot resume syncing a project for a server which does not exist. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
        );
      }

      // check the project exists
      const project = projectByIdentity(state, payload);
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

      // creates the sync object (PouchDB.Replication.Sync)
      const sync = createPouchDbSync({
        // Use existing setting for attachments
        attachmentDownload: project.database.isSyncingAttachments,
        // Use existing local DB
        localDb,
        // Use existing remote DB
        remoteDb,
      });

      // Register the sync
      const syncId = buildSyncId({
        localId: project.database.localDbId,
        remoteId: project.database.remote.remoteDbId,
      });
      databaseService.registerSync(syncId, sync);

      // updates the state with all of this new information
      state.servers[payload.serverId].projects[payload.projectId] = {
        // These are retained
        metadata: project.metadata,
        projectId: project.projectId,
        rawUiSpecification: project.rawUiSpecification,
        uiSpecificationId: project.uiSpecificationId,
        createdAt: project.createdAt,
        lastUpdated: project.lastUpdated,
        serverId: project.serverId,

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
            // Set new sync ID
            syncId: syncId,
          },
        },
      };
    },

    // Set attachment syncing
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

        // creates the sync object (PouchDB.Replication.Sync)
        const sync = createPouchDbSync({
          // STOP syncing attachments
          attachmentDownload: false,
          // local is fine to continue using!
          localDb,
          // reuse existing remote db
          remoteDb,
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
        createdAt: project.createdAt,
        lastUpdated: project.lastUpdated,
        serverId: project.serverId,

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
            // new sync
            syncId: updatedSyncId,
          },
        },
      };
    },
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

        // creates the sync object (PouchDB.Replication.Sync)
        const sync = createPouchDbSync({
          // START syncing attachments
          attachmentDownload: true,
          // local is fine to continue using!
          localDb,
          // reuse existing remote db
          remoteDb,
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
        createdAt: project.createdAt,
        lastUpdated: project.lastUpdated,
        serverId: project.serverId,

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
            // new sync
            syncId: updatedSyncId,
          },
        },
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
>('projects/updateDatabaseCredentials', (args, {dispatch, getState}) => {
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
    if (project.isActivated) {
      // Dispatch a connection update
      appDispatch(
        updateConnection({
          jwtToken: token,
          projectId: project.projectId,
          serverId,
        })
      );
    }
  }
});

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
    const discoveredServers: ApiServerInfo[] = [];
    for (const conductorUrl of CONDUCTOR_URLS) {
      // firstly - try and call the info endpoint
      await fetch(`${conductorUrl}/api/info`, {})
        .then(response => response.json())
        .then(info => {
          discoveredServers.push(info as ApiServerInfo);
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

// TODO move this into data model
export interface ApiProjectInfo {
  _id: NonUniqueProjectID;
  name: string;
  description?: string;
  template_id?: string;
  data_db?: PossibleConnectionInfo;
  metadata_db?: PossibleConnectionInfo;
  last_updated?: string;
  created?: string;
  status?: string;
}

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
 * TODO consider deletion!
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
    let directoryResults: ApiProjectInfo[] = [];
    await fetch(`${server.serverUrl}/api/directory`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(response => response.json())
      .then(rawDirectory => {
        directoryResults = rawDirectory as ApiProjectInfo[];
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
      } catch {
        console.warn(
          `Failed to get metadata from API for project ${projectId}`
        );
      }

      // See if we have an existing matching project
      const project = projectByIdentity(projectState, {
        projectId,
        serverId,
      });

      if (!details.data_db?.base_url) {
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
            metadata: meta.metadata,
            projectId,
            serverId,
            rawUiSpecification: meta.uiSpec,
            couchDbUrl: details.data_db.base_url,
            // TODO Where are these populated from
            createdAt: undefined,
            lastUpdated: undefined,
          })
        );
      } else {
        // update existing record
        appDispatch(
          updateProjectDetails({
            metadata: meta?.metadata ?? project.metadata,
            projectId: projectId,
            serverId,
            rawUiSpecification: meta?.uiSpec ?? project.rawUiSpecification,
            couchDbUrl: details.data_db.base_url,
            // TODO update these?
            createdAt: project.createdAt,
            lastUpdated: project.lastUpdated,
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

export const {
  activateProject,
  addProject,
  addServer,
  startSyncingAttachments,
  stopSyncingAttachments,
  stopSyncingProject,
  resumeSyncingProject,
  removeProject,
  updateConnection,
  updateProjectDetails,
  updateServerDetails,
  markInitialised,
  rebuildDbs,
  compileSpecs,
  deactivateProject,
} = projectsSlice.actions;

export default projectsSlice.reducer;
