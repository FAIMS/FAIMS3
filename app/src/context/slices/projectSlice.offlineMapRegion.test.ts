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
  clearPendingOfflineMapDownloadPrompt,
  initialProjectState,
  selectPendingOfflineMapDownloadPrompt,
  setPendingOfflineMapDownloadPrompt,
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
    information: {
      notebookVersion: '',
      purposeMarkdown: '',
      projectLeadLabel: '',
      leadInstitution: '',
    },
  },
  uiSpec: {
    fields: {},
    views: {},
    viewsets: {},
    visible_types: [],
    settings: {showQrCodeButton: false},
    schemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
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

  it('updateProjectDetails clears offlineMapRegion when payload omits it (200 OK sync)', () => {
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
    ).toBeUndefined();
  });

  it('updateProjectDetails retains offlineMapRegion on partial non-metadata updates', () => {
    const before = stateWithProject(buildActivatedProject());
    const existingProject = before.servers[serverId]!.projects[projectId]!;

    const after = projectsReducer(
      before,
      updateProjectDetails({
        ...existingProject,
        projectId,
        serverId,
        name: 'Renamed notebook',
        couchDbUrl: 'https://couch.example',
      })
    );

    expect(
      after.servers[serverId]!.projects[projectId]!.offlineMapRegion
    ).toEqual(sampleRegion);
  });

  it('updateProjectDetails clears offlineMapRegion when payload explicitly sets undefined', () => {
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
        offlineMapRegion: undefined,
      })
    );

    expect(
      after.servers[serverId]!.projects[projectId]!.offlineMapRegion
    ).toBeUndefined();
  });
});

describe('projectSlice offline map download prompt queue', () => {
  it('enqueues multiple prompts without overwriting earlier ones', () => {
    let state = initialProjectState;

    state = projectsReducer(
      state,
      setPendingOfflineMapDownloadPrompt({
        projectId: 'project-1',
        serverId,
      })
    );
    state = projectsReducer(
      state,
      setPendingOfflineMapDownloadPrompt({
        projectId: 'project-2',
        serverId,
        isRegionUpdate: true,
      })
    );

    expect(state.pendingOfflineMapDownloadPrompts).toEqual([
      {projectId: 'project-1', serverId},
      {
        projectId: 'project-2',
        serverId,
        isRegionUpdate: true,
      },
    ]);
    expect(
      selectPendingOfflineMapDownloadPrompt({projects: state} as never)
    ).toEqual({projectId: 'project-1', serverId});
  });

  it('deduplicates prompts for the same project', () => {
    let state = initialProjectState;

    state = projectsReducer(
      state,
      setPendingOfflineMapDownloadPrompt({
        projectId: 'project-1',
        serverId,
      })
    );
    state = projectsReducer(
      state,
      setPendingOfflineMapDownloadPrompt({
        projectId: 'project-1',
        serverId,
        isRegionUpdate: true,
      })
    );

    expect(state.pendingOfflineMapDownloadPrompts).toEqual([
      {projectId: 'project-1', serverId},
    ]);
  });

  it('shows the next prompt after clearing the current one', () => {
    let state = projectsReducer(
      initialProjectState,
      setPendingOfflineMapDownloadPrompt({
        projectId: 'project-1',
        serverId,
      })
    );
    state = projectsReducer(
      state,
      setPendingOfflineMapDownloadPrompt({
        projectId: 'project-2',
        serverId,
      })
    );

    state = projectsReducer(state, clearPendingOfflineMapDownloadPrompt());

    expect(state.pendingOfflineMapDownloadPrompts).toEqual([
      {projectId: 'project-2', serverId},
    ]);
    expect(
      selectPendingOfflineMapDownloadPrompt({projects: state} as never)
    ).toEqual({projectId: 'project-2', serverId});
  });

  it('initialises the queue when rehydrated state omits it', () => {
    const rehydratedFromMain = {
      ...initialProjectState,
      pendingOfflineMapDownloadPrompts: undefined,
    };

    const state = projectsReducer(
      rehydratedFromMain,
      setPendingOfflineMapDownloadPrompt({
        projectId: 'project-1',
        serverId,
      })
    );

    expect(state.pendingOfflineMapDownloadPrompts).toEqual([
      {projectId: 'project-1', serverId},
    ]);
  });
});
