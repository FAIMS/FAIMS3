/**
 * redux-persist migration for the projects slice (persist version 0 → 1).
 *
 * Older app builds stored each project with a loose `metadata` bag plus
 * `rawUiSpecification` (decoded {@link ProjectUIModel}). Current builds expect
 * a typed {@link NotebookDefinition} on `uiDefinition`, with `description` and
 * `templateId` at the project root.
 *
 * Called from `projectsPersistConfig` in `store.tsx` (`createMigrate` version 1).
 * After migration, `isInitialised` is reset to `false` so sync re-runs against
 * the server with the modern shape.
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
} from './projectSlice';
import {notebookDefinitionFromLegacyPersistedProject} from './helpers/notebookDefinition';

const emptyProjectsState: ProjectsState = {
  servers: {},
  isInitialised: false,
};

const PERSIST_MIGRATION_LOG = '[redux-persist-migration]';

const logMigrationInfo = (
  event: string,
  fields?: Record<string, unknown>
): void => logInfo(`${PERSIST_MIGRATION_LOG} ${event}`, fields ?? {});

const logMigrationWarn = (
  event: string,
  fields?: Record<string, unknown>
): void => logWarn(`${PERSIST_MIGRATION_LOG} ${event}`, fields ?? {});

type PersistMigrationStats = {
  legacyMigrated: number;
  normalized: number;
  lightNormalizeFallback: number;
  skippedNoPayload: number;
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
    ? import('@faims3/data-model').ProjectUIModel
    : never;
  uiDefinition?: NotebookDefinition;
  description?: string;
  templateId?: string;
  updatedAt?: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function countProjects(servers: ProjectsState['servers'] | undefined): number {
  if (!servers) {
    return 0;
  }
  return Object.values(servers).reduce(
    (total, server) => total + Object.keys(server?.projects ?? {}).length,
    0
  );
}

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
 * redux-persist migration 1: legacy `metadata` + `rawUiSpecification` →
 * `uiDefinition`, with root-level `description` / `templateId`.
 *
 * Safe on corrupt or non-object persisted blobs (returns {@link emptyProjectsState}).
 * Per-project failures are dropped rather than failing the whole migration.
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
