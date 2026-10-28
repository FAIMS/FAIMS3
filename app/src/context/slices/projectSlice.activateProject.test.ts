// SPDX-License-Identifier: Apache-2.0
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  ProjectStatus,
} from '@faims3/data-model';
import {configureStore} from '@reduxjs/toolkit';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const {
  resolveActivationSyncMode,
  createLocalPouchDatabase,
  createRemotePouchDbFromConnectionInfo,
  createPouchDbReplication,
  registerLocalDatabase,
  registerRemoteDatabase,
  registerSync,
  couchInitialiser,
} = vi.hoisted(() => ({
  resolveActivationSyncMode: vi.fn(),
  createLocalPouchDatabase: vi.fn(),
  createRemotePouchDbFromConnectionInfo: vi.fn(),
  createPouchDbReplication: vi.fn(),
  registerLocalDatabase: vi.fn(),
  registerRemoteDatabase: vi.fn(),
  registerSync: vi.fn(),
  couchInitialiser: vi.fn(),
}));

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

vi.mock('./helpers/databaseHelpers', async importOriginal => {
  const actual =
    await importOriginal<typeof import('./helpers/databaseHelpers')>();
  return {
    ...actual,
    createLocalPouchDatabase,
    createRemotePouchDbFromConnectionInfo,
    createPouchDbReplication,
  };
});

vi.mock('./helpers/databaseService', () => ({
  databaseService: {
    registerLocalDatabase,
    registerRemoteDatabase,
    registerSync,
  },
}));

vi.mock('@faims3/data-model', async importOriginal => {
  const actual = await importOriginal<typeof import('@faims3/data-model')>();
  return {
    ...actual,
    couchInitialiser,
  };
});

vi.mock('../../sync/syncModeDefaults', () => ({
  resolveActivationSyncMode,
}));

vi.mock('../../logging', () => ({
  reportNotebookSchemaCompatibility: vi.fn(),
  reportNotebookCompileFailure: vi.fn(),
  reportAppServerVersionMismatch: vi.fn(),
  logError: vi.fn(),
}));

import alertsReducer from './alertSlice';
import {compiledSpecService} from './helpers/compiledSpecService';
import projectsReducer, {
  activateProject,
  initialProjectState,
  projectIdentityKey,
  type ListedProject,
  type ProjectsState,
} from './projectSlice';

const serverId = 'server-a';
const serverUrl = 'https://conductor.example';
const projectId = 'nb-1';
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

const detailsDefinition = {
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
};

const getDetailsPayload = {
  name: 'Notebook One from GET',
  description: 'from details',
  uiDefinition: detailsDefinition,
  uiSpecProperties: {
    schemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
    hash: HASH_B,
  },
  schemaCompatibility: {
    tier: 'compatible' as const,
    relation: 'current' as const,
    appSchemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
    notebookSchemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
    requiresMigration: false,
    reason: 'ok',
  },
  recordCount: 3,
};

function listedFixture(overrides: Partial<ListedProject> = {}): ListedProject {
  return {
    projectId,
    serverId,
    name: 'Notebook One',
    description: 'desc',
    status: ProjectStatus.OPEN,
    isActivated: false,
    uiSpecProperties: {
      schemaVersion: CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
      hash: HASH_A,
    },
    ...overrides,
  };
}

function makeStore() {
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
        listed: {[projectId]: listedFixture()},
        activated: {},
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
      alerts: alertsReducer,
    },
    preloadedState: {
      projects: projectsState,
      auth: authState,
      alerts: {alerts: []},
    },
  });
}

describe('activateProject requires downloaded design details', () => {
  beforeEach(() => {
    resolveActivationSyncMode.mockReset();
    createLocalPouchDatabase.mockReset().mockReturnValue({});
    createRemotePouchDbFromConnectionInfo.mockReset().mockReturnValue({
      id: 'remote-db-id',
      db: {},
    });
    createPouchDbReplication.mockReset().mockReturnValue({});
    registerLocalDatabase.mockReset().mockResolvedValue(undefined);
    registerRemoteDatabase.mockReset().mockResolvedValue(undefined);
    registerSync.mockReset().mockResolvedValue(undefined);
    couchInitialiser.mockReset().mockResolvedValue(undefined);
    vi.mocked(compiledSpecService.compileAndRegisterSpec).mockClear();
  });

  it('throws when resolveActivationSyncMode omits the GET details payload', async () => {
    resolveActivationSyncMode.mockResolvedValue({
      syncMode: 'both',
      usedPushOnlyDefault: false,
    });
    const store = makeStore();

    await expect(
      store
        .dispatch(
          activateProject({
            serverId,
            projectId,
            jwtToken: 'tok',
          }) as any
        )
        .unwrap()
    ).rejects.toThrow(/without downloading its design/);

    expect(resolveActivationSyncMode).toHaveBeenCalledWith({
      serverUrl,
      projectId,
      token: 'tok',
    });
    expect(
      store.getState().projects.servers[serverId].activated[projectId]
    ).toBeUndefined();
    expect(
      store.getState().projects.servers[serverId].listed[projectId]
    ).toBeDefined();
    expect(store.getState().projects.activatingProjects).toEqual([]);
    expect(store.getState().alerts.alerts[0]?.message).toMatch(
      /without downloading its design/
    );
  });

  it('adds an activating key immediately while the notebook stays listed', async () => {
    let finish!: (value: unknown) => void;
    resolveActivationSyncMode.mockReturnValue(
      new Promise(resolve => {
        finish = resolve;
      })
    );
    const store = makeStore();
    const pending = store.dispatch(
      activateProject({
        serverId,
        projectId,
        jwtToken: 'tok',
      }) as any
    );

    expect(store.getState().projects.activatingProjects).toEqual([
      projectIdentityKey({serverId, projectId}),
    ]);
    expect(
      store.getState().projects.servers[serverId].listed[projectId]
    ).toBeDefined();
    expect(
      store.getState().projects.servers[serverId].activated[projectId]
    ).toBeUndefined();

    finish({
      syncMode: 'both',
      usedPushOnlyDefault: false,
      details: getDetailsPayload,
      recordCount: 3,
    });
    await pending;

    expect(store.getState().projects.activatingProjects).toEqual([]);
    expect(
      store.getState().projects.servers[serverId].activated[projectId]
        ?.isActivated
    ).toBe(true);
  });

  it('clears the activating key and alerts when prepare fails', async () => {
    resolveActivationSyncMode.mockRejectedValue(new Error('offline'));
    const store = makeStore();

    await expect(
      store
        .dispatch(
          activateProject({
            serverId,
            projectId,
            jwtToken: 'tok',
          }) as any
        )
        .unwrap()
    ).rejects.toThrow('offline');

    expect(store.getState().projects.activatingProjects).toEqual([]);
    expect(
      store.getState().projects.servers[serverId].listed[projectId]
    ).toBeDefined();
    expect(
      store.getState().projects.servers[serverId].activated[projectId]
    ).toBeUndefined();
    expect(store.getState().alerts.alerts[0]?.message).toBe('offline');
  });

  it('moves the listed notebook to activated with the GET details design payload', async () => {
    resolveActivationSyncMode.mockResolvedValue({
      syncMode: 'both',
      usedPushOnlyDefault: false,
      details: getDetailsPayload,
      recordCount: 3,
    });
    const store = makeStore();

    await store
      .dispatch(
        activateProject({
          serverId,
          projectId,
          jwtToken: 'tok',
        }) as any
      )
      .unwrap();

    expect(resolveActivationSyncMode).toHaveBeenCalledWith({
      serverUrl,
      projectId,
      token: 'tok',
    });
    expect(compiledSpecService.compileAndRegisterSpec).toHaveBeenCalledWith(
      expect.any(String),
      detailsDefinition.uiSpec
    );
    expect(
      store.getState().projects.servers[serverId].listed[projectId]
    ).toBeUndefined();
    const activated =
      store.getState().projects.servers[serverId].activated[projectId];
    expect(activated).toBeDefined();
    expect(activated.isActivated).toBe(true);
    expect(activated.uiDefinition).toEqual(detailsDefinition);
    expect(activated.uiSpecProperties).toEqual(
      getDetailsPayload.uiSpecProperties
    );
    expect(activated.schemaCompatibility).toEqual(
      getDetailsPayload.schemaCompatibility
    );
    expect(activated.name).toBe('Notebook One from GET');
    expect(activated.recordCount).toBe(3);
    expect(store.getState().projects.activatingProjects).toEqual([]);
  });
});
