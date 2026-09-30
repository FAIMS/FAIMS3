// SPDX-License-Identifier: Apache-2.0
import {
  CURRENT_NOTEBOOK_UI_SCHEMA_VERSION,
  ProjectStatus,
} from '@faims3/data-model';
import {configureStore} from '@reduxjs/toolkit';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const {resolveActivationSyncMode} = vi.hoisted(() => ({
  resolveActivationSyncMode: vi.fn(),
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

vi.mock('../../sync/syncModeDefaults', () => ({
  resolveActivationSyncMode,
}));

vi.mock('../../logging', () => ({
  reportNotebookSchemaCompatibility: vi.fn(),
  reportNotebookCompileFailure: vi.fn(),
  reportAppServerVersionMismatch: vi.fn(),
  logError: vi.fn(),
}));

import projectsReducer, {
  activateProject,
  initialProjectState,
  type ListedProject,
  type ProjectsState,
} from './projectSlice';

const serverId = 'server-a';
const serverUrl = 'https://conductor.example';
const projectId = 'nb-1';

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
      hash: 'a'.repeat(64),
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
    },
    preloadedState: {projects: projectsState, auth: authState},
  });
}

describe('activateProject requires downloaded design details', () => {
  beforeEach(() => {
    resolveActivationSyncMode.mockReset();
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
  });
});
