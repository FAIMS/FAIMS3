import {
  couchInitialiser,
  initDataDB,
  NotebookDefinition,
  OfflineMapRegion,
  ProjectDataObject,
  ProjectListItem,
  ProjectStatus,
  PublicServerInfo,
} from '@faims3/data-model';
import {
  createAsyncThunk,
  createSelector,
  createSlice,
  PayloadAction,
} from '@reduxjs/toolkit';
import {config} from '../../buildconfig';
import {AppDispatch, RootState} from '../store';
import {AuthState, isTokenValid, selectActiveServerId} from './authSlice';
import {compiledSpecService} from './helpers/compiledSpecService';
import {
  buildCompiledSpecId,
  buildPouchIdentifier,
  buildSyncId,
  createLocalPouchDatabase,
  createPouchDbReplication,
  createRemotePouchDbFromConnectionInfo,
  fetchNotebookDetails,
  getRemoteDatabaseNameFromId,
  probeNotebookServerLifecycle,
  SyncEventHandlers,
} from './helpers/databaseHelpers';
import {databaseService} from './helpers/databaseService';
import {PouchDBWrapper} from './helpers/pouchDBWrapper';
import {replaceProjectReplication} from './helpers/replicationLifecycle';
import {syncStateService} from './helpers/syncStateService';
import {addAlert} from './alertSlice';
import {resolveActivationSyncMode} from '../../sync/syncModeDefaults';
import {
  reconcileOfflineMapRegionPlanChange,
  shouldSkipOfflineMapActivationPrompt,
} from '../../gui/components/maps/projectOfflineMap';
import {offlineMapRegionsEqual} from '@faims3/forms';
import type {SyncMode} from '../../sync/syncMode';
import {isReplicating, syncModeIncludesPull} from '../../sync/syncMode';
import {clearPushOnlyBannerDismissal} from '../../utils/pushOnlyBannerDismissal';
import {
  cancelProjectQueries,
  handleRemoteProjectRemoved,
} from '../../utils/remoteProjectRemoval';

export type {SyncMode};

/**
 * Per server+project: consecutive directory polls where an id is absent from the
 * active listing **and** GET `/api/notebooks/:id` reports missing (deleted / no access).
 */
const directoryAbsentStreak = new Map<string, number>();

/**
 * Successful directory polls where a local id is missing from the active listing
 * and the individual notebook probe returns `missing`. Require this many before
 * local cleanup — transient failures must not wipe local data (see
 * {@link scheduleAbsentDirectoryRetry}).
 */
const DIRECTORY_ABSENT_STREAK_THRESHOLD = 3;

/** Delay before the next directory poll while confirming a missing id. */
const DIRECTORY_ABSENT_RETRY_DELAY_MS = 900;

/**
 * Promise-queue mutex: each `runExclusive` waits for the previous job to finish
 * before running `fn`, so overlapping async work is serialized. A rejected
 * predecessor must not block the queue, hence `await prev.catch(() => {})`.
 */
function createAsyncMutex() {
  let mutex = Promise.resolve();
  return async function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const prev = mutex;
    let resolveNext!: () => void;
    mutex = new Promise<void>(r => {
      resolveNext = r;
    });
    await prev.catch(() => {});
    try {
      return await fn();
    } finally {
      resolveNext();
    }
  };
}

// `initialiseProjects` does many awaits (directory, metadata, dispatches). Without
// a per-server lock, a user refresh, token refresh, and the timed retry below
// could interleave: duplicate streak increments, double removal, or stale
// `getState()` vs directory results. One flight per server keeps that linear.
const initialiseProjectsMutexByServer = new Map<
  string,
  ReturnType<typeof createAsyncMutex>
>();

function withInitialiseProjectsLock<T>(
  serverId: string,
  fn: () => Promise<T>
): Promise<T> {
  let m = initialiseProjectsMutexByServer.get(serverId);
  if (!m) {
    m = createAsyncMutex();
    initialiseProjectsMutexByServer.set(serverId, m);
  }
  return m(fn);
}

// At most one pending "poll again soon" timer per server. Retries call
// `initialiseProjects` again (which re-enters the mutex), so we replace any
// existing timer when scheduling to avoid stacking duplicate polls.
const pendingAbsentDirectoryRetryTimer = new Map<
  string,
  ReturnType<typeof setTimeout>
>();

function clearAbsentDirectoryRetry(serverId: string) {
  const t = pendingAbsentDirectoryRetryTimer.get(serverId);
  if (t !== undefined) {
    clearTimeout(t);
    pendingAbsentDirectoryRetryTimer.delete(serverId);
  }
}

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
 * This manages a remote couch connection - a remote connection is a combination
 * of the remote database ID (see databaseService to retrieve it), the sync
 * object (which is only instantiated/active if syncMode !== 'none')
 */
export interface RemoteCouchConnection {
  // ID of the remote DB - use databaseService to fetch
  remoteDbId: string;
  // The sync object ID - use databaseService to fetch - can be undefined if
  // syncMode = 'none'
  syncId: string | undefined;
  // The configuration for the remote connection e.g. auth, endpoint etc
  connectionConfiguration: DatabaseConnectionConfig;
}
export interface DatabaseConnection {
  // A reference to the local data database - retrieve from databaseService
  localDbId: string;

  /** Record replication direction; `none` = local Pouch only. */
  syncMode: SyncMode;

  // Is pouch configured to download attachments? Attachment download is managed
  // through a filter on the pull side of replication
  isSyncingAttachments: boolean;

  // Remote database connection (this is always defined since we will always
  // have a remoteDb even if sync is not active)
  remote: RemoteCouchConnection;
}

// Maps a project ID -> project
export type ProjectIdToProjectMap = {[projectId: string]: Project};

/** Superficial notebook details synced from the API (design bundle is typed). */
export interface ProjectInformation {
  /** Display title (project document root). */
  name: string;
  /** Operational description (project document root). */
  description?: string;
  /** Source template when created from a template. */
  templateId?: string;
  /** Inlined uiSpecification from GET /api/notebooks/:id (current notebook schema). */
  uiDefinition: NotebookDefinition;
  /** Survey lifecycle. */
  status: ProjectStatus;
  /** Last update from the server, when known. */
  updatedAt?: string;
  /** Server record count from GET /api/notebooks/:id when known. */
  recordCount?: number;
  /** Recommended offline map download region (EPSG:4326 polygon). */
  offlineMapRegion?: OfflineMapRegion;
}

// A project is a notebook (configurable label via config.notebookName) — it is relevant to a server, can be
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

  // What is the reported version of the server?
  serverVersion?: string;

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

/** One queued post-activation or plan-change offline map download dialog. */
export interface PendingOfflineMapDownloadPrompt extends ProjectIdentity {
  /** True when an existing download was invalidated by a plan region change. */
  isRegionUpdate?: boolean;
}

/** Dedupe key for the offline map prompt FIFO queue. */
function offlineMapDownloadPromptKey({
  projectId,
  serverId,
}: ProjectIdentity): string {
  return `${serverId}:${projectId}`;
}

/** Migrate legacy persisted state that predates the prompt queue field. */
function ensureOfflineMapPromptQueue(
  state: ProjectsState
): PendingOfflineMapDownloadPrompt[] {
  if (!state.pendingOfflineMapDownloadPrompts) {
    state.pendingOfflineMapDownloadPrompts = [];
  }
  return state.pendingOfflineMapDownloadPrompts;
}

// Map from server ID to server details
export type ServerIdToServerMap = {[serverId: string]: Server};

// The top level project state - servers + initialised flag
export interface ProjectsState {
  servers: ServerIdToServerMap;
  isInitialised: boolean;
  selectedServerId?: string;
  /** FIFO queue of offline map download dialogs to show one at a time. */
  pendingOfflineMapDownloadPrompts?: PendingOfflineMapDownloadPrompt[];
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
  pendingOfflineMapDownloadPrompts: [],
};

/**
 * Merge an incoming `recordCount` with a stored value.
 */
function mergeRecordCount(
  incoming: number | undefined,
  existing: number | undefined
): number | undefined {
  return incoming !== undefined ? incoming : existing;
}

/** Superficial project fields that must survive database/sync-only updates. */
function retainedProjectFields(project: Project) {
  return {
    projectId: project.projectId,
    uiDefinition: project.uiDefinition,
    uiSpecificationId: project.uiSpecificationId,
    description: project.description,
    templateId: project.templateId,
    updatedAt: project.updatedAt,
    serverId: project.serverId,
    status: project.status,
    name: project.name,
    recordCount: project.recordCount,
    offlineMapRegion: project.offlineMapRegion,
  };
}

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
     * Sets the selected server ID if there are multiple servers
     */
    selectServer: (state, action: PayloadAction<string>) => {
      const serverId = action.payload;
      if (!state.servers[serverId]) {
        throw new Error(
          `Cannot select server with ID ${serverId} since it does not exist.`
        );
      }
      console.log(`Selecting server with ID ${serverId}`);
      state.selectedServerId = serverId;
    },

    /**
     * Adds a new server - currently this is used only during initialisation but
     * could eventually form a dynamic server management system
     */
    addServer: (
      state,
      action: PayloadAction<{
        serverId: string;
        serverVersion?: string;
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
        serverVersion,
      } = action.payload;
      // Create a new server with no projects
      state.servers[serverId] = {
        projects: {},
        serverVersion,
        couchDbUrl,
        serverId,
        description,
        serverTitle,
        serverUrl,
        shortCodePrefix,
      };
      // If this was the first server added, select it by default
      if (Object.keys(state.servers).length === 1) {
        state.selectedServerId = serverId;
      }
    },

    /**
     * Update modifiable details for an existing server
     */
    updateServerDetails: (
      state,
      action: PayloadAction<{
        serverId: string;
        serverVersion?: string;
        serverTitle: string;
        serverUrl: string;
        shortCodePrefix: string;
        description: string;
      }>
    ) => {
      const {
        serverId,
        serverVersion,
        description,
        serverTitle,
        shortCodePrefix,
        serverUrl,
      } = action.payload;
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
        serverVersion,
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
        payload.uiDefinition.uiSpec
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
        name: payload.name,
        description: payload.description,
        templateId: payload.templateId,
        updatedAt: payload.updatedAt,
        uiDefinition: payload.uiDefinition,

        uiSpecificationId: compiledSpecId,

        // Default not activated with no database
        isActivated: false,
        database: undefined,
        status: payload.status,
        recordCount: payload.recordCount,
        offlineMapRegion: payload.offlineMapRegion,
      };
    },

    /**
     * Remove a project from the store after the server signals archived/deleted
     * with {@link config.forceRemoteDeletion} === `allow` only.
     *
     * Stops sync and remote Pouch handles, then **destroys** the local Pouch DB
     * (IndexedDB) so no local notebook data remains on device.
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

          // Security: fully destroy local storage (not just close) when policy allows removal
          const localDatabaseId = project.database.localDbId;
          if (localDatabaseId) {
            void databaseService.destroyLocalDatabase(localDatabaseId);
          }
        }
      }

      if (project.uiSpecificationId) {
        compiledSpecService.removeSpec(project.uiSpecificationId);
      }

      // Cleanup sync state
      syncStateService.removeSyncState(payload.serverId, payload.projectId);

      // Remove the project from the server's projects map
      delete server.projects[payload.projectId];
    },

    /**
     * Same sync/remote teardown as manual deactivate; local Pouch is always
     * **closed** but not destroyed so IndexedDB stays recoverable. Then remove the
     * project from the store. Used when the server archived/deleted the notebook but
     * {@link config.forceRemoteDeletion} is not `allow` (independent of
     * {@link config.deleteOnDeactivation}).
     */
    detachProjectRetainLocalData: (
      state,
      action: PayloadAction<ProjectIdentity>
    ) => {
      const payload = action.payload;
      const server = serverById(state, payload.serverId);
      if (!server) {
        throw new Error(
          `Cannot detach project: missing server ${payload.serverId}.`
        );
      }
      const project = projectByIdentity(state, payload);
      if (!project) {
        throw new Error(
          `Cannot detach project that does not exist. Server: ${payload.serverId}, project: ${payload.projectId}`
        );
      }

      if (project.isActivated && project.database) {
        if (project.database.remote) {
          const syncId = project.database.remote.syncId;
          if (syncId) {
            databaseService.closeAndRemoveSync(syncId);
          }
          const remoteDatabaseId = project.database.remote.remoteDbId;
          if (remoteDatabaseId) {
            databaseService.closeAndRemoveRemoteDatabase(remoteDatabaseId);
          }
        }
        const localDatabaseId = project.database.localDbId;
        if (localDatabaseId) {
          void databaseService.closeAndRemoveLocalDatabase(localDatabaseId);
        }
      }

      if (project.uiSpecificationId) {
        compiledSpecService.removeSpec(project.uiSpecificationId);
      }

      syncStateService.removeSyncState(payload.serverId, payload.projectId);
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
        payload.uiDefinition.uiSpec
      );

      server.couchDbUrl = payload.couchDbUrl;

      const existingProject = server.projects[payload.projectId];

      // Now we can update it
      server.projects[payload.projectId] = {
        ...existingProject,

        // Superficial details updated only! You cannot change activated/sync
        // status here - these are controlled actions
        name: payload.name,
        description: payload.description,
        templateId: payload.templateId,
        updatedAt: payload.updatedAt,
        uiDefinition: payload.uiDefinition,
        uiSpecificationId: compiledSpecId,
        status: payload.status,
        recordCount: mergeRecordCount(
          payload.recordCount,
          existingProject.recordCount
        ),
        // Successful GET /api/notebooks/:id (200) may omit cleared regions entirely;
        // treat a missing payload field the same as explicit undefined.
        offlineMapRegion: payload.offlineMapRegion,
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
        syncMode,
        recordCount,
      } = action.payload;
      const mergedOfflineMapRegion =
        'offlineMapRegion' in action.payload
          ? action.payload.offlineMapRegion
          : project.offlineMapRegion;

      // updates the state with all of this new information
      state.servers[serverId].projects[project.projectId] = {
        ...retainedProjectFields(project),
        offlineMapRegion: mergedOfflineMapRegion,
        isActivated: true,
        database: {
          syncMode,
          isSyncingAttachments: false,
          localDbId: localDatabaseId,
          remote: {
            connectionConfiguration,
            remoteDbId: remoteDbId,
            syncId: syncId,
          },
        },
        recordCount: mergeRecordCount(recordCount, project.recordCount),
      };
    },

    /**
     * De-activates an existing (active) project.
     *
     * - Stops and removes sync, closes remote and local Pouch handles, clears sync state.
     * - Local data: when {@link config.deleteOnDeactivation} is true, destroys the local
     *   Pouch DB (IndexedDB). When false (default), only closes the local DB so data
     *   may remain on disk for recovery.
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
      // NOTE destroy/close are async; completion may not be immediate
      if (config.deleteOnDeactivation) {
        void databaseService.destroyLocalDatabase(localDatabaseId);
      } else {
        void databaseService.closeAndRemoveLocalDatabase(localDatabaseId);
      }

      // Cleanup sync state
      syncStateService.removeSyncState(payload.serverId, payload.projectId);
      clearPushOnlyBannerDismissal(payload);

      // updates the state with all of this new information
      state.servers[payload.serverId].projects[payload.projectId] = {
        ...retainedProjectFields(project),
        isActivated: false,
        database: undefined,
      };
    },

    /**
     * Enqueue the post-activation offline map download dialog for a project.
     * Dispatched after activation, when a plan region change invalidates tiles,
     * or from notebook offline map settings when the user starts a download.
     */
    setPendingOfflineMapDownloadPrompt: (
      state,
      action: PayloadAction<PendingOfflineMapDownloadPrompt>
    ) => {
      const queue = ensureOfflineMapPromptQueue(state);
      const key = offlineMapDownloadPromptKey(action.payload);
      const alreadyQueued = queue.some(
        prompt => offlineMapDownloadPromptKey(prompt) === key
      );
      if (!alreadyQueued) {
        queue.push(action.payload);
      }
    },

    /**
     * Dismiss the current offline map download dialog and show the next queued
     * prompt, if any.
     */
    clearPendingOfflineMapDownloadPrompt: state => {
      ensureOfflineMapPromptQueue(state).shift();
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
        syncMode: SyncMode;
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
        syncMode,
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
        ...retainedProjectFields(project),
        isActivated: true,
        database: {
          syncMode,
          isSyncingAttachments,
          localDbId,
          remote: {
            connectionConfiguration,
            remoteDbId,
            syncId,
          },
        },
      };
    },

    setSyncModeSuccess: (state, action: PayloadAction<Project>) => {
      const project = action.payload;
      if (!project.database) {
        throw new Error('Project database not properly initialised');
      }
      state.servers[project.serverId].projects[project.projectId] = {
        ...retainedProjectFields(project),
        isActivated: true,
        database: {
          syncMode: project.database.syncMode,
          isSyncingAttachments: project.database.isSyncingAttachments,
          localDbId: project.database.localDbId,
          remote: {
            connectionConfiguration:
              project.database.remote.connectionConfiguration,
            remoteDbId: project.database.remote.remoteDbId,
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
      if (isReplicating(project.database.syncMode) && oldSyncId) {
        void databaseService.closeAndRemoveSync(oldSyncId);

        updatedSyncId = buildSyncId({
          localId: project.database.localDbId,
          remoteId: project.database.remote.remoteDbId,
        });

        const handlers = createSyncStateHandlers(
          payload.projectId,
          payload.serverId
        );
        const replication = createPouchDbReplication({
          syncMode: project.database.syncMode,
          attachmentDownload: false,
          localDb,
          remoteDb,
          eventHandlers: handlers,
        });
        void databaseService.registerSync(updatedSyncId, replication);
      }

      // updates the state with all of this new information
      state.servers[payload.serverId].projects[payload.projectId] = {
        ...retainedProjectFields(project),
        isActivated: true,
        database: {
          syncMode: project.database.syncMode,
          isSyncingAttachments: false,
          localDbId: project.database.localDbId,
          remote: {
            connectionConfiguration:
              project.database.remote.connectionConfiguration,
            remoteDbId: project.database.remote.remoteDbId,
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
      if (
        isReplicating(project.database.syncMode) &&
        syncModeIncludesPull(project.database.syncMode) &&
        oldSyncId
      ) {
        void databaseService.closeAndRemoveSync(oldSyncId);

        updatedSyncId = buildSyncId({
          localId: project.database.localDbId,
          remoteId: project.database.remote.remoteDbId,
        });

        const handlers = createSyncStateHandlers(
          payload.projectId,
          payload.serverId
        );
        const replication = createPouchDbReplication({
          syncMode: project.database.syncMode,
          attachmentDownload: true,
          localDb,
          remoteDb,
          eventHandlers: handlers,
        });
        void databaseService.registerSync(updatedSyncId, replication);
      }

      // updates the state with all of this new information
      state.servers[payload.serverId].projects[payload.projectId] = {
        ...retainedProjectFields(project),
        isActivated: true,
        database: {
          syncMode: project.database.syncMode,
          isSyncingAttachments: true,
          localDbId: project.database.localDbId,
          remote: {
            connectionConfiguration:
              project.database.remote.connectionConfiguration,
            remoteDbId: project.database.remote.remoteDbId,
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
): PouchDBWrapper<ProjectDataObject>[] {
  const databases: PouchDBWrapper<ProjectDataObject>[] = [];
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
 * Returns the selected server if there is one selected and it is present in the state
 * @param state The projects state
 * @returns The selected server or undefined
 */
export const getSelectedServer = createSelector(
  (state: RootState) => state.projects,
  state => {
    if (!state.selectedServerId) {
      // in the case where we don't have a selected server ID,
      // we return the first server if there is one, otherwise undefined
      if (Object.keys(state.servers).length > 0) {
        return Object.values(state.servers)[0];
      }
      return undefined;
    }
    return state.servers[state.selectedServerId] ?? undefined;
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
 * Targeted selector that only returns the active server's version.
 * This prevents re-renders when other servers or server properties change.
 * Returns undefined if no active server or server has no version.
 */
export const selectActiveServerVersion = createSelector(
  [
    (state: RootState) => state.projects.servers,
    (state: RootState) => selectActiveServerId(state),
  ],
  (servers, activeServerId): string | undefined => {
    if (!activeServerId) return undefined;
    return servers[activeServerId]?.serverVersion;
  }
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
 * Returns the pending offline map download prompt, if any.
 * Set after activation or when an activated project's plan region changes;
 * cleared once the user dismisses or accepts the download offer.
 *
 * @param state Redux state
 * @returns Project identity (and optional region-update flag) or undefined
 */
export const selectPendingOfflineMapDownloadPrompt = (state: RootState) =>
  state.projects.pendingOfflineMapDownloadPrompts?.[0];

/**
 * Finds a project by server and project ID.
 * Memoized to prevent unnecessary re-renders.
 *
 * @param state Redux state
 * @param identity Server and project IDs
 * @returns The project on that server, or undefined
 */
export const selectProjectByIdentity = createSelector(
  [
    (state: RootState) => state.projects.servers,
    (_: RootState, identity: ProjectIdentity) => identity,
  ],
  (servers, identity): Project | undefined =>
    servers[identity.serverId]?.projects[identity.projectId]
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
        if (isReplicating(project.database.syncMode)) {
          const handlers = createSyncStateHandlers(
            project.projectId,
            project.serverId
          );
          const replication = createPouchDbReplication({
            syncMode: project.database.syncMode,
            attachmentDownload: project.database.isSyncingAttachments,
            localDb,
            remoteDb,
            eventHandlers: handlers,
          });
          updatedSyncId = buildSyncId({
            localId: project.database.localDbId,
            remoteId: remoteDbId,
          });
          databaseService.registerSync(updatedSyncId, replication);
        }

        // Step 6: Update Redux state with new configuration
        appDispatch(
          updateDatabaseAuthSuccess({
            projectId: project.projectId,
            serverId,
            connectionConfiguration,
            remoteDbId,
            syncId: updatedSyncId,
            syncMode: project.database.syncMode,
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

  const activationSync = await resolveActivationSyncMode({
    serverUrl: server.serverUrl,
    projectId: payload.projectId,
    token: payload.jwtToken,
  });
  const initialSyncMode = activationSync.syncMode;
  const handlers = createSyncStateHandlers(payload.projectId, payload.serverId);
  let syncId: string | undefined;
  if (isReplicating(initialSyncMode)) {
    const replication = createPouchDbReplication({
      syncMode: initialSyncMode,
      attachmentDownload: false,
      localDb,
      remoteDb,
      eventHandlers: handlers,
    });
    syncId = buildSyncId({
      localId: localDatabaseId,
      remoteId: remoteDbId,
    });
    await databaseService.registerSync(syncId, replication);
  }

  dispatch(
    activateProjectSuccess({
      project,
      serverId: server.serverId,
      localDatabaseId,
      connectionConfiguration,
      remoteDbId,
      syncId: syncId ?? undefined,
      syncMode: initialSyncMode,
      recordCount: activationSync.recordCount,
      ...(activationSync.offlineMapRegionSynced
        ? {offlineMapRegion: activationSync.offlineMapRegion}
        : {}),
    })
  );

  if (activationSync.usedPushOnlyDefault) {
    dispatch(
      addAlert({
        severity: 'info',
        title: 'Sync mode changed',
        autoHideDuration: 12000,
        message: `This ${config.notebookName} has a large number of records. Sync has been set to "upload only" to reduce device stress. Other users' records won't be available unless you change the sync mode in the ${config.notebookName}'s Settings.`,
      })
    );
  }

  // Perform async initialisation outside of reducer
  await couchInitialiser({
    db: localDb,
    config: {forceWrite: true, applyPermissions: false},
    content: initDataDB({projectId: payload.projectId}),
  });

  const offlineMapRegion = activationSync.offlineMapRegionSynced
    ? activationSync.offlineMapRegion
    : project.offlineMapRegion;
  // Offer to download the plan region unless tiles for it are already on device.
  if (config.offlineMaps && offlineMapRegion) {
    const skipPrompt = await shouldSkipOfflineMapActivationPrompt(
      payload.projectId,
      offlineMapRegion
    );
    if (!skipPrompt) {
      dispatch(
        setPendingOfflineMapDownloadPrompt({
          projectId: payload.projectId,
          serverId: payload.serverId,
        })
      );
    }
  }
});

interface ActivateProjectSuccessPayload {
  project: Project;
  serverId: string;
  localDatabaseId: string;
  connectionConfiguration: DatabaseConnectionConfig;
  remoteDbId: string;
  syncId: string | undefined;
  syncMode: SyncMode;
  recordCount?: number;
  offlineMapRegion?: OfflineMapRegion;
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
    for (const conductorUrl of config.conductorUrls) {
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
            serverVersion: apiServerInfo.serverVersion,
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
            // We don't know this yet - it's considered sensitive so we need
            // authentication.
            couchDbUrl: undefined,
            description: apiServerInfo.description,
            serverVersion: apiServerInfo.serverVersion,
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
 * When a local notebook is absent from the active directory listing, the app probes
 * GET `/api/notebooks/:id`: archived → immediate removal; missing → absent streak
 * then local teardown and {@link handleRemoteProjectRemoved} (no global snackbar).
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
    const token = findValidToken(authState, serverId, server);
    if (!token) {
      // This is not really an error, just a server we're not authenticated
      // to yet
      // throw new Error(
      //   `Could not find a suitable active token for the server ${serverId}.`
      // );
      return;
    }

    await withInitialiseProjectsLock(serverId, async () => {
      // Active directory only — archived surveys are detected via per-notebook probe.
      const response = await fetch(`${server.serverUrl}/api/directory`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(
          `Directory request failed. Server ID ${serverId}. URL: ${server.serverUrl}. Status: ${response.status}`
        );
      }

      const directoryResults = (await response.json()) as ProjectListItem[];

      const stateBeforeSync = getState() as RootState;
      // Snapshot local ids now — used later to decide whether removal warrants a user alert.
      const localProjectIdsAtStart = new Set(
        Object.keys(stateBeforeSync.projects.servers[serverId]?.projects ?? {})
      );

      // Fetch all project metadata in parallel
      const metadataResults = await Promise.allSettled(
        directoryResults.map(async details => {
          const projectId = details._id;

          if (!details.dataDb?.base_url) {
            return {
              status: 'error' as const,
              projectId,
              error: 'Missing dataDb.base_url',
            };
          }

          try {
            const meta = await fetchNotebookDetails({
              projectId,
              serverUrl: server.serverUrl,
              token,
            });

            return {
              status: 'success' as const,
              projectId,
              details,
              meta,
            };
          } catch (e) {
            console.warn(
              `Failed to get metadata from API for project ${projectId}.`
            );
            console.error(e);
            return {
              status: 'error' as const,
              projectId,
              details,
              error: e,
            };
          }
        })
      );

      // Re-read state before building add/update actions — metadata fetch is async and
      // other thunks may have modified the store during that window.
      const freshState = getState() as RootState;
      const freshProjectState = freshState.projects;

      // Collect all actions to dispatch
      const actions: Array<
        ReturnType<typeof addProject | typeof updateProjectDetails>
      > = [];
      const offlineMapRegionUpdates: Array<{
        projectId: string;
        previousRegion: OfflineMapRegion | undefined;
        nextRegion: OfflineMapRegion | undefined;
      }> = [];

      for (const result of metadataResults) {
        if (result.status === 'rejected') {
          // Promise itself rejected (shouldn't happen with our structure, but safety first)
          continue;
        }

        const value = result.value;

        if (value.status === 'error') {
          // Check if this is a missing base_url error (no details available)
          if (!value.details) {
            console.warn(`Skipping project ${value.projectId}: ${value.error}`);
            continue;
          }

          // We have details but no metadata - check if project exists
          const existingProject = projectByIdentity(freshProjectState, {
            projectId: value.projectId,
            serverId,
          });

          if (!existingProject) {
            // Can't create without metadata
            console.warn(
              `Failed to get metadata from API for project ${value.projectId} which doesn't exist yet - minimum sufficient information not known so we won't show this record.`
            );
            continue;
          }

          // Update existing with just the couchDbUrl if we have details
          if (value.details?.dataDb?.base_url) {
            actions.push(
              updateProjectDetails({
                ...existingProject,
                projectId: value.projectId,
                serverId,
                couchDbUrl: value.details.dataDb.base_url,
                status: value.details.status ?? existingProject.status,
                name: value.details.name ?? existingProject.name,
                description:
                  value.details.description ?? existingProject.description,
                templateId:
                  value.details.templateId ?? existingProject.templateId,
                updatedAt: value.details.updatedAt ?? existingProject.updatedAt,
              })
            );
          }
          continue;
        }

        // Success case
        const {projectId, details, meta} = value;
        const existingProject = projectByIdentity(freshProjectState, {
          projectId,
          serverId,
        });

        if (!existingProject) {
          actions.push(
            addProject({
              name: meta.name,
              description: meta.description,
              templateId: meta.templateId,
              updatedAt: meta.updatedAt,
              uiDefinition: meta.uiDefinition,
              projectId,
              serverId,
              couchDbUrl: details.dataDb.base_url!,
              status: meta.status,
              offlineMapRegion: meta.offlineMapRegion,
            })
          );
        } else {
          const nextOfflineMapRegion = meta.offlineMapRegion;
          if (
            config.offlineMaps &&
            existingProject.isActivated &&
            !offlineMapRegionsEqual(
              existingProject.offlineMapRegion,
              nextOfflineMapRegion
            )
          ) {
            // Defer side effects until after redux updates so reconciliation
            // reads the new plan region from the store.
            offlineMapRegionUpdates.push({
              projectId,
              previousRegion: existingProject.offlineMapRegion,
              nextRegion: nextOfflineMapRegion,
            });
          }
          actions.push(
            updateProjectDetails({
              name: meta.name ?? existingProject.name,
              description: meta.description ?? existingProject.description,
              templateId: meta.templateId ?? existingProject.templateId,
              updatedAt: meta.updatedAt ?? existingProject.updatedAt,
              uiDefinition: meta.uiDefinition,
              projectId,
              serverId,
              couchDbUrl: details.dataDb.base_url!,
              status: meta.status ?? existingProject.status,
              recordCount: mergeRecordCount(
                meta.recordCount,
                existingProject.recordCount
              ),
              offlineMapRegion: nextOfflineMapRegion,
            })
          );
        }
      }

      // Dispatch all actions
      // Note: If you have redux-batched-actions middleware, you could batch these:
      // appDispatch(batchActions(actions));
      // Otherwise, dispatch sequentially (React 18+ auto-batches in event handlers)
      for (const action of actions) {
        appDispatch(action);
      }

      if (config.offlineMaps) {
        // After store updates, reconcile local tile downloads with any plan
        // region changes and enqueue re-download prompts when needed.
        for (const update of offlineMapRegionUpdates) {
          const result = await reconcileOfflineMapRegionPlanChange({
            projectId: update.projectId,
            previousRegion: update.previousRegion,
            nextRegion: update.nextRegion,
          });
          if (result.action === 'prompt') {
            if (
              update.nextRegion &&
              (await shouldSkipOfflineMapActivationPrompt(
                update.projectId,
                update.nextRegion
              ))
            ) {
              continue;
            }
            appDispatch(
              setPendingOfflineMapDownloadPrompt({
                projectId: update.projectId,
                serverId,
                isRegionUpdate: result.isRegionUpdate,
              })
            );
          }
        }
      }

      // Streak / cleanup decisions must see the same project list the user would
      // after the dispatches above (add/update), not pre-dispatch state.
      // Streak / cleanup decisions must see the same project list the user would
      // after the dispatches above (add/update), not pre-dispatch state.
      const stateAfterDirectory = getState() as RootState;
      const streakKey = (projectId: string) => `${serverId}:${projectId}`;
      const directoryByProjectId = new Map(
        directoryResults.map(d => [d._id, d])
      );
      const localProjectIds = Object.keys(
        stateAfterDirectory.projects.servers[serverId]?.projects ?? {}
      );

      const missingFromActiveDirectory = localProjectIds.filter(
        projectId => !directoryByProjectId.has(projectId)
      );

      const lifecycleByMissingId = new Map(
        (
          await Promise.all(
            missingFromActiveDirectory.map(async projectId => {
              const lifecycle = await probeNotebookServerLifecycle({
                projectId,
                serverUrl: server.serverUrl,
                token,
              });
              return {projectId, lifecycle};
            })
          )
        ).map(({projectId, lifecycle}) => [projectId, lifecycle])
      );

      const removeLocalProjectAfterRemoteLifecycle = (projectId: string) => {
        const proj = projectByIdentity(stateAfterDirectory.projects, {
          serverId,
          projectId,
        });
        if (!proj) {
          return;
        }

        if (config.forceRemoteDeletion === 'allow') {
          appDispatch(removeProject({serverId, projectId}));
        } else {
          appDispatch(detachProjectRetainLocalData({serverId, projectId}));
        }

        if (localProjectIdsAtStart.has(projectId)) {
          handleRemoteProjectRemoved(projectId);
        } else {
          cancelProjectQueries(projectId);
        }
      };

      // Local notebooks missing from the active directory: probe individually.
      // Archived → remove immediately. Missing → absent streak + retry poll.
      let needsAbsentConfirmationRetry = false;

      for (const projectId of localProjectIds) {
        if (directoryByProjectId.has(projectId)) {
          directoryAbsentStreak.delete(streakKey(projectId));
          continue;
        }

        const lifecycle = lifecycleByMissingId.get(projectId) ?? 'unreachable';

        if (lifecycle === 'unreachable') {
          // Do not advance absent streak on probe/network failure.
          continue;
        }

        if (lifecycle === 'active') {
          directoryAbsentStreak.delete(streakKey(projectId));
          continue;
        }

        if (lifecycle === 'archived') {
          directoryAbsentStreak.delete(streakKey(projectId));
          removeLocalProjectAfterRemoteLifecycle(projectId);
          continue;
        }

        // lifecycle === 'missing' — deleted or access revoked; confirm with streak.
        const streakMapKey = streakKey(projectId);
        const streakCount = (directoryAbsentStreak.get(streakMapKey) ?? 0) + 1;
        directoryAbsentStreak.set(streakMapKey, streakCount);
        if (streakCount < DIRECTORY_ABSENT_STREAK_THRESHOLD) {
          needsAbsentConfirmationRetry = true;
          continue;
        }

        directoryAbsentStreak.delete(streakMapKey);
        removeLocalProjectAfterRemoteLifecycle(projectId);
      }

      // Fire at most one delayed `initialiseProjects` to bump absent streaks, or
      // clear the timer when every absent id has either been confirmed or gone away.
      if (needsAbsentConfirmationRetry) {
        scheduleAbsentDirectoryRetry(serverId, appDispatch);
      } else {
        clearAbsentDirectoryRetry(serverId);
      }
    });
  }
);

/**
 * After a directory poll where a local id is still missing and probes report
 * `missing`, schedule another poll so the absent streak can reach
 * {@link DIRECTORY_ABSENT_STREAK_THRESHOLD} without requiring the user to refresh manually.
 *
 * Clears any prior timer first so back-to-back runs collapse to a single
 * pending retry; when the streak is satisfied or the id reappears in the active
 * directory, `clearAbsentDirectoryRetry` stops the loop.
 */
function scheduleAbsentDirectoryRetry(
  serverId: string,
  appDispatch: AppDispatch
) {
  clearAbsentDirectoryRetry(serverId);
  const t = setTimeout(() => {
    pendingAbsentDirectoryRetryTimer.delete(serverId);
    void appDispatch(initialiseProjects({serverId}))
      .unwrap()
      .catch(err => {
        console.warn(
          `Directory retry (absent id confirmation) failed for ${serverId}:`,
          err
        );
      });
  }, DIRECTORY_ABSENT_RETRY_DELAY_MS);
  pendingAbsentDirectoryRetryTimer.set(serverId, t);
}

/**
 * Helper to find a valid token for a server
 */
function findValidToken(
  authState: AuthState,
  serverId: string,
  server: Server
): string | undefined {
  const activeUser = authState.activeUser;

  // Try the active user first - this is the best bet
  if (activeUser && activeUser.serverId === server.serverId) {
    if (!authState.isAuthenticated) {
      throw new Error(
        `You cannot refresh the project list for a logged out active user. Server ID ${serverId}.`
      );
    }
    return activeUser.token;
  }

  // Fall back to any valid token for this server
  const serverUsers = authState.servers[serverId]?.users ?? {};
  for (const user of Object.values(serverUsers)) {
    if (isTokenValid(user)) {
      return user.token;
    }
  }

  return undefined;
}

/**
 * Combines initialisation of all servers' projects.
 */
export const initialiseAllProjects = createAsyncThunk<void>(
  'projects/initialiseAllProjects',
  async (_, {dispatch, getState}) => {
    const state = getState() as RootState;
    const projectState = state.projects;

    // Initialize all servers in parallel
    // Using Promise.allSettled so one server failure doesn't block others
    const results = await Promise.allSettled(
      Object.values(projectState.servers).map(server =>
        dispatch(initialiseProjects({serverId: server.serverId})).unwrap()
      )
    );

    // Log any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const servers = Object.values(projectState.servers);
        console.error(
          `Failed to initialise projects for server ${servers[index]?.serverId}:`,
          result.reason
        );
      }
    });
  }
);

/**
 * Change record replication mode for an activated notebook.
 */
export const setSyncMode = createAsyncThunk<
  void,
  ProjectIdentity & {syncMode: SyncMode}
>('projects/setSyncMode', async (payload, {dispatch, getState}) => {
  const state = getState() as RootState;
  const projectState = state.projects;
  const {syncMode, ...identity} = payload;

  const server = serverById(projectState, identity.serverId);
  if (!server) {
    throw new Error(
      `You cannot change sync mode for a server which does not exist. Server ID: ${identity.serverId}. Project ID: ${identity.projectId}`
    );
  }

  const project = projectByIdentity(projectState, identity);
  if (!project) {
    throw new Error(
      `You cannot change sync mode for a project which does not exist. Server ID: ${identity.serverId}. Project ID: ${identity.projectId}`
    );
  }

  if (!project.isActivated) {
    throw new Error(
      `You cannot change sync mode for an inactive project. Server ID: ${identity.serverId}. Project ID: ${identity.projectId}`
    );
  }

  if (!project.database || !project.database.remote) {
    throw new Error(
      `You cannot change sync mode without a database connection. Server ID: ${identity.serverId}. Project ID: ${identity.projectId}.`
    );
  }

  if (project.database.syncMode === syncMode) {
    return;
  }

  const oldSyncId = project.database.remote.syncId;
  let newSyncId: string | undefined;

  if (!isReplicating(syncMode)) {
    if (oldSyncId) {
      await databaseService.closeAndRemoveSync(oldSyncId);
    }
    syncStateService.removeSyncState(identity.serverId, identity.projectId);
  } else {
    const localDb = databaseService.getLocalDatabase(
      project.database.localDbId
    );
    if (!localDb) {
      throw new Error(
        `The local DB with ID ${project.database.localDbId} does not exist, so cannot change sync mode.`
      );
    }

    const remoteDb = databaseService.getRemoteDatabase(
      project.database.remote.remoteDbId
    );
    if (!remoteDb) {
      throw new Error(
        `The remote DB with ID ${project.database.remote.remoteDbId} does not exist, so cannot change sync mode.`
      );
    }

    const handlers = createSyncStateHandlers(
      identity.projectId,
      identity.serverId
    );
    const result = await replaceProjectReplication({
      syncMode,
      attachmentDownload: project.database.isSyncingAttachments,
      localDb,
      remoteDb,
      localDbId: project.database.localDbId,
      remoteDbId: project.database.remote.remoteDbId,
      eventHandlers: handlers,
      oldSyncId,
    });
    newSyncId = result.syncId;
  }

  const updatedProject: Project = {
    ...project,
    database: {
      ...project.database,
      syncMode,
      remote: {
        ...project.database.remote,
        syncId: newSyncId,
      },
    },
  };

  dispatch(setSyncModeSuccess(updatedProject));
});

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
            if (isReplicating(dbInfo.syncMode) && dbInfo.remote.syncId) {
              const handlers = createSyncStateHandlers(
                project.projectId,
                project.serverId
              );
              const replication = createPouchDbReplication({
                syncMode: dbInfo.syncMode,
                attachmentDownload: dbInfo.isSyncingAttachments,
                localDb,
                remoteDb,
                eventHandlers: handlers,
              });
              await databaseService.registerSync(
                dbInfo.remote.syncId,
                replication,
                {
                  tolerant: true,
                }
              );
            }
          }
          // otherwise we are all good - just local db needed
        } else {
          // This is weird - we have an activated notebook but the database
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
        project.uiDefinition.uiSpec
      );
    }
  }
};

/**
 * Creates event handlers that dispatch setSyncState actions
 *
 * TODO optimise how these handlers dispatch events - may fire very rapidly and
 * cause unwanted re-renders in consuming selectors
 *
 * @param projectId ID of the project this sync belongs to
 * @param serverId ID of the server this project belongs to
 * @param dispatch Redux dispatch function
 * @returns Event handlers that dispatch sync state updates
 */
export function createSyncStateHandlers(
  projectId: string,
  serverId: string
): SyncEventHandlers {
  return {
    active: () => {
      syncStateService.setActive(serverId, projectId);
    },
    change: info => {
      const change = info.change;
      syncStateService.recordChange(serverId, projectId, {
        pending: change.pending ?? 0,
        docsRead: change.docs_read ?? 0,
        docsWritten: change.docs_written ?? 0,
        direction: info.direction,
      });
    },
    paused: err => {
      syncStateService.setPaused(serverId, projectId, err);
    },
    denied: err => {
      syncStateService.setDenied(serverId, projectId, err);
    },
    error: err => {
      syncStateService.setError(serverId, projectId, err);
    },
  };
}

// Private reducers
const {activateProjectSuccess, setSyncModeSuccess} = projectsSlice.actions;

// Public reducers
export const {
  addProject,
  addServer,
  selectServer,
  startSyncingAttachments,
  stopSyncingAttachments,
  removeProject,
  detachProjectRetainLocalData,
  updateDatabaseAuthSuccess,
  updateProjectDetails,
  updateServerDetails,
  markInitialised,
  deactivateProject,
  setPendingOfflineMapDownloadPrompt,
  clearPendingOfflineMapDownloadPrompt,
} = projectsSlice.actions;

export default projectsSlice.reducer;
