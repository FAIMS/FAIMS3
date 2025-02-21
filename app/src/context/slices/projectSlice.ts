import {ProjectDataObject, ProjectUIModel} from '@faims3/data-model';
import {createAsyncThunk, createSlice, PayloadAction} from '@reduxjs/toolkit';
import {AppDispatch, RootState} from '../store';
import {
  buildPouchIdentifier,
  createLocalPouchDatabase,
  createPouchDbSync,
  createRemotePouchDbFromConnectionInfo,
  getRemoteDatabaseNameFromId,
} from './databaseHelpers/helpers';

// TYPES
// =====

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
export interface RemoteCouchConnection<Content extends {}> {
  // Actual reference to the pouch database
  remoteDb: PouchDB.Database<Content>;
  // The sync object (this is created which initiates sync)
  sync: PouchDB.Replication.Sync<Content>;
  // The configuration for the remote connection e.g. auth, endpoint etc
  connectionConfiguration: DatabaseConnectionConfig;
}
export interface DatabaseConnection<Content extends {}> {
  // A reference to the local data database
  localDb: PouchDB.Database<Content>;

  // This defines whether the database synchronisation is active

  // TODO this is not yet implemented - what behaviour should it have?
  isSyncing: boolean;

  // Is pouch configured to download attachments?
  isSyncingAttachments: boolean;

  // Remote database connection (if the database is not syncing - this is
  // undefined and guarantees no leaking of old connections)
  remote?: RemoteCouchConnection<Content>;
}

// This is metadata which is defined as part of the design file
export interface ProjectMetadata {
  name: string;
  description?: string;
  // TODO other metadata fields here? Let's type them!
}

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

  // What is the ui specification for this notebook
  uiSpecification: ProjectUIModel;
}

// A project is a 'notebook'/'survey' - it is relevant to a server, can be
// inactive or active, and was activated by someone. This extends with
// non-trivial or side-effecting elements like database connections and
// activated status
export interface Project extends ProjectInformation {
  // the unique project ID (unique within the server)
  projectId: string;

  // Is the project activated?
  isActivated: boolean;

  // Data database (if activated is false -> this is undefined)
  database?: DatabaseConnection<ProjectDataObject>;
}

export interface Server {
  // What is the URL for the server?
  serverUrl: string;

  // Server unique ID
  serverId: string;

  // Display title
  serverTitle: string;

  // What is the URL of the couch database for this server?
  couchDbUrl: string;

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
}

// UTILITY FUNCTIONS
// =================

// SLICE
// =====

const initialState: ProjectsState = {
  // initial state is empty
  servers: {},
};

const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    // Add and remove servers
    addServer: (
      state,
      action: PayloadAction<{
        serverId: string;
        serverTitle: string;
        serverUrl: string;
        couchDbUrl: string;
      }>
    ) => {
      const {serverId, serverTitle, serverUrl, couchDbUrl} = action.payload;
      // Create a new server with no projects
      state.servers[serverId] = {
        projects: {},
        couchDbUrl,
        serverId,
        serverTitle,
        serverUrl,
      };
    },

    removeServer: (state, action: PayloadAction<{serverId: string}>) => {
      // TODO - will we ever do this? What should happen - this will require
      // deactivating things/deleting databases.
    },

    updateServerDetails: (
      state,
      action: PayloadAction<{
        serverId: string;
        serverTitle: string;
        serverUrl: string;
      }>
    ) => {
      const {serverId, serverTitle, serverUrl} = action.payload;
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
      };
    },

    // Add and remove projects
    addProject: (
      state,
      action: PayloadAction<ProjectInformation & ProjectIdentity>
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

      // Now we can add one
      server.projects[payload.projectId] = {
        // Project ID
        projectId: payload.projectId,

        // Superficial details
        metadata: payload.metadata,
        uiSpecification: payload.uiSpecification,
        lastUpdated: payload.lastUpdated,
        createdAt: payload.createdAt,

        // Default not activated with no database
        isActivated: false,
        database: undefined,
      };
    },
    removeProject: (state, action: PayloadAction<{}>) => {
      // TODO define what this does - implications?
    },

    // Update a project (metadata / details)
    updateProjectDetails: (
      state,
      action: PayloadAction<ProjectInformation & ProjectIdentity>
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

      // Now we can update it
      server.projects[payload.projectId] = {
        ...server.projects[payload.projectId],

        // Superficial details updated only! You cannot change activated/sync
        // status here - these are controlled actions
        metadata: payload.metadata,
        uiSpecification: payload.uiSpecification,
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
      let server = serverById(state, payload.serverId);
      if (!server) {
        // abort
        throw new Error(
          `You cannot activate a project for a server which does not exist. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
        );
      }

      // check the project exists
      let project = projectByIdentity(state, payload);
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

      // creates the remote database (pouch remote)
      const remoteDb = createRemotePouchDbFromConnectionInfo<ProjectDataObject>(
        connectionConfiguration
      );

      // creates the sync object (PouchDB.Replication.Sync)
      const sync = createPouchDbSync({
        attachmentDownload: false,
        localDb,
        remoteDb,
      });

      // updates the state with all of this new information
      project = {
        // These are retained
        metadata: project.metadata,
        projectId: project.projectId,
        uiSpecification: project.uiSpecification,
        createdAt: project.createdAt,
        lastUpdated: project.lastUpdated,

        // These are updated
        isActivated: true,
        database: {
          isSyncing: true,
          isSyncingAttachments: false,
          localDb: localDb,
          remote: {
            connectionConfiguration,
            remoteDb,
            sync,
          },
        },
      };
    },

    // De-activate a project
    deactivateProject: (state, action: PayloadAction<{}>) => {
      // TODO
      // Define what de-activating would do
    },

    // Update connection details for activated project
    updateConnection: (
      state,
      action: PayloadAction<{jwtToken: string} & ProjectIdentity>
    ) => {
      // check project/server exists
      const payload = action.payload;

      // Check the server exists
      let server = serverById(state, payload.serverId);
      if (!server) {
        // abort
        throw new Error(
          `You cannot update connection for a project for a server which does not exist. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
        );
      }

      // check the project exists
      let project = projectByIdentity(state, payload);
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

      // cleanup old sync
      const oldSync = project.database.remote.sync;

      console.log('Closing existing sync connection');
      // Remove all listeners
      oldSync.removeAllListeners();
      // Cancel the connection
      oldSync.cancel();

      // cleanup old remote DB
      const oldRemote = project.database.remote.remoteDb;
      oldRemote.close();

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
      const remoteDb = createRemotePouchDbFromConnectionInfo<ProjectDataObject>(
        connectionConfiguration
      );

      // creates the sync object (PouchDB.Replication.Sync)
      const sync = createPouchDbSync({
        // reuse existing attachment setting
        attachmentDownload: project.database.isSyncingAttachments,
        // local is fine to continue using!
        localDb: project.database.localDb,
        remoteDb,
      });

      // updates the state with all of this new information
      project = {
        // These are retained
        metadata: project.metadata,
        projectId: project.projectId,
        uiSpecification: project.uiSpecification,
        createdAt: project.createdAt,
        lastUpdated: project.lastUpdated,

        // These are updated
        isActivated: true,
        database: {
          // TODO consider what to do with this switch - what behaviour should
          // it have?
          isSyncing: true,
          // This is retained
          isSyncingAttachments: project.database.isSyncingAttachments,
          // This is retained
          localDb: project.database.localDb,
          remote: {
            // new connection configuration
            connectionConfiguration,
            // new remote database
            remoteDb,
            // new sync
            sync,
          },
        },
      };
    },

    // Set project syncing
    stopSyncingProject: (state, action: PayloadAction<{}>) => {
      // TODO what does this do?
    },
    resumeSyncingProject: (state, action: PayloadAction<{}>) => {
      // TODO what does this do?
    },

    // Set attachment syncing
    stopSyncingAttachments: (state, action: PayloadAction<ProjectIdentity>) => {
      // check project/server exists
      const payload = action.payload;

      // Check the server exists
      let server = serverById(state, payload.serverId);
      if (!server) {
        // abort
        throw new Error(
          `You cannot disable attachments for a project for a server which does not exist. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
        );
      }

      // check the project exists
      let project = projectByIdentity(state, payload);
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

      // cleanup old sync
      const oldSync = project.database.remote.sync;

      console.log('Closing existing sync connection');
      // Remove all listeners
      oldSync.removeAllListeners();
      // Cancel the connection
      oldSync.cancel();

      // creates the sync object (PouchDB.Replication.Sync)
      const sync = createPouchDbSync({
        // STOP syncing attachments
        attachmentDownload: false,
        // local is fine to continue using!
        localDb: project.database.localDb,
        // reuse existing remote db
        remoteDb: project.database.remote.remoteDb,
      });

      // updates the state with all of this new information
      project = {
        // These are retained
        metadata: project.metadata,
        projectId: project.projectId,
        uiSpecification: project.uiSpecification,
        createdAt: project.createdAt,
        lastUpdated: project.lastUpdated,

        // These are updated
        isActivated: true,
        database: {
          // TODO consider what to do with this switch - what behaviour should
          // it have?
          isSyncing: true,
          // This is UPDATED
          isSyncingAttachments: false,
          // This is retained
          localDb: project.database.localDb,
          remote: {
            // reuse connection and remote
            connectionConfiguration:
              project.database.remote.connectionConfiguration,
            remoteDb: project.database.remote.remoteDb,
            // new sync
            sync,
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
      let server = serverById(state, payload.serverId);
      if (!server) {
        // abort
        throw new Error(
          `You cannot disable attachments for a project for a server which does not exist. Server ID: ${payload.serverId}. Project ID: ${payload.projectId}`
        );
      }

      // check the project exists
      let project = projectByIdentity(state, payload);
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

      // cleanup old sync
      const oldSync = project.database.remote.sync;

      console.log('Closing existing sync connection');
      // Remove all listeners
      oldSync.removeAllListeners();
      // Cancel the connection
      oldSync.cancel();

      // creates the sync object (PouchDB.Replication.Sync)
      const sync = createPouchDbSync({
        // START syncing attachments
        attachmentDownload: true,
        // local is fine to continue using!
        localDb: project.database.localDb,
        // reuse existing remote db
        remoteDb: project.database.remote.remoteDb,
      });

      // updates the state with all of this new information
      project = {
        // These are retained
        metadata: project.metadata,
        projectId: project.projectId,
        uiSpecification: project.uiSpecification,
        createdAt: project.createdAt,
        lastUpdated: project.lastUpdated,

        // These are updated
        isActivated: true,
        database: {
          // TODO consider what to do with this switch - what behaviour should
          // it have?
          isSyncing: true,
          // This is UPDATED
          isSyncingAttachments: true,
          // This is retained
          localDb: project.database.localDb,
          remote: {
            // reuse connection and remote
            connectionConfiguration:
              project.database.remote.connectionConfiguration,
            remoteDb: project.database.remote.remoteDb,
            // new sync
            sync,
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

// SELECTORS
// =========

export const exampleSelector = (state: RootState) => state.projects.servers;

// THUNKS
// ======

// These are actions which can be dispatched which can dispatch other store
// actions safely and run asynchronous operations.

export const exampleThunk = createAsyncThunk<
  // return
  void,
  // input
  {}
>('projects/exampleThunk', async (args, {dispatch, getState}) => {
  // cast and get state
  const state = (getState() as RootState).projects;
  const appDispatch = dispatch as AppDispatch;
});

export const {
  activateProject,
  addProject,
  addServer,
  startSyncingAttachments,
  stopSyncingAttachments,
  updateConnection,
  updateProjectDetails,
  updateServerDetails,
} = projectsSlice.actions;

export default projectsSlice.reducer;

type ProjectsStore = {projects: ProjectsState};
