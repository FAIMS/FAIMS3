import {ProjectDataObject, ProjectUIModel} from '@faims3/data-model';
import {createAsyncThunk, createSlice, PayloadAction} from '@reduxjs/toolkit';
import {AppDispatch, RootState} from '../store';
import {ConnectionInfo} from '../../sync/connection';

// TYPES
// =====

// Database types

/**
 * This manages a remote couch connection
 */
export interface RemoteCouchConnection<Content extends {}> {
  // Actual reference to the pouch database
  remoteDatabase: PouchDB.Database<Content>;
  // The sync object (this is created which initiates sync)
  sync: PouchDB.Replication.Sync<Content>;
  // The configuration for the remote connection e.g. auth, endpoint etc
  connectionConfiguration: ConnectionInfo;
}
export interface DatabaseConnection<Content extends {}> {
  // A reference to the local data database
  localDatabase: PouchDB.Database<Content>;

  // This defines whether the database synchronisation is active
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

  // Map from project ID -> Project details
  projects: ProjectIdToProjectMap;
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
      }>
    ) => {
      const {serverId, serverTitle, serverUrl} = action.payload;
      // Create a new server with no projects
      state.servers[serverId] = {
        projects: {},
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

        // Other details we overwrite
        serverId,
        serverTitle,
        serverUrl,
      };
    },

    // Add and remove projects
    addProject: (
      state,
      action: PayloadAction<
        ProjectInformation & {
          projectId: string;
        }
      >
    ) => {
      const {} = action.payload;
    },
    removeProject: (state, action: PayloadAction<{}>) => {
      // TODO define what this does - implications?
    },

    // Update a project (metadata / details)
    updateProjectDetails: (state, action: PayloadAction<{}>) => {},

    // Last updated/created
    setProjectLastUpdated: (state, action: PayloadAction<{}>) => {},
    setProjectCreatedAt: (state, action: PayloadAction<{}>) => {},

    // Activate a project
    activateProject: (state, action: PayloadAction<{}>) => {},
    // De-activate a project
    deactivateProject: (state, action: PayloadAction<{}>) => {
      // TODO
      // Define what de-activating would do
    },

    // Set project syncing
    stopSyncingProject: (state, action: PayloadAction<{}>) => {},
    startSyncingProject: (state, action: PayloadAction<{}>) => {},

    // Set attachment syncing
    stopSyncingAttachments: (state, action: PayloadAction<{}>) => {},
    startSyncingAttachments: (state, action: PayloadAction<{}>) => {},
  },
});

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
>('auth/exampleThunk', async (args, {dispatch, getState}) => {
  // cast and get state
  const state = (getState() as RootState).projects;
  const appDispatch = dispatch as AppDispatch;
});

export const {exampleAction} = projectsSlice.actions;

export default projectsSlice.reducer;

type ProjectsStore = {projects: ProjectsState};
