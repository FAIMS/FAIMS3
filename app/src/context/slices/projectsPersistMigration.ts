/**
 * @file projectsPersistMigration.ts
 *
 * redux-persist migrations for the **projects** slice.
 *
 * Wired from `projectsPersistConfig` in `store.tsx` via `createMigrate`. When a
 * user upgrades the app, redux-persist rehydrates IndexedDB state and runs each
 * migration step from the stored `_persist.version` up to the configured
 * version (currently **2**).
 *
 * These functions must be **pure transforms** of persisted JSON: no network I/O,
 * no PouchDB handles, and no Redux dispatches. Structured logging
 * (`[redux-persist-migration]`) is the only intentional side effect.
 *
 * **Version 1** — {@link migrateProjectsPersistedState}
 * - Replaces legacy per-project `metadata` + `rawUiSpecification` with a typed
 *   {@link NotebookDefinition} on `uiDefinition`, and lifts `description` /
 *   `templateId` to the project root.
 * - Resets `isInitialised` to `false` so the app re-fetches the directory and
 *   recompiles specs against the modern shape (see `initialize()`).
 * - Per-project failures are **dropped** (logged) rather than aborting the whole
 *   migration.
 *
 * **Version 2** — {@link migrateProjectsSyncModeV2}
 * - Maps legacy `database.isSyncing: boolean` to {@link SyncMode} on
 *   `database.syncMode` (`true` → `'both'`, `false` → `'none'`).
 * - Preserves all other project fields; does not reset `isInitialised`.
 *
 * @see store.tsx — `projectsPersistConfig.version` and migrate map
 * @see projectsPersistMigration.test.ts — regression tests for v1 and v2
 */
import {
  normalizeNotebookUiSpecification,
  NotebookDefinition,
  ProjectStatus,
} from '@faims3/data-model';
import {logError, logInfo, logWarn} from '@faims3/forms';
import type {
  Project,
  ProjectsState,
  ProjectIdToProjectMap,
  DatabaseConnection,
} from './projectSlice';
import {syncModeFromLegacyIsSyncing} from '../../sync/syncMode';
import {notebookDefinitionFromLegacyPersistedProject} from './helpers/notebookDefinition';

/** Fallback projects state when persisted data is missing or unusable. */
const emptyProjectsState: ProjectsState = {
  servers: {},
  isInitialised: false,
};

/** Log prefix shared with `store.tsx` migrate wrappers for grep-friendly traces. */
const PERSIST_MIGRATION_LOG = '[redux-persist-migration]';

/** Info-level migration progress (counts, server ids, version transitions). */
const logMigrationInfo = (
  event: string,
  fields?: Record<string, unknown>
): void => logInfo(`${PERSIST_MIGRATION_LOG} ${event}`, fields ?? {});

/** Warn-level migration events (skipped projects, partial data loss). */
const logMigrationWarn = (
  event: string,
  fields?: Record<string, unknown>
): void => logWarn(`${PERSIST_MIGRATION_LOG} ${event}`, fields ?? {});

/** Counters aggregated across a single migration run for the completion log. */
type PersistMigrationStats = {
  /** Projects rebuilt from legacy metadata / rawUiSpecification. */
  legacyMigrated: number;
  /** Projects that only needed uiDefinition re-normalisation. */
  normalized: number;
  /** normalize-only path failed; fell back to full legacy migration. */
  lightNormalizeFallback: number;
  /** No uiDefinition, metadata, or rawUiSpecification to migrate. */
  skippedNoPayload: number;
  /** Normalisation or legacy extraction threw. */
  skippedError: number;
};

const emptyPersistMigrationStats = (): PersistMigrationStats => ({
  legacyMigrated: 0,
  normalized: 0,
  lightNormalizeFallback: 0,
  skippedNoPayload: 0,
  skippedError: 0,
});

/**
 * Shape written by redux-persist before migration version 1.
 *
 * Either already has `uiDefinition` (partial upgrade) or still carries legacy
 * `metadata` / `rawUiSpecification` from pre–NotebookDefinition storage.
 */
type LegacyPersistedProject = {
  projectId: string;
  serverId: string;
  name: string;
  isActivated: boolean;
  status: ProjectStatus;
  uiSpecificationId: string;
  database?: Project['database'];
  metadata?: Record<string, unknown>;
  rawUiSpecification?: Project['uiDefinition'] extends infer _U
    ? import('@faims3/data-model').UiSpecModel
    : never;
  uiDefinition?: NotebookDefinition;
  description?: string;
  templateId?: string;
  updatedAt?: string;
};

/** Type guard for corrupt or non-object persisted blobs. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Total project count across all servers (for before/after migration logs). */
function countProjects(servers: ProjectsState['servers'] | undefined): number {
  if (!servers) {
    return 0;
  }
  return Object.values(servers).reduce(
    (total, server) => total + Object.keys(server?.projects ?? {}).length,
    0
  );
}

/** Log and count a single project that could not be migrated (v1). */
function logProjectMigrationError(
  projectId: string,
  serverId: string,
  err: unknown
): void {
  const cause = err instanceof Error ? err : new Error(String(err));
  logMigrationWarn('project_skipped', {
    projectId,
    serverId,
    reason: 'error',
    message: cause.message,
  });
  logError(
    new Error(
      `redux-persist project migration failed for ${projectId} on server ${serverId}: ${cause.message}`
    ),
    {projectId, serverId, cause: cause.message}
  );
}

/**
 * Convert one persisted project record to the current {@link Project} shape.
 *
 * @returns Migrated project, or `undefined` if there is no UI payload to migrate
 *   or normalization / extraction throws (logged, project omitted from output).
 */
function migrateOnePersistedProject(
  legacy: LegacyPersistedProject,
  stats: PersistMigrationStats
): Project | undefined {
  try {
    let uiDefinition: NotebookDefinition;
    let source: 'legacy' | 'uiDefinition';

    if (legacy.uiDefinition) {
      uiDefinition = normalizeNotebookUiSpecification(legacy.uiDefinition);
      source = 'uiDefinition';
    } else if (legacy.metadata || legacy.rawUiSpecification) {
      uiDefinition = notebookDefinitionFromLegacyPersistedProject({
        metadata: legacy.metadata,
        rawUiSpecification: legacy.rawUiSpecification,
      });
      source = 'legacy';
    } else {
      stats.skippedNoPayload++;
      logMigrationInfo('project_skipped', {
        projectId: legacy.projectId,
        serverId: legacy.serverId,
        reason: 'no_ui_payload',
      });
      return undefined;
    }

    const name =
      legacy.name ||
      (typeof legacy.metadata?.name === 'string' ? legacy.metadata.name : '') ||
      'Unknown';

    const description =
      legacy.description ??
      (typeof legacy.metadata?.description === 'string'
        ? legacy.metadata.description
        : '') ??
      uiDefinition.metadata.information.purposeMarkdown.slice(0, 500);

    const templateId =
      legacy.templateId ??
      (typeof legacy.metadata?.template_id === 'string'
        ? legacy.metadata.template_id
        : undefined);

    stats.legacyMigrated++;
    logMigrationInfo('project_migrated', {
      projectId: legacy.projectId,
      serverId: legacy.serverId,
      source,
    });

    return {
      projectId: legacy.projectId,
      serverId: legacy.serverId,
      name,
      description,
      templateId,
      updatedAt: legacy.updatedAt,
      status: legacy.status ?? ProjectStatus.OPEN,
      isActivated: legacy.isActivated,
      uiSpecificationId: legacy.uiSpecificationId,
      uiDefinition,
      database: legacy.database,
    };
  } catch (err) {
    stats.skippedError++;
    logProjectMigrationError(legacy.projectId, legacy.serverId, err);
    return undefined;
  }
}

/**
 * Migrate all projects for one server entry in persisted state.
 *
 * Projects that already have `uiDefinition` without legacy fields get a light
 * pass (normalize spec + backfill `description` only). Everything else goes
 * through {@link migrateOnePersistedProject}.
 */
function migrateServerProjects(
  serverId: string,
  projects: ProjectIdToProjectMap | undefined,
  stats: PersistMigrationStats
): ProjectIdToProjectMap {
  if (!projects) {
    return {};
  }
  const next: ProjectIdToProjectMap = {};
  for (const [id, raw] of Object.entries(projects)) {
    const legacy = raw as LegacyPersistedProject;
    if (legacy.uiDefinition && !legacy.metadata && !legacy.rawUiSpecification) {
      try {
        next[id] = {
          ...legacy,
          uiDefinition: normalizeNotebookUiSpecification(legacy.uiDefinition),
          description:
            legacy.description ??
            legacy.uiDefinition.metadata.information.purposeMarkdown.slice(
              0,
              500
            ),
        } as Project;
        stats.normalized++;
        logMigrationInfo('project_migrated', {
          projectId: id,
          serverId,
          source: 'normalize_only',
        });
      } catch (err) {
        stats.lightNormalizeFallback++;
        logMigrationWarn('normalize_failed', {
          projectId: id,
          serverId,
          message: err instanceof Error ? err.message : String(err),
        });
        const migrated = migrateOnePersistedProject(legacy, stats);
        if (migrated) {
          next[id] = migrated;
        }
      }
      continue;
    }
    const migrated = migrateOnePersistedProject(legacy, stats);
    if (migrated) {
      next[id] = migrated;
    }
  }
  return next;
}

/**
 * redux-persist **migration 1**: legacy notebook shape → current {@link Project}.
 *
 * Transforms the entire persisted `projects` slice:
 * - `metadata` + `rawUiSpecification` → `uiDefinition` ({@link NotebookDefinition})
 * - Root-level `description` and `templateId` backfilled from metadata or spec
 * - `database` left unchanged (sync mode migration is v2)
 *
 * Safe on corrupt or non-object persisted blobs (returns
 * {@link emptyProjectsState}). Per-project failures are dropped rather than
 * failing the whole migration. Always sets `isInitialised: false` on success so
 * startup re-runs directory initialisation.
 *
 * @param state Raw rehydrated state from redux-persist (unknown at runtime)
 * @returns Migrated {@link ProjectsState}
 */
export function migrateProjectsPersistedState(state: unknown): ProjectsState {
  const stats = emptyPersistMigrationStats();

  logMigrationInfo('begin', {persistVersion: 1});

  if (!isPlainObject(state)) {
    logMigrationWarn('aborted', {reason: 'invalid_state'});
    logError(
      new Error(
        'redux-persist projects migration aborted: persisted state is not a plain object'
      ),
      {reason: 'invalid_state'}
    );
    return emptyProjectsState;
  }

  const inbound = state as unknown as ProjectsState;
  const servers = inbound.servers ?? {};
  const serverCount = Object.keys(servers).length;
  const inboundProjectCount = countProjects(servers);

  logMigrationInfo('state_loaded', {
    serverCount,
    projectCount: inboundProjectCount,
    wasInitialised: inbound.isInitialised ?? false,
  });

  const migratedServers: ProjectsState['servers'] = {};

  for (const [serverId, server] of Object.entries(servers)) {
    if (!server) {
      logMigrationWarn('server_skipped', {
        serverId,
        reason: 'missing_server_entry',
      });
      continue;
    }
    const inboundServerProjectCount = Object.keys(server.projects ?? {}).length;
    migratedServers[serverId] = {
      ...server,
      projects: migrateServerProjects(serverId, server.projects, stats),
    };
    const outboundServerProjectCount = Object.keys(
      migratedServers[serverId]!.projects
    ).length;
    logMigrationInfo('server_complete', {
      serverId,
      inboundProjectCount: inboundServerProjectCount,
      outboundProjectCount: outboundServerProjectCount,
      droppedProjectCount:
        inboundServerProjectCount - outboundServerProjectCount,
    });
  }

  const outboundProjectCount = countProjects(migratedServers);

  logMigrationInfo('complete', {
    serverCount,
    inboundProjectCount,
    outboundProjectCount,
    droppedProjectCount: inboundProjectCount - outboundProjectCount,
    legacyMigrated: stats.legacyMigrated,
    normalized: stats.normalized,
    lightNormalizeFallback: stats.lightNormalizeFallback,
    skippedNoPayload: stats.skippedNoPayload,
    skippedError: stats.skippedError,
    resetIsInitialised: true,
  });

  if (stats.skippedError > 0 || inboundProjectCount !== outboundProjectCount) {
    logMigrationWarn('completed_with_losses', {
      droppedProjectCount: inboundProjectCount - outboundProjectCount,
      skippedError: stats.skippedError,
      skippedNoPayload: stats.skippedNoPayload,
    });
  }

  return {
    ...emptyProjectsState,
    ...inbound,
    servers: migratedServers,
    isInitialised: false,
  };
}

/**
 * Persisted {@link DatabaseConnection} before sync-mode work (v2).
 *
 * Older builds stored a boolean `isSyncing` instead of {@link SyncMode}.
 */
type LegacyDatabaseConnection = DatabaseConnection & {
  isSyncing?: boolean;
};

/**
 * Map one persisted database connection to the current shape.
 *
 * If `syncMode` is already present, the record is returned unchanged. Otherwise
 * `isSyncing` is converted via {@link syncModeFromLegacyIsSyncing} (default
 * `true` when the legacy field is absent, matching historical “sync on” default).
 */
function migrateDatabaseConnection(
  database: LegacyDatabaseConnection | undefined
): DatabaseConnection | undefined {
  if (!database) {
    return undefined;
  }
  if ('syncMode' in database && database.syncMode) {
    return database as DatabaseConnection;
  }
  const legacyIsSyncing = database.isSyncing ?? true;
  const {isSyncing: _removed, ...rest} = database;
  return {
    ...rest,
    syncMode: syncModeFromLegacyIsSyncing(legacyIsSyncing),
  };
}

/** Apply {@link migrateDatabaseConnection} when a project has an active database. */
function migrateProjectSyncMode(project: Project): Project {
  if (!project.database) {
    return project;
  }
  return {
    ...project,
    database: migrateDatabaseConnection(
      project.database as LegacyDatabaseConnection
    ),
  };
}

/**
 * redux-persist **migration 2**: `database.isSyncing` boolean → `syncMode` enum.
 *
 * Expands record replication from on/off to directional modes in app code;
 * persisted upgrades map the legacy boolean to:
 * - `isSyncing: true` (or missing) → `'both'`
 * - `isSyncing: false` → `'none'`
 *
 * Does not alter UI definitions, activation flags, or `isInitialised`. Safe on
 * corrupt inbound state (returns {@link emptyProjectsState}).
 *
 * @param state Output of migration 1 (or v0 state that already used `syncMode`)
 * @returns Projects state with `database.syncMode` on every activated project
 */
export function migrateProjectsSyncModeV2(state: unknown): ProjectsState {
  logMigrationInfo('begin', {persistVersion: 2});

  if (!isPlainObject(state)) {
    return emptyProjectsState;
  }

  const inbound = state as unknown as ProjectsState;
  const servers = inbound.servers ?? {};
  const migratedServers: ProjectsState['servers'] = {};

  for (const [serverId, server] of Object.entries(servers)) {
    if (!server) {
      continue;
    }
    const projects: ProjectIdToProjectMap = {};
    for (const [projectId, project] of Object.entries(server.projects ?? {})) {
      projects[projectId] = migrateProjectSyncMode(project);
    }
    migratedServers[serverId] = {...server, projects};
  }

  logMigrationInfo('complete', {persistVersion: 2});

  return {
    ...inbound,
    servers: migratedServers,
  };
}
