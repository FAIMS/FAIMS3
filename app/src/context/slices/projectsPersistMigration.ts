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
import type {
  Project,
  ProjectsState,
  ProjectIdToProjectMap,
} from './projectSlice';
import {
  notebookDefinitionFromLegacyPersistedProject,
  projectUiModelFromUiDefinition,
} from './helpers/notebookDefinition';

const emptyProjectsState: ProjectsState = {
  servers: {},
  isInitialised: false,
};

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

/**
 * Convert one persisted project record to the current {@link Project} shape.
 *
 * @returns Migrated project, or `undefined` if there is no UI payload to migrate
 *   or normalization / extraction throws (logged, project omitted from output).
 */
function migrateOnePersistedProject(
  legacy: LegacyPersistedProject
): Project | undefined {
  try {
    let uiDefinition: NotebookDefinition;

    if (legacy.uiDefinition) {
      uiDefinition = normalizeNotebookUiSpecification(legacy.uiDefinition);
    } else if (legacy.metadata || legacy.rawUiSpecification) {
      uiDefinition = notebookDefinitionFromLegacyPersistedProject({
        metadata: legacy.metadata,
        rawUiSpecification: legacy.rawUiSpecification,
      });
    } else {
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

    // Verify uiDefinition.uiSpec is present and can be split into ProjectUIModel
    // (same helper used at runtime before DataEngine / compiledSpecService). Invalid
    // specs throw here and the project is skipped in the catch below.
    projectUiModelFromUiDefinition(uiDefinition);

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
    console.warn(
      `Skipping redux-persist project migration for ${legacy.projectId}:`,
      err
    );
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
  projects: ProjectIdToProjectMap | undefined
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
      } catch {
        const migrated = migrateOnePersistedProject(legacy);
        if (migrated) {
          next[id] = migrated;
        }
      }
      continue;
    }
    const migrated = migrateOnePersistedProject(legacy);
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
    migratedServers[serverId] = {
      ...server,
      projects: migrateServerProjects(server.projects),
    };
  }

  return {
    ...emptyProjectsState,
    ...inbound,
    servers: migratedServers,
    isInitialised: false,
  };
}
