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

const emptyProjectsState: ProjectsState = {
  servers: {},
  isInitialised: false,
};
import {
  notebookDefinitionFromLegacyPersistedProject,
  projectUiModelFromUiDefinition,
} from './helpers/notebookDefinition';

/** Persisted shape before uiDefinition / v4 metadata (redux-persist version 0). */
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

    // Touch compile path: ensures uiSpec is structurally valid
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
 * redux-persist migration 1: legacy `metadata` + `rawUiSpecification` → typed
 * `uiDefinition` (and root `description` / `templateId`).
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
