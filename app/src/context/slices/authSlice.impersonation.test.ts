import {configureStore} from '@reduxjs/toolkit';
import {beforeEach, describe, expect, it, vi} from 'vitest';

// Mock heavy/side-effectful deps so importing the slice is isolated.
vi.mock('../../utils/apiOperations/users', () => ({
  impersonateUser: vi.fn(),
  listUsers: vi.fn(),
}));
// Mocked so the slice under test does not transitively import the real store
// (client.tsx -> store.tsx) which sets up redux-persist/IndexedDB.
vi.mock('../../utils/apiOperations/auth', () => ({
  requestTokenRefresh: vi.fn(),
}));
vi.mock('./projectSlice', () => ({
  // reducer default export (in case anything imports it)
  default: (state = {servers: {}}) => state,
  // dispatched + awaited by setServerConnection - no-op plain action
  updateDatabaseCredentials: () => ({
    type: 'projects/updateDatabaseCredentials/mock',
  }),
  initialiseProjects: () => ({
    type: 'projects/initialiseProjects/mock',
  }),
}));
vi.mock('../../users', () => ({
  parseToken: vi.fn(),
}));

import {TokenContents} from '@faims3/data-model';
import {parseToken} from '../../users';
import {impersonateUser} from '../../utils/apiOperations/users';
import authReducer, {
  assignServerConnection,
  selectIsImpersonating,
  setActiveUser,
  startImpersonation,
  stopImpersonation,
} from './authSlice';

const SERVER = 'server-1';
const ADMIN = 'admin@example.com';
const TARGET = 'fieldworker@example.com';

/** Builds a minimal TokenContents for tests. */
const fakeToken = (username: string): TokenContents =>
  ({
    username,
    name: username,
    server: 'http://localhost:8080',
    exp: Math.floor(Date.now() / 1000) + 3600,
    globalRoles: [],
    resourceRoles: [],
  }) as unknown as TokenContents;

/** Builds a store whose state has the shape the thunks read. */
const makeStore = () =>
  configureStore({
    reducer: {
      auth: authReducer,
      // minimal projects slice so getState().projects.servers exists
      projects: (state = {servers: {}}) => state,
    },
  });

describe('authSlice impersonation reducers', () => {
  it('assignServerConnection sets the impersonatingUser marker', () => {
    let state = authReducer(undefined, {type: '@@init'});
    state = authReducer(
      state,
      assignServerConnection({
        serverId: SERVER,
        username: TARGET,
        token: 't',
        refreshToken: 'r',
        parsedToken: fakeToken(TARGET),
        impersonatingUser: ADMIN,
      })
    );
    expect(state.servers[SERVER].users[TARGET].impersonatingUser).toBe(ADMIN);
  });

  it('preserves the impersonatingUser marker across a refresh (no marker in payload)', () => {
    let state = authReducer(undefined, {type: '@@init'});
    state = authReducer(
      state,
      assignServerConnection({
        serverId: SERVER,
        username: TARGET,
        token: 't1',
        refreshToken: 'r',
        parsedToken: fakeToken(TARGET),
        impersonatingUser: ADMIN,
      })
    );
    // Simulate a refresh: same connection re-assigned with a new token but no
    // impersonatingUser field.
    state = authReducer(
      state,
      assignServerConnection({
        serverId: SERVER,
        username: TARGET,
        token: 't2',
        refreshToken: 'r',
        parsedToken: fakeToken(TARGET),
      })
    );
    expect(state.servers[SERVER].users[TARGET].token).toBe('t2');
    expect(state.servers[SERVER].users[TARGET].impersonatingUser).toBe(ADMIN);
  });

  it('setActiveUser surfaces the marker and selectIsImpersonating reflects it', () => {
    let state = authReducer(undefined, {type: '@@init'});
    state = authReducer(
      state,
      assignServerConnection({
        serverId: SERVER,
        username: TARGET,
        token: 't',
        refreshToken: 'r',
        parsedToken: fakeToken(TARGET),
        impersonatingUser: ADMIN,
      })
    );
    state = authReducer(
      state,
      setActiveUser({serverId: SERVER, username: TARGET})
    );
    expect(state.activeUser?.impersonatingUser).toBe(ADMIN);
    expect(selectIsImpersonating({auth: state})).toBe(true);
  });

  it('selectIsImpersonating is false for a normal (non-impersonation) connection', () => {
    let state = authReducer(undefined, {type: '@@init'});
    state = authReducer(
      state,
      assignServerConnection({
        serverId: SERVER,
        username: ADMIN,
        token: 't',
        refreshToken: 'r',
        parsedToken: fakeToken(ADMIN),
      })
    );
    state = authReducer(
      state,
      setActiveUser({serverId: SERVER, username: ADMIN})
    );
    expect(selectIsImpersonating({auth: state})).toBe(false);
  });
});

describe('authSlice impersonation thunks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const seedAdminActive = (store: ReturnType<typeof makeStore>) => {
    store.dispatch(
      assignServerConnection({
        serverId: SERVER,
        username: ADMIN,
        token: 'admin-token',
        refreshToken: 'admin-refresh',
        parsedToken: fakeToken(ADMIN),
      })
    );
    store.dispatch(setActiveUser({serverId: SERVER, username: ADMIN}));
  };

  it('startImpersonation adds the impersonated connection and makes it active', async () => {
    const store = makeStore();
    seedAdminActive(store);

    (impersonateUser as any).mockResolvedValue({
      accessToken: 'imp-access',
      refreshToken: 'imp-refresh',
    });
    (parseToken as any).mockReturnValue(fakeToken(TARGET));

    const result = await store
      .dispatch(startImpersonation({serverId: SERVER, targetUserId: TARGET}))
      .unwrap();

    expect(result.status).toBe('success');
    const state = store.getState().auth;
    // impersonated connection stored + tagged, and is active
    expect(state.servers[SERVER].users[TARGET].impersonatingUser).toBe(ADMIN);
    expect(state.activeUser?.username).toBe(TARGET);
    expect(state.activeUser?.impersonatingUser).toBe(ADMIN);
    // admin connection retained
    expect(state.servers[SERVER].users[ADMIN]).toBeDefined();
    expect(impersonateUser).toHaveBeenCalledWith(SERVER, ADMIN, TARGET);
  });

  it('startImpersonation refuses when not signed in to the server', async () => {
    const store = makeStore();
    // no active user seeded
    const result = await store
      .dispatch(startImpersonation({serverId: SERVER, targetUserId: TARGET}))
      .unwrap();
    expect(result.status).toBe('error');
    expect(impersonateUser).not.toHaveBeenCalled();
  });

  it('stopImpersonation restores the admin as active and removes the impersonated connection', async () => {
    const store = makeStore();
    seedAdminActive(store);

    // Manually create an active impersonation session
    store.dispatch(
      assignServerConnection({
        serverId: SERVER,
        username: TARGET,
        token: 'imp-access',
        refreshToken: 'imp-refresh',
        parsedToken: fakeToken(TARGET),
        impersonatingUser: ADMIN,
      })
    );
    store.dispatch(setActiveUser({serverId: SERVER, username: TARGET}));

    // avoid real network in the best-effort logout
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: true}));

    await store.dispatch(stopImpersonation());

    const state = store.getState().auth;
    expect(state.activeUser?.username).toBe(ADMIN);
    expect(state.activeUser?.impersonatingUser).toBeUndefined();
    // impersonated connection removed
    expect(state.servers[SERVER]?.users[TARGET]).toBeUndefined();
  });
});
