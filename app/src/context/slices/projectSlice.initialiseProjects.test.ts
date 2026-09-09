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
import projectsReducer, {
  initialiseProjects,
  initialProjectState,
  type ProjectsState,
} from './projectSlice';

const serverId = 'server-a';
const serverUrl = 'https://conductor.example';

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

function makeStore(
  projects: ProjectsState['servers'][string]['projects'] = {}
) {
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
        projects,
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

function stubFetch(notebookUiSpecification: unknown) {
  const directory = [
    {
      _id: 'nb-1',
      name: 'Notebook One',
      description: 'desc',
      status: ProjectStatus.OPEN,
      dataDb: {base_url: 'https://couch.example/data-nb-1'},
    },
  ];
  const notebook = {
    _id: 'nb-1',
    name: 'Notebook One',
    description: 'desc',
    status: ProjectStatus.OPEN,
    uiSpecification: notebookUiSpecification,
    recordCount: 3,
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('/api/directory')) {
        return {ok: true, json: async () => directory};
      }
      if (url.endsWith('/api/notebooks/nb-1')) {
        return {ok: true, json: async () => notebook};
      }
      return {ok: false, status: 404, json: async () => ({})};
    })
  );
}

describe('initialiseProjects notebook schema fail-soft', () => {
  beforeEach(() => {
    vi.mocked(reportNotebookSchemaCompatibility).mockClear();
  });

  it('adds a compatible notebook with schemaCompatibility recorded', async () => {
    stubFetch(currentDefinition());
    const store = makeStore();

    await store.dispatch(initialiseProjects({serverId}) as any).unwrap();

    const project =
      store.getState().projects.servers[serverId].projects['nb-1'];
    expect(project).toBeDefined();
    expect(project.schemaCompatibility?.tier).toBe('compatible');
    expect(project.uiDefinition.uiSpec.fields).toHaveProperty('title');
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
    const def = currentDefinition();
    def.uiSpec.schemaVersion = '99.0.0';
    stubFetch(def);
    const store = makeStore();

    await store.dispatch(initialiseProjects({serverId}) as any).unwrap();

    const project =
      store.getState().projects.servers[serverId].projects['nb-1'];
    expect(project).toBeDefined();
    expect(project.name).toBe('Notebook One');
    expect(project.schemaCompatibility).toMatchObject({
      tier: 'incompatible',
      relation: 'newer-major',
      notebookSchemaVersion: '99.0.0',
    });
    // Placeholder graph, salvaged metadata for the skeleton view.
    expect(project.uiDefinition.uiSpec.fields).toEqual({});
    expect(project.uiDefinition.metadata.information.purposeMarkdown).toBe(
      'Purpose'
    );
  });

  it('keeps the last good definition for an EXISTING notebook that becomes incompatible', async () => {
    const good = currentDefinition();
    const store = makeStore({
      'nb-1': {
        projectId: 'nb-1',
        serverId,
        name: 'Old name',
        status: ProjectStatus.OPEN,
        isActivated: false,
        uiDefinition: good as any,
        uiSpecificationId: 'old-spec',
        schemaCompatibility: {
          tier: 'compatible',
          relation: 'current',
          appSchemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
          notebookSchemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
          requiresMigration: false,
          reason: 'ok',
        },
      },
    });

    const def = currentDefinition();
    def.uiSpec.schemaVersion = '99.0.0';
    def.uiSpec.fields = {}; // would otherwise be the placeholder anyway
    stubFetch(def);

    await store.dispatch(initialiseProjects({serverId}) as any).unwrap();

    const project =
      store.getState().projects.servers[serverId].projects['nb-1'];
    expect(project.name).toBe('Notebook One');
    expect(project.schemaCompatibility?.tier).toBe('incompatible');
    // Last good form graph retained so local records remain readable.
    expect(project.uiDefinition.uiSpec.fields).toHaveProperty('title');
  });

  it('marks a newer minor as degraded but stores the best-effort definition', async () => {
    const def = currentDefinition();
    const [major, minor, patch] = CURRENT_NOTEBOOK_UI_SCHEMA_VERSION.split('.');
    def.uiSpec.schemaVersion = `${major}.${Number(minor) + 1}.${patch}`;
    stubFetch(def);
    const store = makeStore();

    await store.dispatch(initialiseProjects({serverId}) as any).unwrap();

    const project =
      store.getState().projects.servers[serverId].projects['nb-1'];
    expect(project.schemaCompatibility?.tier).toBe('degraded');
    expect(project.uiDefinition.uiSpec.fields).toHaveProperty('title');
  });
});
