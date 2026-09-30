// SPDX-License-Identifier: Apache-2.0
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  ProjectStatus,
  Role,
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
  clearProjectQuickShare,
  initialProjectState,
  setProjectQuickShare,
  updateDatabaseAuthSuccess,
  updateProjectDetails,
  type Project,
  type ProjectQuickShare,
  type ProjectsState,
} from './projectSlice';

const serverId = 'server-a';
const projectId = 'project-1';
const otherProjectId = 'project-2';
const uiSpecificationId = `${serverId}-${projectId}`;

const sampleShare: ProjectQuickShare = {
  inviteId: 'FAIMS-quicksharecode',
  role: Role.PROJECT_GUEST,
  expiry: 1_700_000_000_000,
  qrCode: 'data:image/png;base64,qr',
  createdBy: 'ada',
};

const replacementShare: ProjectQuickShare = {
  inviteId: 'FAIMS-replacement',
  role: Role.PROJECT_CONTRIBUTOR,
  expiry: 1_800_000_000_000,
  qrCode: 'data:image/png;base64,next',
  createdBy: 'ada',
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

function buildProject(overrides: Partial<Project> = {}): Project {
  return {
    projectId,
    serverId,
    name: 'Test notebook',
    description: '',
    status: ProjectStatus.OPEN,
    isActivated: true,
    uiSpecificationId,
    uiSpecProperties: {
      schemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
      hash: 'a'.repeat(64),
    },
    uiDefinition: emptyUiDefinition,
    disableQuickShare: true,
    quickShare: sampleShare,
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

function stateWithProjects(projects: Record<string, Project>): ProjectsState {
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
        listed: {},
        activated: Object.fromEntries(
          Object.entries(projects).map(([id, project]) => [
            id,
            project as Extract<Project, {isActivated: true}>,
          ])
        ),
      },
    },
  };
}

function projectAt(state: ProjectsState, id = projectId): Project {
  return (
    state.servers[serverId]!.activated[id] ??
    state.servers[serverId]!.listed[id]!
  );
}

describe('projectSlice quick share', () => {
  it('stores a share on the matching project and replaces an existing one', () => {
    const before = stateWithProjects({
      [projectId]: buildProject({quickShare: undefined}),
      [otherProjectId]: buildProject({
        projectId: otherProjectId,
        quickShare: sampleShare,
      }),
    });

    const stored = projectsReducer(
      before,
      setProjectQuickShare({
        projectId,
        serverId,
        quickShare: sampleShare,
      })
    );

    expect(projectAt(stored).quickShare).toEqual(sampleShare);
    expect(projectAt(stored, otherProjectId).quickShare).toEqual(sampleShare);

    const replaced = projectsReducer(
      stored,
      setProjectQuickShare({
        projectId,
        serverId,
        quickShare: replacementShare,
      })
    );

    expect(projectAt(replaced).quickShare).toEqual(replacementShare);
    expect(projectAt(replaced, otherProjectId).quickShare).toEqual(sampleShare);
  });

  it('does nothing when setting or clearing a share for a missing project', () => {
    const before = stateWithProjects({
      [projectId]: buildProject(),
    });

    const afterSet = projectsReducer(
      before,
      setProjectQuickShare({
        projectId: 'missing',
        serverId,
        quickShare: replacementShare,
      })
    );
    const afterClear = projectsReducer(
      before,
      clearProjectQuickShare({projectId: 'missing', serverId})
    );

    expect(afterSet).toBe(before);
    expect(afterClear).toBe(before);
    expect(projectAt(before).quickShare).toEqual(sampleShare);
  });

  it('clears the stored share and leaves the project otherwise unchanged', () => {
    const before = stateWithProjects({
      [projectId]: buildProject(),
      [otherProjectId]: buildProject({
        projectId: otherProjectId,
        quickShare: replacementShare,
      }),
    });

    const after = projectsReducer(
      before,
      clearProjectQuickShare({projectId, serverId})
    );

    expect(projectAt(after).quickShare).toBeUndefined();
    expect(projectAt(after).disableQuickShare).toBe(true);
    expect(projectAt(after).name).toBe('Test notebook');
    expect(projectAt(after, otherProjectId).quickShare).toEqual(
      replacementShare
    );
  });

  it('keeps the local share when a metadata update changes disableQuickShare', () => {
    const before = stateWithProjects({[projectId]: buildProject()});

    const enabled = projectsReducer(
      before,
      updateProjectDetails({
        projectId,
        serverId,
        name: 'Renamed notebook',
        description: '',
        status: ProjectStatus.OPEN,
        uiDefinition: emptyUiDefinition,
        uiSpecProperties: projectAt(before).uiSpecProperties,
        couchDbUrl: 'https://couch.example',
        disableQuickShare: false,
      })
    );

    expect(projectAt(enabled).quickShare).toEqual(sampleShare);
    expect(projectAt(enabled).disableQuickShare).toBe(false);
    expect(projectAt(enabled).name).toBe('Renamed notebook');

    const clearedFlag = projectsReducer(
      enabled,
      updateProjectDetails({
        projectId,
        serverId,
        name: 'Renamed notebook',
        description: '',
        status: ProjectStatus.OPEN,
        uiDefinition: emptyUiDefinition,
        uiSpecProperties: projectAt(enabled).uiSpecProperties,
        couchDbUrl: 'https://couch.example',
      })
    );

    expect(projectAt(clearedFlag).quickShare).toEqual(sampleShare);
    expect(projectAt(clearedFlag).disableQuickShare).toBeUndefined();
  });

  it('keeps disableQuickShare on a partial update that still carries the existing project', () => {
    const before = stateWithProjects({[projectId]: buildProject()});
    const existing = projectAt(before);

    const after = projectsReducer(
      before,
      updateProjectDetails({
        ...existing,
        projectId,
        serverId,
        name: 'Renamed notebook',
        couchDbUrl: 'https://couch.example',
      })
    );

    expect(projectAt(after).disableQuickShare).toBe(true);
    expect(projectAt(after).quickShare).toEqual(sampleShare);
  });

  it('updateDatabaseAuthSuccess retains quickShare and disableQuickShare', () => {
    const before = stateWithProjects({[projectId]: buildProject()});
    const project = projectAt(before);

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

    const updated = projectAt(after);
    expect(updated.quickShare).toEqual(sampleShare);
    expect(updated.disableQuickShare).toBe(true);
    expect(updated.database?.remote.connectionConfiguration.jwtToken).toBe(
      'new-token'
    );
  });
});
