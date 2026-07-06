import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  ProjectStatus,
  type OfflineMapRegion,
} from '@faims3/data-model';
import {describe, expect, it, vi} from 'vitest';

vi.mock('../store', () => ({
  store: {
    getState: vi.fn(),
    dispatch: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  },
}));

vi.mock('./helpers/compiledSpecService', () => ({
  compiledSpecService: {
    compileAndRegisterSpec: vi.fn(),
    removeSpec: vi.fn(),
  },
}));

import projectsReducer, {
  initialProjectState,
  updateDatabaseAuthSuccess,
  updateProjectDetails,
  type Project,
  type ProjectsState,
} from './projectSlice';

const serverId = 'server-a';
const projectId = 'project-1';
const uiSpecificationId = `${serverId}-${projectId}`;

const sampleRegion: OfflineMapRegion = {
  type: 'Polygon',
  coordinates: [
    [
      [150.0, -34.0],
      [151.0, -34.0],
      [151.0, -33.0],
      [150.0, -33.0],
      [150.0, -34.0],
    ],
  ],
};

const emptyUiDefinition = {
  metadata: {
    schema_version: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
    information: {purposeMarkdown: ''},
  },
  uiSpecification: {
    fields: {},
    fviews: {},
    viewsets: {},
    visible_types: [],
  },
};

function buildActivatedProject(overrides: Partial<Project> = {}): Project {
  return {
    projectId,
    serverId,
    name: 'Test notebook',
    description: '',
    status: ProjectStatus.OPEN,
    isActivated: true,
    uiSpecificationId,
    uiDefinition: emptyUiDefinition,
    offlineMapRegion: sampleRegion,
    database: {
      syncMode: 'both',
      isSyncingAttachments: false,
      localDbId: 'local-1',
      remote: {
        remoteDbId: 'remote-1',
        syncId: 'sync-1',
        connectionConfiguration: {
          jwtToken: 'token',
          couchUrl: 'https://couch.example',
          databaseName: `data-${projectId}`,
        },
      },
    },
    ...overrides,
  };
}

function stateWithProject(project: Project): ProjectsState {
  return {
    ...initialProjectState,
    servers: {
      [serverId]: {
        serverId,
        serverUrl: 'https://example.test',
        serverTitle: 'Test',
        shortCodePrefix: 'T',
        description: '',
        couchDbUrl: 'https://couch.example',
        projects: {[projectId]: project},
      },
    },
  };
}

describe('projectSlice offlineMapRegion retention', () => {
  it('updateDatabaseAuthSuccess retains offlineMapRegion', () => {
    const before = stateWithProject(buildActivatedProject());
    const project = before.servers[serverId]!.projects[projectId]!;

    const after = projectsReducer(
      before,
      updateDatabaseAuthSuccess({
        projectId,
        serverId,
        connectionConfiguration: {
          jwtToken: 'new-token',
          couchUrl: 'https://couch.example',
          databaseName: `data-${projectId}`,
        },
        remoteDbId: 'remote-2',
        syncId: 'sync-2',
        syncMode: project.database!.syncMode,
        isSyncingAttachments: project.database!.isSyncingAttachments,
        localDbId: project.database!.localDbId,
      })
    );

    expect(
      after.servers[serverId]!.projects[projectId]!.offlineMapRegion
    ).toEqual(sampleRegion);
  });

  it('updateProjectDetails retains offlineMapRegion when payload omits it', () => {
    const before = stateWithProject(buildActivatedProject());

    const after = projectsReducer(
      before,
      updateProjectDetails({
        projectId,
        serverId,
        name: 'Renamed notebook',
        description: '',
        status: ProjectStatus.OPEN,
        uiDefinition: emptyUiDefinition,
        couchDbUrl: 'https://couch.example',
      })
    );

    expect(
      after.servers[serverId]!.projects[projectId]!.offlineMapRegion
    ).toEqual(sampleRegion);
  });
});
