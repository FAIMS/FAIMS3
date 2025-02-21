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

// A project is a 'notebook'/'survey' - it is relevant to a server, can be
// inactive or active, and was activated by someone
export interface Project {
  // the unique project ID (unique within the server)
  projectId: string;

  // last updated (datetime string)
  lastUpdated?: string;

  // created time (datetime string)
  createdAt?: string;

  // This is metadata information about the project
  metadata: ProjectMetadata;

  // What is the ui specification for this notebook
  uiSpecification: ProjectUIModel;

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
  // TODO initial state
};

const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    exampleAction: (state, action: PayloadAction<{}>) => {
      // Modify state
    },
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
