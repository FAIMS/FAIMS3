// SPDX-License-Identifier: Apache-2.0
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  ProjectStatus,
} from '@faims3/data-model';
import {configureStore} from '@reduxjs/toolkit';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

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
    getSpec: vi.fn(),
    getCompileError: vi.fn(),
  },
}));

vi.mock('../../logging', () => ({
  reportNotebookSchemaCompatibility: vi.fn(),
  reportNotebookCompileFailure: vi.fn(),
  reportAppServerVersionMismatch: vi.fn(),
  logError: vi.fn(),
}));

const contextualLayerStore = vi.hoisted(() => ({
  getSeenContextualLayersHash: vi.fn(),
  retainListedContextualLayers: vi.fn(),
  notifyContextualLayersChanged: vi.fn(),
  releaseContextualLayersForProject: vi.fn(),
  areContextualLayersOnDevice: vi.fn(),
  markContextualLayersSeen: vi.fn(),
}));

vi.mock('../../gui/components/maps/contextualLayerStore', () => ({
  getSeenContextualLayersHash: contextualLayerStore.getSeenContextualLayersHash,
  retainListedContextualLayers:
    contextualLayerStore.retainListedContextualLayers,
  notifyContextualLayersChanged:
    contextualLayerStore.notifyContextualLayersChanged,
  releaseContextualLayersForProject:
    contextualLayerStore.releaseContextualLayersForProject,
  areContextualLayersOnDevice: contextualLayerStore.areContextualLayersOnDevice,
  markContextualLayersSeen: contextualLayerStore.markContextualLayersSeen,
}));

import {compiledSpecService} from './helpers/compiledSpecService';
import projectsReducer, {
  initialiseProjects,
  initialProjectState,
  refreshProjectDetails,
  type ActivatedProject,
  type ProjectsState,
} from './projectSlice';

const serverId = 'server-a';
const serverUrl = 'https://conductor.example';
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

const currentDefinition = () => ({
  uiSpec: {
    fields: {
      title: {
        'component-namespace': 'faims-custom',
        'component-name': 'TextField',
        'type-returned': 'faims-core::String',
        'component-parameters': {label: 'Title', name: 'title'},
        exportName: 'title',
        initialValue: '',
      },
    },
    views: {s1: {fields: ['title'], label: 'Section'}},
    viewsets: {f1: {views: ['s1'], label: 'Form'}},
    visible_types: ['f1'],
    settings: {showQrCodeButton: false},
    schemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  },
  metadata: {
    information: {
      notebookVersion: '1.0',
      purposeMarkdown: 'Purpose',
      projectLeadLabel: 'Lead',
      leadInstitution: 'Inst',
    },
  },
});

function uiSpecProperties(
  schemaVersion = CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  hash = HASH_A
) {
  return {schemaVersion, hash};
}

function directoryItem(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    _id: 'nb-1',
    name: 'Notebook One',
    description: 'desc',
    status: ProjectStatus.OPEN,
    dataDb: {base_url: 'https://couch.example/data-nb-1'},
    uiSpecProperties: uiSpecProperties(),
    ...overrides,
  };
}

function activatedFixture(
  overrides: Partial<ActivatedProject> = {}
): ActivatedProject {
  return {
    projectId: 'nb-1',
    serverId,
    name: 'Notebook One',
    description: 'desc',
    status: ProjectStatus.OPEN,
    isActivated: true,
    uiDefinition: currentDefinition() as ActivatedProject['uiDefinition'],
    uiSpecificationId: 'old-spec',
    uiSpecProperties: uiSpecProperties(),
    database: {
      syncMode: 'none',
      isSyncingAttachments: false,
      localDbId: 'local-1',
      remote: {
        remoteDbId: 'remote-1',
        syncId: undefined,
        connectionConfiguration: {
          jwtToken: 't',
          couchUrl: 'https://couch.example',
          databaseName: 'data-nb-1',
        },
      },
    },
    schemaCompatibility: {
      tier: 'compatible',
      relation: 'current',
      appSchemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
      notebookSchemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
      requiresMigration: false,
      reason: 'ok',
    },
    ...overrides,
  };
}

function makeStore({
  activated = {},
}: {
  activated?: Record<string, ActivatedProject>;
} = {}) {
  const projectsState: ProjectsState = {
    ...initialProjectState,
    servers: {
      [serverId]: {
        serverId,
        serverUrl,
        serverTitle: 'Test',
        serverVersion: '9.9.9',
        shortCodePrefix: 'T',
        description: '',
        couchDbUrl: 'https://couch.example',
        listed: {},
        activated,
      },
    },
  };
  const authState = {
    servers: {},
    activeUser: {
      serverId,
      username: 'u',
      token: 'tok',
      parsedToken: {} as any,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    },
    isAuthenticated: true,
    refreshError: undefined,
  };
  return configureStore({
    reducer: {
      projects: projectsReducer,
      auth: (state = authState) => state,
    },
    preloadedState: {projects: projectsState, auth: authState},
  });
}

function notebookBody(
  id: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    _id: id,
    name: 'Notebook One',
    description: 'desc',
    status: ProjectStatus.OPEN,
    uiSpecification: currentDefinition(),
    uiSpecProperties: uiSpecProperties(),
    recordCount: 3,
    dataDb: {base_url: `https://couch.example/data-${id}`},
    ...overrides,
  };
}

function stubFetch({
  notebooks = {
    'nb-1': {ok: true, body: notebookBody('nb-1')},
  } as Record<string, {ok: boolean; body?: Record<string, unknown>}>,
  directory,
}: {
  notebooks?: Record<string, {ok: boolean; body?: Record<string, unknown>}>;
  directory?: Record<string, unknown>[];
} = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    const href = String(url);
    if (href.endsWith('/api/directory')) {
      return {ok: true, json: async () => directory ?? []};
    }
    const match = href.match(/\/api\/notebooks\/([^/?]+)$/);
    if (match) {
      const spec = notebooks[match[1]];
      if (!spec) {
        return {ok: false, status: 404, json: async () => ({})};
      }
      if (!spec.ok) {
        return {ok: false, status: 500, json: async () => ({})};
      }
      return {ok: true, json: async () => spec.body};
    }
    return {ok: false, status: 404, json: async () => ({})};
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function activatedOf(store: ReturnType<typeof makeStore>, id = 'nb-1') {
  return store.getState().projects.servers[serverId].activated[id];
}

function notebookUrls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls
    .map(([url]) => String(url))
    .filter(url => url.includes('/api/notebooks/'));
}

describe('refreshProjectDetails', () => {
  beforeEach(() => {
    vi.mocked(compiledSpecService.compileAndRegisterSpec).mockClear();
    contextualLayerStore.getSeenContextualLayersHash
      .mockReset()
      .mockResolvedValue(undefined);
    contextualLayerStore.retainListedContextualLayers
      .mockReset()
      .mockResolvedValue(false);
    contextualLayerStore.notifyContextualLayersChanged.mockReset();
    contextualLayerStore.areContextualLayersOnDevice
      .mockReset()
      .mockReturnValue(false);
    contextualLayerStore.markContextualLayersSeen
      .mockReset()
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches GET /:id for the open survey even when the stored hash matches', async () => {
    const nextDefinition = currentDefinition();
    nextDefinition.uiSpec.fields.notes = {
      'component-namespace': 'faims-custom',
      'component-name': 'TextField',
      'type-returned': 'faims-core::String',
      'component-parameters': {label: 'Notes', name: 'notes'},
      exportName: 'notes',
      initialValue: '',
    };
    const fetchMock = stubFetch({
      notebooks: {
        'nb-1': {
          ok: true,
          body: notebookBody('nb-1', {
            name: 'Renamed creek',
            description: 'updated desc',
            uiSpecification: nextDefinition,
            uiSpecProperties: uiSpecProperties(
              CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
              HASH_A
            ),
          }),
        },
        'nb-2': {
          ok: true,
          body: notebookBody('nb-2', {name: 'Sibling'}),
        },
      },
    });
    const store = makeStore({
      activated: {
        'nb-1': activatedFixture(),
        'nb-2': activatedFixture({
          projectId: 'nb-2',
          name: 'Sibling',
          uiSpecificationId: 'old-spec-2',
        }),
      },
    });

    await store
      .dispatch(refreshProjectDetails({serverId, projectId: 'nb-1'}) as any)
      .unwrap();

    const project = activatedOf(store);
    expect(notebookUrls(fetchMock)).toEqual([
      `${serverUrl}/api/notebooks/nb-1`,
    ]);
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).endsWith('/api/directory')
      )
    ).toBe(false);
    expect(project.name).toBe('Renamed creek');
    expect(project.description).toBe('updated desc');
    expect(project.uiSpecProperties.hash).toBe(HASH_A);
    expect(project.uiDefinition.uiSpec.fields).toHaveProperty('title');
    expect(project.uiDefinition.uiSpec.fields).toHaveProperty('notes');
    expect(project.uiSpecificationId).not.toBe('old-spec');
    expect(activatedOf(store, 'nb-2').name).toBe('Sibling');
    expect(activatedOf(store, 'nb-2').uiSpecificationId).toBe('old-spec-2');
  });

  it('keeps the last-good definition when the forced GET is incompatible', async () => {
    const def = currentDefinition();
    def.uiSpec.schemaVersion = '99.0.0';
    def.uiSpec.fields = {};
    stubFetch({
      notebooks: {
        'nb-1': {
          ok: true,
          body: notebookBody('nb-1', {
            name: 'Too new',
            uiSpecification: def,
            uiSpecProperties: uiSpecProperties('99.0.0', HASH_B),
          }),
        },
      },
    });
    const store = makeStore({
      activated: {'nb-1': activatedFixture()},
    });

    await store
      .dispatch(refreshProjectDetails({serverId, projectId: 'nb-1'}) as any)
      .unwrap();

    const project = activatedOf(store);
    expect(project.name).toBe('Too new');
    expect(project.schemaCompatibility?.tier).toBe('incompatible');
    expect(project.uiSpecProperties.hash).toBe(HASH_B);
    expect(project.uiDefinition.uiSpec.fields).toHaveProperty('title');
  });

  it('leaves hash and last-good definition unchanged when the forced GET fails', async () => {
    const fetchMock = stubFetch({
      notebooks: {
        'nb-1': {ok: false},
      },
    });
    const store = makeStore({
      activated: {
        'nb-1': activatedFixture({name: 'Old name'}),
      },
    });

    await expect(
      store
        .dispatch(refreshProjectDetails({serverId, projectId: 'nb-1'}) as any)
        .unwrap()
    ).rejects.toThrow(/Notebook request failed for nb-1: HTTP 500/);

    const project = activatedOf(store);
    expect(project.name).toBe('Old name');
    expect(project.uiSpecProperties.hash).toBe(HASH_A);
    expect(project.uiDefinition.uiSpec.fields).toHaveProperty('title');
    expect(project.uiSpecificationId).toBe('old-spec');
    expect(notebookUrls(fetchMock)).toEqual([
      `${serverUrl}/api/notebooks/nb-1`,
    ]);
  });
});

describe('initialiseProjects hash skip is unchanged', () => {
  beforeEach(() => {
    contextualLayerStore.getSeenContextualLayersHash
      .mockReset()
      .mockResolvedValue(undefined);
    contextualLayerStore.retainListedContextualLayers
      .mockReset()
      .mockResolvedValue(false);
    contextualLayerStore.areContextualLayersOnDevice
      .mockReset()
      .mockReturnValue(false);
    contextualLayerStore.markContextualLayersSeen
      .mockReset()
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not fetch GET /:id for an activated notebook whose hash matches', async () => {
    const fetchMock = stubFetch({
      directory: [directoryItem()],
      notebooks: {
        'nb-1': {ok: true, body: notebookBody('nb-1')},
      },
    });
    const store = makeStore({
      activated: {'nb-1': activatedFixture()},
    });

    await store.dispatch(initialiseProjects({serverId}) as any).unwrap();

    const project = activatedOf(store);
    expect(project.uiDefinition.uiSpec.fields).toHaveProperty('title');
    expect(project.uiSpecificationId).toBe('old-spec');
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).endsWith('/api/notebooks/nb-1')
      )
    ).toBe(false);
  });
});
