// SPDX-License-Identifier: Apache-2.0
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  ProjectStatus,
} from '@faims3/data-model';
import {configureStore} from '@reduxjs/toolkit';
import {beforeEach, describe, expect, it, vi} from 'vitest';

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

import {reportNotebookSchemaCompatibility} from '../../logging';
import {compiledSpecService} from './helpers/compiledSpecService';
import projectsReducer, {
  compileSpecs,
  initialiseProjects,
  initialProjectState,
  reassessSchemaCompatibility,
  type ActivatedProject,
  type ListedProject,
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

function listedFixture(overrides: Partial<ListedProject> = {}): ListedProject {
  return {
    projectId: 'nb-1',
    serverId,
    name: 'Old name',
    description: 'desc',
    status: ProjectStatus.OPEN,
    isActivated: false,
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
  listed = {},
  activated = {},
}: {
  listed?: Record<string, ListedProject>;
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
        listed,
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

function stubFetch({
  directory = [directoryItem()],
  notebookUiSpecification = currentDefinition(),
  notebookUiSpecProperties = uiSpecProperties(),
}: {
  directory?: Record<string, unknown>[];
  notebookUiSpecification?: unknown;
  notebookUiSpecProperties?: {schemaVersion: string; hash: string};
} = {}) {
  const notebook = {
    _id: 'nb-1',
    name: 'Notebook One',
    description: 'desc',
    status: ProjectStatus.OPEN,
    uiSpecification: notebookUiSpecification,
    uiSpecProperties: notebookUiSpecProperties,
    recordCount: 3,
  };
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith('/api/directory')) {
      return {ok: true, json: async () => directory};
    }
    if (url.endsWith('/api/notebooks/nb-1')) {
      return {ok: true, json: async () => notebook};
    }
    return {ok: false, status: 404, json: async () => ({})};
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function listedOf(store: ReturnType<typeof makeStore>, id = 'nb-1') {
  return store.getState().projects.servers[serverId].listed[id];
}

function activatedOf(store: ReturnType<typeof makeStore>, id = 'nb-1') {
  return store.getState().projects.servers[serverId].activated[id];
}

describe('initialiseProjects lean directory + hash refresh', () => {
  beforeEach(() => {
    vi.mocked(reportNotebookSchemaCompatibility).mockClear();
    vi.mocked(compiledSpecService.compileAndRegisterSpec).mockClear();
  });

  it('lists a new notebook without fetching GET /:id', async () => {
    const fetchMock = stubFetch();
    const store = makeStore();

    await store.dispatch(initialiseProjects({serverId}) as any).unwrap();

    const project = listedOf(store);
    expect(project).toBeDefined();
    expect(activatedOf(store)).toBeUndefined();
    expect(project.schemaCompatibility?.tier).toBe('compatible');
    expect(project).not.toHaveProperty('uiDefinition');
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).endsWith('/api/notebooks/nb-1')
      )
    ).toBe(false);
    expect(reportNotebookSchemaCompatibility).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'nb-1',
        serverId,
        serverVersion: '9.9.9',
        source: 'app-ingest',
      })
    );
  });

  it('still lists a NEW notebook whose schema is a newer major (incompatible)', async () => {
    stubFetch({
      directory: [
        directoryItem({
          uiSpecProperties: uiSpecProperties('99.0.0'),
        }),
      ],
    });
    const store = makeStore();

    await store.dispatch(initialiseProjects({serverId}) as any).unwrap();

    const project = listedOf(store);
    expect(project).toBeDefined();
    expect(project.name).toBe('Notebook One');
    expect(project.schemaCompatibility).toMatchObject({
      tier: 'incompatible',
      relation: 'newer-major',
      notebookSchemaVersion: '99.0.0',
    });
    expect(project).not.toHaveProperty('uiDefinition');
    expect(activatedOf(store)).toBeUndefined();
  });

  it('marks a newer minor as degraded without fetching the spec', async () => {
    const [major, minor, patch] = CURRENT_NOTEBOOK_UI_SCHEMA_VERSION.split('.');
    const newerMinor = `${major}.${Number(minor) + 1}.${patch}`;
    const fetchMock = stubFetch({
      directory: [
        directoryItem({
          uiSpecProperties: uiSpecProperties(newerMinor),
        }),
      ],
    });
    const store = makeStore();

    await store.dispatch(initialiseProjects({serverId}) as any).unwrap();

    const project = listedOf(store);
    expect(project.schemaCompatibility?.tier).toBe('degraded');
    expect(project).not.toHaveProperty('uiDefinition');
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).endsWith('/api/notebooks/nb-1')
      )
    ).toBe(false);
  });

  it('patches an existing listed notebook without fetching GET /:id even when the hash changes', async () => {
    const fetchMock = stubFetch({
      directory: [
        directoryItem({
          name: 'Notebook One',
          uiSpecProperties: uiSpecProperties(
            CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
            HASH_B
          ),
        }),
      ],
    });
    const store = makeStore({
      listed: {
        'nb-1': listedFixture({
          name: 'Old name',
          uiSpecProperties: uiSpecProperties(),
        }),
      },
    });

    await store.dispatch(initialiseProjects({serverId}) as any).unwrap();

    const project = listedOf(store);
    expect(project.name).toBe('Notebook One');
    expect(project.uiSpecProperties.hash).toBe(HASH_B);
    expect(project).not.toHaveProperty('uiDefinition');
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).endsWith('/api/notebooks/nb-1')
      )
    ).toBe(false);
  });

  it('does not fetch GET /:id for an activated notebook whose hash matches', async () => {
    const fetchMock = stubFetch();
    const store = makeStore({
      activated: {
        'nb-1': activatedFixture(),
      },
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

  it('fetches GET /:id for an activated notebook when the directory hash changes', async () => {
    const fetchMock = stubFetch({
      directory: [
        directoryItem({
          uiSpecProperties: uiSpecProperties(
            CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
            HASH_B
          ),
        }),
      ],
      notebookUiSpecProperties: uiSpecProperties(
        CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
        HASH_B
      ),
    });
    const store = makeStore({
      activated: {
        'nb-1': activatedFixture(),
      },
    });

    await store.dispatch(initialiseProjects({serverId}) as any).unwrap();

    const project = activatedOf(store);
    expect(project.uiDefinition.uiSpec.fields).toHaveProperty('title');
    expect(project.uiSpecProperties.hash).toBe(HASH_B);
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).endsWith('/api/notebooks/nb-1')
      )
    ).toBe(true);
  });

  it('keeps the last good definition when an activated hash-change ingest is incompatible', async () => {
    const def = currentDefinition();
    def.uiSpec.schemaVersion = '99.0.0';
    def.uiSpec.fields = {};
    stubFetch({
      directory: [
        directoryItem({
          uiSpecProperties: uiSpecProperties('99.0.0', HASH_B),
        }),
      ],
      notebookUiSpecification: def,
      notebookUiSpecProperties: uiSpecProperties('99.0.0', HASH_B),
    });
    const store = makeStore({
      activated: {
        'nb-1': activatedFixture(),
      },
    });

    await store.dispatch(initialiseProjects({serverId}) as any).unwrap();

    const project = activatedOf(store);
    expect(project.name).toBe('Notebook One');
    expect(project.schemaCompatibility?.tier).toBe('incompatible');
    expect(project.uiDefinition.uiSpec.fields).toHaveProperty('title');
  });

  it('keeps the last good definition across a second hash-change sync while already incompatible', async () => {
    const def = currentDefinition();
    def.uiSpec.schemaVersion = '99.0.0';
    def.uiSpec.fields = {};
    stubFetch({
      directory: [
        directoryItem({
          uiSpecProperties: uiSpecProperties('99.0.0', HASH_B),
        }),
      ],
      notebookUiSpecification: def,
      notebookUiSpecProperties: uiSpecProperties('99.0.0', HASH_B),
    });
    const store = makeStore({
      activated: {
        'nb-1': activatedFixture({
          schemaCompatibility: {
            tier: 'incompatible',
            relation: 'newer-major',
            appSchemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
            notebookSchemaVersion: '99.0.0',
            requiresMigration: false,
            reason: 'already flagged',
          },
        }),
      },
    });

    await store.dispatch(initialiseProjects({serverId}) as any).unwrap();

    const project = activatedOf(store);
    expect(project.schemaCompatibility?.tier).toBe('incompatible');
    expect(project.uiDefinition.uiSpec.fields).toHaveProperty('title');
  });
});

describe('reassessSchemaCompatibility (startup, offline-safe)', () => {
  beforeEach(() => {
    vi.mocked(reportNotebookSchemaCompatibility).mockClear();
  });

  it('re-tiers a persisted newer-major design after an app downgrade and keeps its graph', () => {
    const [major] = CURRENT_NOTEBOOK_UI_SCHEMA_VERSION.split('.');
    const newer = currentDefinition();
    newer.uiSpec.schemaVersion = `${Number(major) + 1}.0.0`;
    const store = makeStore({
      activated: {
        'nb-1': activatedFixture({
          name: 'Newer',
          uiDefinition: newer as ActivatedProject['uiDefinition'],
          schemaCompatibility: {
            tier: 'compatible',
            relation: 'current',
            appSchemaVersion: `${Number(major) + 1}.0.0`,
            notebookSchemaVersion: `${Number(major) + 1}.0.0`,
            requiresMigration: false,
            reason: 'ok',
          },
        }),
        'nb-2': activatedFixture({
          projectId: 'nb-2',
          name: 'Fine',
          uiSpecificationId: 'spec-2',
        }),
      },
    });

    store.dispatch(reassessSchemaCompatibility());

    const newerProject = activatedOf(store, 'nb-1');
    const fineProject = activatedOf(store, 'nb-2');
    expect(newerProject.schemaCompatibility?.tier).toBe('incompatible');
    expect(newerProject.schemaCompatibility?.appSchemaVersion).toBe(
      CURRENT_NOTEBOOK_UI_SCHEMA_VERSION
    );
    expect(newerProject.uiDefinition.uiSpec.fields).toHaveProperty('title');
    expect(newerProject.isActivated).toBe(true);
    expect(fineProject.schemaCompatibility?.tier).toBe('compatible');
    expect(reportNotebookSchemaCompatibility).toHaveBeenCalledTimes(1);
    expect(reportNotebookSchemaCompatibility).toHaveBeenCalledWith(
      expect.objectContaining({projectId: 'nb-1', source: 'persisted-reassess'})
    );
  });

  it('assesses listed projects from schemaVersion only', () => {
    const store = makeStore({
      listed: {
        'nb-1': listedFixture({
          name: 'Untracked',
        }),
      },
    });

    store.dispatch(reassessSchemaCompatibility());

    const project = listedOf(store);
    expect(project.schemaCompatibility).toMatchObject({
      tier: 'compatible',
      appSchemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
    });
    expect(reportNotebookSchemaCompatibility).not.toHaveBeenCalled();
  });
});

describe('compileSpecs', () => {
  beforeEach(() => {
    vi.mocked(compiledSpecService.compileAndRegisterSpec).mockClear();
  });

  it('compiles every activated notebook and skips listed ones', () => {
    const store = makeStore({
      listed: {
        'nb-listed': listedFixture({projectId: 'nb-listed', name: 'Listed'}),
      },
      activated: {
        'nb-1': activatedFixture(),
        'nb-2': activatedFixture({
          projectId: 'nb-2',
          uiSpecificationId: 'spec-2',
        }),
      },
    });

    compileSpecs(store.getState().projects);

    expect(compiledSpecService.compileAndRegisterSpec).toHaveBeenCalledTimes(2);
    expect(compiledSpecService.compileAndRegisterSpec).toHaveBeenCalledWith(
      'old-spec',
      expect.objectContaining({fields: expect.any(Object)})
    );
    expect(compiledSpecService.compileAndRegisterSpec).toHaveBeenCalledWith(
      'spec-2',
      expect.objectContaining({fields: expect.any(Object)})
    );
  });
});
