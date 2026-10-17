// SPDX-License-Identifier: Apache-2.0
import {
  couchInitialiser,
  initDataDB,
  NotebookDefinition,
  NotebookSchemaCompatibility,
  OfflineMapRegion,
  ProjectDataObject,
  ProjectListItem,
  ProjectStatus,
  PublicServerInfo,
  Role,
  UiSpecProperties,
  assessNotebookSchemaCompatibility,
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
  isPlaceholderNotebookDefinition,
  listingInformationFromDirectoryItem,
  listedProjectFromDirectoryItem,
  reassessPersistedNotebookDefinition,
} from './helpers/notebookDefinition';
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
  probeProjectTombstone,
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
import {reportNotebookSchemaCompatibility} from '../../logging';
import {
  cancelProjectQueries,
  handleRemoteProjectRemoved,
} from '../../utils/remoteProjectRemoval';

export type {SyncMode};

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
// a per-server lock, a user refresh and token refresh could interleave: double
// removal or stale `getState()` vs directory results. One flight per server
// keeps that linear.
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
  // The invite-code prefix used/expected by this server
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

// Maps a project ID -> project (either map on {@link Server})
export type ProjectIdToProjectMap = {[projectId: string]: Project};

/** Superficial notebook details synced from the lean directory / list. */
export interface ProjectListingInformation {
  /** Display title (project document root). */
  name: string;
  /** Operational description (project document root). */
  description?: string;
  /** Source template when created from a template. */
  templateId?: string;
  /**
   * How the server's notebook schema version relates to this build
   * (`compatible` / `degraded` / `incompatible`) with a human readable reason.
   * Absent on state persisted before compatibility tracking; treat as compatible.
   */
  schemaCompatibility?: NotebookSchemaCompatibility;
  /** Survey lifecycle. */
  status: ProjectStatus;
  /** Last update from the server, when known. */
  updatedAt?: string;
  /** Server record count from GET /api/notebooks/:id when known. */
  recordCount?: number;
  /** Recommended offline map download region (EPSG:4326 polygon). */
  offlineMapRegion?: OfflineMapRegion;
  /**
   * When true, Quick Share is hidden on this device. Omitted or false keeps
   * it available.
   */
  disableQuickShare?: boolean;
  /** Digest of the server's uiSpecification (hash + schemaVersion). */
  uiSpecProperties: UiSpecProperties;
}

interface ProjectIdentityFields {
  projectId: string;
  serverId: string;
  name: string;
}

/**
 * One Quick Share stored on the device so its creator can show it again.
 * The invite is a bearer secret. It stays on this shared survey record, so the
 * creator has to be recorded and the code must not be shown to anyone else.
 * The QR PNG is rebuilt when the share dialog opens; only this metadata is
 * persisted.
 */
export interface ProjectQuickShare {
  inviteId: string;
  role: Role;
  /** Expiry timestamp in milliseconds. */
  expiry: number;
  /**
   * Username of the signed-in user who generated this code.
   * Only they are shown the QR.
   */
  createdBy: string;
}

/**
 * The Quick Share code this device is showing for the survey.
 * Kept on listed and activated rows until its creator revokes it or it
 * expires, including across deactivation, reloads, and user switches.
 * Only {@link ProjectQuickShare.createdBy} is shown the QR.
 */
interface ProjectQuickShareFields {
  quickShare?: ProjectQuickShare;
}

/** Directory-only notebook: no form graph, never compiled. */
export interface ListedProject
  extends
    ProjectListingInformation,
    ProjectIdentityFields,
    ProjectQuickShareFields {
  isActivated: false;
}

/** Activated notebook: required design graph, compiled spec, and database. */
export interface ActivatedProject
  extends
    ProjectListingInformation,
    ProjectIdentityFields,
    ProjectQuickShareFields {
  isActivated: true;
  uiDefinition: NotebookDefinition;
  uiSpecificationId: string;
  database: DatabaseConnection;
}

export type Project = ListedProject | ActivatedProject;

/** Type guard: project is activated and has a form graph plus database. */
export function isActivatedProject(
  project: Project
): project is ActivatedProject {
  return project.isActivated;
}

/** Form graph when the project is activated; otherwise undefined. */
export function projectUiDefinition(
  project: Project | undefined
): NotebookDefinition | undefined {
  return project && isActivatedProject(project)
    ? project.uiDefinition
    : undefined;
}

/** Database connection when the project is activated; otherwise undefined. */
export function projectDatabase(
  project: Project | undefined
): DatabaseConnection | undefined {
  return project && isActivatedProject(project) ? project.database : undefined;
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

  // Invite code prefix (e.g. FAIMS in FAIMS-…)
  shortCodePrefix: string;

  // server description
  description: string;

  listed: Record<string, ListedProject>;
  activated: Record<string, ActivatedProject>;
}

/** Union of a server's activated and listed notebooks. */
export function allProjectsOnServer(server: Server): Project[] {
  return [...Object.values(server.activated), ...Object.values(server.listed)];
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

/** Stable `${serverId}:${projectId}` key for maps, queues, and activation. */
export function projectIdentityKey({
  projectId,
  serverId,
}: ProjectIdentity): string {
  return `${serverId}:${projectId}`;
}

/** Dedupe key for the offline map prompt FIFO queue. */
function offlineMapDownloadPromptKey(identity: ProjectIdentity): string {
  return projectIdentityKey(identity);
}

function ensureActivatingProjects(state: ProjectsState): string[] {
  if (!state.activatingProjects) {
    state.activatingProjects = [];
  }
  return state.activatingProjects;
}

function addActivatingProject(
  state: ProjectsState,
  identity: ProjectIdentity
): void {
  const keys = ensureActivatingProjects(state);
  const key = projectIdentityKey(identity);
  if (!keys.includes(key)) {
    keys.push(key);
  }
}

function removeActivatingProject(
  state: ProjectsState,
  identity: ProjectIdentity
): void {
  const keys = ensureActivatingProjects(state);
  const key = projectIdentityKey(identity);
  const index = keys.indexOf(key);
  if (index !== -1) {
    keys.splice(index, 1);
  }
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
  /**
   * Notebooks currently running {@link activateProject}. Not persisted — a
   * reload must not leave a stuck spinner after the thunk is gone.
   */
  activatingProjects?: string[];
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
  activatingProjects: [],
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
function retainedActivatedFields(project: ActivatedProject) {
  return {
    projectId: project.projectId,
    uiDefinition: project.uiDefinition,
    schemaCompatibility: project.schemaCompatibility,
    uiSpecificationId: project.uiSpecificationId,
    uiSpecProperties: project.uiSpecProperties,
    description: project.description,
    templateId: project.templateId,
    updatedAt: project.updatedAt,
    serverId: project.serverId,
    status: project.status,
    name: project.name,
    recordCount: project.recordCount,
    offlineMapRegion: project.offlineMapRegion,
    disableQuickShare: project.disableQuickShare,
    quickShare: project.quickShare,
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
        listed: {},
        activated: {},
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
        listed: state.servers[serverId].listed,
        activated: state.servers[serverId].activated,

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
     * Add a listed (not activated) project. Does not compile a uiSpec.
     */
    addProject: (
      state,
      action: PayloadAction<ListedProject & {couchDbUrl: string}>
    ) => {
      const payload = action.payload;
      const server = serverById(state, payload.serverId);

      if (!server) {
        throw new Error(
          `Cannot add project to non-existent server with ID ${payload.serverId}.`
        );
      }

      if (
        server.listed[payload.projectId] ||
        server.activated[payload.projectId]
      ) {
        throw new Error(
          `Cannot add project since this server already has project with ID ${payload.projectId}.`
        );
      }

      server.couchDbUrl = payload.couchDbUrl;
      const {couchDbUrl: _couchDbUrl, ...listed} = payload;
      server.listed[payload.projectId] = {
        ...listed,
        isActivated: false,
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

      if (isActivatedProject(project)) {
        compiledSpecService.removeSpec(project.uiSpecificationId);
      }

      // Cleanup sync state
      syncStateService.removeSyncState(payload.serverId, payload.projectId);

      delete server.listed[payload.projectId];
      delete server.activated[payload.projectId];
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

      if (isActivatedProject(project)) {
        compiledSpecService.removeSpec(project.uiSpecificationId);
      }

      syncStateService.removeSyncState(payload.serverId, payload.projectId);
      delete server.listed[payload.projectId];
      delete server.activated[payload.projectId];
    },

    /**
     * Update listing fields. Listed rows stay listed (no compile). Activated
     * rows keep their graph unless `uiDefinition` is provided (hash change).
     */
    updateProjectDetails: (
      state,
      action: PayloadAction<
        ProjectListingInformation &
          ProjectIdentity & {
            couchDbUrl: string;
            uiDefinition?: NotebookDefinition;
          }
      >
    ) => {
      const payload = action.payload;
      const server = serverById(state, payload.serverId);

      if (!server) {
        throw new Error(
          `Cannot add project to non-existent server with ID ${payload.serverId}.`
        );
      }

      const existingActivated = server.activated[payload.projectId];
      const existingListed = server.listed[payload.projectId];
      if (!existingActivated && !existingListed) {
        throw new Error(
          `Cannot update project since it does not exist! Server ID ${payload.serverId}, project ID ${payload.projectId}.`
        );
      }

      server.couchDbUrl = payload.couchDbUrl;

      const listing: ProjectListingInformation = {
        name: payload.name,
        description: payload.description,
        templateId: payload.templateId,
        updatedAt: payload.updatedAt,
        schemaCompatibility: payload.schemaCompatibility,
        status: payload.status,
        recordCount: mergeRecordCount(
          payload.recordCount,
          (existingActivated ?? existingListed)!.recordCount
        ),
        offlineMapRegion: payload.offlineMapRegion,
        disableQuickShare: payload.disableQuickShare,
        uiSpecProperties: payload.uiSpecProperties,
      };

      if (existingActivated) {
        let uiDefinition = existingActivated.uiDefinition;
        let uiSpecificationId = existingActivated.uiSpecificationId;
        if (payload.uiDefinition) {
          uiDefinition = payload.uiDefinition;
          const compiledSpecId = buildCompiledSpecId({
            id: {projectId: payload.projectId, serverId: server.serverId},
            uiSpec: payload.uiDefinition.uiSpec,
          });
          if (
            existingActivated.uiSpecificationId &&
            existingActivated.uiSpecificationId !== compiledSpecId
          ) {
            compiledSpecService.removeSpec(existingActivated.uiSpecificationId);
          }
          compiledSpecService.compileAndRegisterSpec(
            compiledSpecId,
            payload.uiDefinition.uiSpec
          );
          uiSpecificationId = compiledSpecId;
        }
        server.activated[payload.projectId] = {
          ...existingActivated,
          ...listing,
          isActivated: true,
          uiDefinition,
          uiSpecificationId,
        };
        return;
      }

      server.listed[payload.projectId] = {
        ...existingListed!,
        ...listing,
        isActivated: false,
      };
    },

    /**
     * Re-evaluate every persisted project's `schemaCompatibility` against this
     * build's `CURRENT_NOTEBOOK_UI_SCHEMA_VERSION`.
     *
     * The stored tier was computed by whichever app version last fetched the
     * notebook; after an upgrade or downgrade (especially offline) it may be
     * stale. Run on startup before `compileSpecs`. See
     * {@link reassessPersistedNotebookDefinition} for the rules.
     */
    reassessSchemaCompatibility: state => {
      for (const server of Object.values(state.servers)) {
        for (const project of Object.values(server.listed)) {
          const next = assessNotebookSchemaCompatibility(
            project.uiSpecProperties.schemaVersion
          );
          if (
            project.schemaCompatibility?.appSchemaVersion ===
              next.appSchemaVersion &&
            project.schemaCompatibility.tier === next.tier
          ) {
            continue;
          }
          project.schemaCompatibility = next;
          if (next.tier !== 'compatible') {
            reportNotebookSchemaCompatibility({
              compatibility: next,
              projectId: project.projectId,
              serverId: server.serverId,
              serverVersion: server.serverVersion,
              notebookName: project.name,
              source: 'persisted-reassess',
            });
          }
        }
        for (const project of Object.values(server.activated)) {
          const next = reassessPersistedNotebookDefinition(project);
          if (!next.changed) continue;
          project.schemaCompatibility = next.schemaCompatibility;
          if (next.uiDefinition !== project.uiDefinition) {
            project.uiDefinition = next.uiDefinition;
            project.uiSpecificationId = buildCompiledSpecId({
              id: {projectId: project.projectId, serverId: server.serverId},
              uiSpec: next.uiDefinition.uiSpec,
            });
          }
          if (next.schemaCompatibility.tier !== 'compatible') {
            reportNotebookSchemaCompatibility({
              compatibility: next.schemaCompatibility,
              projectId: project.projectId,
              serverId: server.serverId,
              serverVersion: server.serverVersion,
              notebookName: project.name,
              source: 'persisted-reassess',
            });
          }
        }
      }
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

      const server = state.servers[serverId];
      delete server.listed[project.projectId];
      removeActivatingProject(state, {
        serverId,
        projectId: project.projectId,
      });
      server.activated[project.projectId] = {
        ...retainedActivatedFields(project),
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

      compiledSpecService.removeSpec(project.uiSpecificationId);
      delete server.activated[payload.projectId];
      server.listed[payload.projectId] = {
        projectId: project.projectId,
        serverId: project.serverId,
        name: project.name,
        description: project.description,
        templateId: project.templateId,
        updatedAt: project.updatedAt,
        schemaCompatibility: project.schemaCompatibility,
        status: project.status,
        recordCount: project.recordCount,
        offlineMapRegion: project.offlineMapRegion,
        disableQuickShare: project.disableQuickShare,
        uiSpecProperties: project.uiSpecProperties,
        isActivated: false,
        ...(project.quickShare ? {quickShare: project.quickShare} : {}),
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
      if (!project || !isActivatedProject(project)) {
        console.error(`Project not found: ${projectId} on server ${serverId}`);
        return;
      }

      // updates the state with all of this new information
      state.servers[serverId].activated[projectId] = {
        ...retainedActivatedFields(project),
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

    setSyncModeSuccess: (state, action: PayloadAction<ActivatedProject>) => {
      const project = action.payload;
      if (!project.database) {
        throw new Error('Project database not properly initialised');
      }
      state.servers[project.serverId].activated[project.projectId] = {
        ...retainedActivatedFields(project),
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
      state.servers[payload.serverId].activated[payload.projectId] = {
        ...retainedActivatedFields(project),
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
      state.servers[payload.serverId].activated[payload.projectId] = {
        ...retainedActivatedFields(project),
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

    /** Remember the Quick Share this device is showing for a survey. */
    setProjectQuickShare: (
      state,
      action: PayloadAction<ProjectIdentity & {quickShare: ProjectQuickShare}>
    ) => {
      const project = projectByIdentity(state, action.payload);
      if (!project) {
        return;
      }
      project.quickShare = action.payload.quickShare;
    },

    /** Drop the stored Quick Share after it has been revoked or has expired. */
    clearProjectQuickShare: (state, action: PayloadAction<ProjectIdentity>) => {
      const project = projectByIdentity(state, action.payload);
      if (!project) {
        return;
      }
      delete project.quickShare;
    },
  },
  extraReducers: builder => {
    builder.addCase('projects/activateProject/pending', (state, action) => {
      addActivatingProject(
        state,
        (action as unknown as {meta: {arg: ProjectIdentity}}).meta.arg
      );
    });
    builder.addCase('projects/activateProject/rejected', (state, action) => {
      removeActivatingProject(
        state,
        (action as unknown as {meta: {arg: ProjectIdentity}}).meta.arg
      );
    });
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
): Project | undefined => {
  const server = state.servers[identity.serverId];
  if (!server) return undefined;
  return (
    server.activated[identity.projectId] ??
    server.listed[identity.projectId] ??
    undefined
  );
};

/**
 * Gets all active data DBs
 */
export function getAllDataDbs(
  state: RootState
): PouchDBWrapper<ProjectDataObject>[] {
  const databases: PouchDBWrapper<ProjectDataObject>[] = [];
  for (const server of Object.values(state.projects.servers)) {
    for (const project of Object.values(server.activated)) {
      if (project.database?.localDbId) {
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
      allProjects = allProjects.concat(allProjectsOnServer(server));
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
      const project = server.activated[projectId] ?? server.listed[projectId];
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

/** Keys of notebooks whose `activateProject` thunk is still in flight. */
export const selectActivatingProjects = (state: RootState): string[] =>
  state.projects.activatingProjects ?? [];

/** True while {@link activateProject} is preparing this notebook. */
export const selectIsProjectActivating = (
  state: RootState,
  identity: ProjectIdentity
): boolean =>
  selectActivatingProjects(state).includes(projectIdentityKey(identity));

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
    servers[identity.serverId]?.activated[identity.projectId] ??
    servers[identity.serverId]?.listed[identity.projectId]
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
    return allProjectsOnServer(server);
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
    return allProjectsOnServer(servers[activeServerId]);
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
  for (const project of Object.values(server.activated)) {
    if (project.database) {
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
  try {
    await runActivateProject(payload, dispatch as AppDispatch, getState);
  } catch (err) {
    const project = projectByIdentity(
      (getState() as RootState).projects,
      payload
    );
    if (!project?.isActivated) {
      dispatch(
        addAlert({
          severity: 'error',
          message:
            err instanceof Error
              ? err.message
              : `Failed to activate this ${config.notebookName}.`,
        })
      );
    }
    throw err;
  }
});

async function runActivateProject(
  payload: ProjectIdentity & DatabaseAuth,
  dispatch: AppDispatch,
  getState: () => unknown
): Promise<void> {
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

  const activationSync = await resolveActivationSyncMode({
    serverUrl: server.serverUrl,
    projectId: payload.projectId,
    token: payload.jwtToken,
  });
  if (!activationSync.details) {
    throw new Error(
      `Cannot activate this ${config.notebookName} without downloading its design. Go online and try again.`
    );
  }
  const details = activationSync.details;
  const compiledSpecId = buildCompiledSpecId({
    id: {projectId: payload.projectId, serverId: payload.serverId},
    uiSpec: details.uiDefinition.uiSpec,
  });
  compiledSpecService.compileAndRegisterSpec(
    compiledSpecId,
    details.uiDefinition.uiSpec
  );

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

  const activating: ActivatedProject = {
    ...project,
    ...details,
    isActivated: true,
    uiDefinition: details.uiDefinition,
    uiSpecificationId: compiledSpecId,
    uiSpecProperties: details.uiSpecProperties,
    schemaCompatibility: details.schemaCompatibility,
    ...(project.quickShare ? {quickShare: project.quickShare} : {}),
    database: {
      syncMode: initialSyncMode,
      isSyncingAttachments: false,
      localDbId: localDatabaseId,
      remote: {
        connectionConfiguration,
        remoteDbId,
        syncId: undefined,
      },
    },
  };

  dispatch(
    activateProjectSuccess({
      project: activating,
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
}

interface ActivateProjectSuccessPayload {
  project: ActivatedProject;
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
 * Whether {@link initialiseProjects} must GET `/api/notebooks/:id` for an
 * already-activated notebook. Hash change is the usual trigger. Also refetch
 * when the stored tier is `incompatible` but this build now reads the listed
 * `schemaVersion` — otherwise an app upgrade would never download the graph
 * (`reassessPersistedNotebookDefinition` stays incompatible until ingest).
 */
function activatedProjectNeedsSpecFetch({
  existing,
  directoryProperties,
}: {
  existing: Project | undefined;
  directoryProperties: UiSpecProperties;
}): boolean {
  if (!existing || !isActivatedProject(existing)) {
    return false;
  }
  if (existing.uiSpecProperties?.hash !== directoryProperties.hash) {
    return true;
  }
  if (existing.schemaCompatibility?.tier !== 'incompatible') {
    return false;
  }
  return (
    assessNotebookSchemaCompatibility(directoryProperties.schemaVersion)
      .tier !== 'incompatible'
  );
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
 * Activated notebooks download the design only when
 * {@link activatedProjectNeedsSpecFetch} is true. A failed or skipped GET
 * must not stamp the directory hash or version-only compatibility — that
 * would skip the next retry and can unlock a last-good / placeholder graph.
 *
 * When a local notebook is absent from the active directory listing, the app probes
 * GET `/api/notebooks/:id`: archived → immediate removal; missing → confirm via
 * GET `/api/tombstones/:id` before local teardown and {@link handleRemoteProjectRemoved}
 * (no global snackbar). No tombstone / probe error → keep local data.
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
      const serverBefore = stateBeforeSync.projects.servers[serverId];
      const localProjectIdsAtStart = new Set([
        ...Object.keys(serverBefore?.listed ?? {}),
        ...Object.keys(serverBefore?.activated ?? {}),
      ]);

      const specFetchesNeeded = directoryResults.filter(details => {
        if (!details.dataDb?.base_url || !details.uiSpecProperties) {
          return false;
        }
        return activatedProjectNeedsSpecFetch({
          existing: projectByIdentity(stateBeforeSync.projects, {
            projectId: details._id,
            serverId,
          }),
          directoryProperties: details.uiSpecProperties,
        });
      });

      const specByProjectId = new Map(
        await Promise.all(
          specFetchesNeeded.map(async details => {
            try {
              const meta = await fetchNotebookDetails({
                projectId: details._id,
                serverUrl: server.serverUrl,
                token,
              });
              return [details._id, meta] as const;
            } catch (e) {
              console.warn(
                `Failed to get metadata from API for project ${details._id}.`
              );
              console.error(e);
              return [details._id, undefined] as const;
            }
          })
        )
      );

      const freshState = getState() as RootState;
      const freshProjectState = freshState.projects;

      const actions: Array<
        ReturnType<typeof addProject | typeof updateProjectDetails>
      > = [];
      const offlineMapRegionUpdates: Array<{
        projectId: string;
        previousRegion: OfflineMapRegion | undefined;
        nextRegion: OfflineMapRegion | undefined;
      }> = [];

      for (const details of directoryResults) {
        const projectId = details._id;
        if (!details.dataDb?.base_url) {
          console.warn(
            `Skipping project ${projectId}: Missing dataDb.base_url`
          );
          continue;
        }
        if (!details.uiSpecProperties) {
          console.warn(
            `Skipping project ${projectId}: Missing uiSpecProperties`
          );
          continue;
        }

        const listing = listingInformationFromDirectoryItem(details);
        const existingProject = projectByIdentity(freshProjectState, {
          projectId,
          serverId,
        });

        const reportListingCompatibility = () => {
          if (!listing.schemaCompatibility) {
            return;
          }
          reportNotebookSchemaCompatibility({
            compatibility: listing.schemaCompatibility,
            projectId,
            serverId,
            serverVersion: server.serverVersion,
            notebookName: listing.name,
            source: 'app-ingest',
          });
        };

        if (!existingProject) {
          reportListingCompatibility();
          actions.push(
            addProject({
              ...listedProjectFromDirectoryItem({item: details, serverId}),
              couchDbUrl: details.dataDb.base_url,
            })
          );
          continue;
        }

        const nextOfflineMapRegion = listing.offlineMapRegion;
        if (
          config.offlineMaps &&
          existingProject.isActivated &&
          !offlineMapRegionsEqual(
            existingProject.offlineMapRegion,
            nextOfflineMapRegion
          )
        ) {
          offlineMapRegionUpdates.push({
            projectId,
            previousRegion: existingProject.offlineMapRegion,
            nextRegion: nextOfflineMapRegion,
          });
        }

        if (!existingProject.isActivated) {
          reportListingCompatibility();
          actions.push(
            updateProjectDetails({
              ...listing,
              projectId,
              serverId,
              couchDbUrl: details.dataDb.base_url,
            })
          );
          continue;
        }

        const meta = specByProjectId.get(projectId);
        if (!meta) {
          actions.push(
            updateProjectDetails({
              ...listing,
              uiSpecProperties: existingProject.uiSpecProperties,
              schemaCompatibility: existingProject.schemaCompatibility,
              projectId,
              serverId,
              couchDbUrl: details.dataDb.base_url,
              recordCount: existingProject.recordCount,
            })
          );
          continue;
        }

        if (meta.schemaCompatibility) {
          reportNotebookSchemaCompatibility({
            compatibility: meta.schemaCompatibility,
            projectId,
            serverId,
            serverVersion: server.serverVersion,
            notebookName: meta.name,
            source: 'app-ingest',
          });
        }

        const incomingIncompatible =
          meta.schemaCompatibility?.tier === 'incompatible';
        const existingHasUsableGraph = !isPlaceholderNotebookDefinition(
          existingProject.uiDefinition
        );
        const nextUiDefinition =
          incomingIncompatible && existingHasUsableGraph
            ? existingProject.uiDefinition
            : meta.uiDefinition;

        actions.push(
          updateProjectDetails({
            name: meta.name ?? existingProject.name,
            description: meta.description ?? existingProject.description,
            templateId: meta.templateId ?? existingProject.templateId,
            updatedAt: meta.updatedAt ?? existingProject.updatedAt,
            uiDefinition: nextUiDefinition,
            schemaCompatibility: meta.schemaCompatibility,
            uiSpecProperties: meta.uiSpecProperties,
            projectId,
            serverId,
            couchDbUrl: details.dataDb.base_url,
            status: meta.status ?? existingProject.status,
            recordCount: mergeRecordCount(
              meta.recordCount,
              existingProject.recordCount
            ),
            offlineMapRegion: meta.offlineMapRegion,
            disableQuickShare: meta.disableQuickShare,
          })
        );
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

      // Cleanup decisions must see the same project list the user would after
      // the dispatches above (add/update), not pre-dispatch state.
      const stateAfterDirectory = getState() as RootState;
      const directoryByProjectId = new Map(
        directoryResults.map(d => [d._id, d])
      );
      const serverAfter = stateAfterDirectory.projects.servers[serverId];
      const localProjectIds = [
        ...Object.keys(serverAfter?.listed ?? {}),
        ...Object.keys(serverAfter?.activated ?? {}),
      ];

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

      // For surveys that look deleted (missing notebook), require tombstone proof
      // before wiping local data — avoids data loss on server glitches.
      const missingLifecycleIds = missingFromActiveDirectory.filter(
        projectId => lifecycleByMissingId.get(projectId) === 'missing'
      );
      const tombstoneByMissingId = new Map(
        (
          await Promise.all(
            missingLifecycleIds.map(async projectId => {
              const tombstone = await probeProjectTombstone({
                projectId,
                serverUrl: server.serverUrl,
                token,
              });
              return {projectId, tombstone};
            })
          )
        ).map(({projectId, tombstone}) => [projectId, tombstone])
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
      // Archived → remove immediately. Missing → tombstone confirmation only.
      for (const projectId of localProjectIds) {
        if (directoryByProjectId.has(projectId)) {
          continue;
        }

        const lifecycle = lifecycleByMissingId.get(projectId) ?? 'unreachable';

        if (lifecycle === 'unreachable' || lifecycle === 'active') {
          // Keep local data: probe failed, or survey still exists server-side.
          continue;
        }

        if (lifecycle === 'archived') {
          removeLocalProjectAfterRemoteLifecycle(projectId);
          continue;
        }

        // lifecycle === 'missing' — only remove when tombstone proves deletion.
        const tombstone = tombstoneByMissingId.get(projectId) ?? 'unreachable';
        if (tombstone === 'tombstoned') {
          removeLocalProjectAfterRemoteLifecycle(projectId);
        }
      }
    });
  }
);

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

  const updatedProject: ActivatedProject = {
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
    for (const project of Object.values(server.activated)) {
      // We have a server/project
      // Now determine what we need to build
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
    for (const project of Object.values(server.activated)) {
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
        // Passed through undefined-and-all: the service needs "unknown" to
        // stay distinct from "nothing pending".
        pending: change.pending,
        docsRead: change.docs_read ?? 0,
        docsWritten: change.docs_written ?? 0,
        direction: info.direction,
      });
    },
    paused: err => {
      syncStateService.setPaused(serverId, projectId, err);
    },
    pullPaused: err => {
      syncStateService.recordPullPause(serverId, projectId, err);
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
  setProjectQuickShare,
  clearProjectQuickShare,
  reassessSchemaCompatibility,
  setPendingOfflineMapDownloadPrompt,
  clearPendingOfflineMapDownloadPrompt,
} = projectsSlice.actions;

export default projectsSlice.reducer;
