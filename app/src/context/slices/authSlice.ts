import {TokenContents} from '@faims3/data-model';
import {
  createAsyncThunk,
  createSelector,
  createSlice,
  PayloadAction,
} from '@reduxjs/toolkit';
import {TOKEN_REFRESH_WINDOW_MS} from '../../buildconfig';
import {parseToken} from '../../users';
import {requestTokenRefresh} from '../../utils/apiOperations/auth';
import {AppDispatch, RootState} from '../store';
import {updateDatabaseCredentials} from './projectSlice';
import {addAlert} from './syncSlice';

// Types
export interface TokenInfo {
  token: string;
  refreshToken?: string;
  parsedToken: TokenContents;
  expiresAt: number;
}

export interface ServerUserMap {
  [username: string]: TokenInfo;
}

export interface ServerMap {
  [serverId: string]: {
    users: ServerUserMap;
  };
}

export interface ActiveUser {
  serverId: string;
  username: string;
  token: string;
  parsedToken: TokenContents;
  expiresAt: number;
}

export interface AuthState {
  servers: ServerMap;
  activeUser: ActiveUser | undefined;
  isAuthenticated: boolean;
  refreshError: string | undefined;
}

export interface SetServerConnectionInput {
  serverId: string;
  username: string;
  token: string;
  refreshToken?: string;
  parsedToken: TokenContents;
  promptRefresh?: boolean; // default false
}

export interface ServerUserIdentity {
  serverId: string;
  username: string;
}

// UTILITY FUNCTIONS
// =================

export const isTokenValid = (tokenInfo: TokenInfo | undefined): boolean => {
  // Present
  if (!tokenInfo) return false;
  // Present (token property)
  if (!tokenInfo.token) return false;
  // Need to * 1000 to use ms for the token expiry (in seconds)
  if (tokenInfo.expiresAt * 1000 <= Date.now()) return false;

  // Otherwise she's all good!
  return true;
};

const isTokenRefreshable = (tokenInfo: TokenInfo | undefined): boolean => {
  if (!tokenInfo) return false;
  return !!tokenInfo.refreshToken;
};

/**
 * Checks if a token should be refreshed based on it being close to expiring by
 * a given millisecond window
 * @param tokenInfo The token information
 * @param windowMs The window meaning the maximum allowed difference between
 * current time and refresh time before running a refresh
 * @returns True/false - true iff refresh SHOULD occur
 */
const shouldTokenRefresh = (
  tokenInfo: TokenInfo,
  windowMs: number
): boolean => {
  // Multiply the expiresAt by 1000 to bring to ms
  return Date.now() + windowMs >= tokenInfo.expiresAt * 1000;
};

const checkAuthenticationStatus = (state: AuthState): boolean => {
  if (!state.activeUser) return false;
  const {serverId, username} = state.activeUser;
  const connection = state.servers[serverId]?.users[username];
  return isTokenValid(connection);
};

// SLICE
// =====

const initialState: AuthState = {
  servers: {},
  activeUser: undefined,
  isAuthenticated: false,
  refreshError: undefined,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    refreshIsAuthenticated: (state, _: PayloadAction<{}>) => {
      state.isAuthenticated = checkAuthenticationStatus(state);
    },

    assignServerConnection: (
      state,
      action: PayloadAction<SetServerConnectionInput>
    ) => {
      const {serverId, username, token, refreshToken, parsedToken} =
        action.payload;

      // Fill out expiry from the token
      const expiresAt = parsedToken.exp;

      // Update servers state
      if (!state.servers[serverId]) {
        state.servers[serverId] = {users: {}};
      }

      state.servers[serverId].users[username] = {
        token,
        refreshToken,
        parsedToken,
        expiresAt,
      };

      // Update active user if this is the active user
      if (
        state.activeUser &&
        state.activeUser.serverId === serverId &&
        state.activeUser.username === username
      ) {
        state.activeUser.token = token;
        state.activeUser.parsedToken = parsedToken;
      }

      state.isAuthenticated = checkAuthenticationStatus(state);
    },

    setActiveUser: (state, action: PayloadAction<ServerUserIdentity>) => {
      const {serverId, username} = action.payload;
      const connection = state.servers[serverId]?.users[username];

      if (!connection) {
        state.activeUser = undefined;
        state.isAuthenticated = false;
        return;
      }

      state.activeUser = {
        serverId,
        username,
        token: connection.token,
        parsedToken: connection.parsedToken,
        expiresAt: connection.expiresAt,
      };

      state.isAuthenticated = checkAuthenticationStatus(state);

      // Schedule a refresh too
    },

    removeServerConnection: (
      state,
      action: PayloadAction<ServerUserIdentity>
    ) => {
      const {serverId, username} = action.payload;

      if (state.servers[serverId]?.users) {
        delete state.servers[serverId]?.users[username];

        if (Object.keys(state.servers[serverId]?.users ?? {}).length === 0) {
          delete state.servers[serverId];
        }
      }

      // Handle active user removal
      if (
        state.activeUser?.serverId === serverId &&
        state.activeUser?.username === username
      ) {
        const allUsers = Object.entries(state.servers)
          .flatMap(([sId, server]) =>
            Object.keys(server.users).map(uname => ({
              serverId: sId,
              username: uname,
            }))
          )
          .filter(
            identity =>
              !(
                identity.username === username && identity.serverId === serverId
              )
          );

        if (allUsers.length > 0) {
          const newActive = allUsers[0];
          const details =
            state.servers[newActive.serverId]?.users[newActive.username];
          if (details) {
            state.activeUser = {
              ...newActive,
              token: details.token,
              parsedToken: details.parsedToken,
              expiresAt: details.expiresAt,
            };
            state.isAuthenticated = checkAuthenticationStatus(state);
          } else {
            state.activeUser = undefined;
            state.isAuthenticated = false;
          }
        } else {
          state.activeUser = undefined;
          state.isAuthenticated = false;
        }
      }
    },

    clearActiveConnection: state => {
      state.activeUser = undefined;
      state.isAuthenticated = false;
    },
  },
});

// SELECTORS
// =========

export const selectActiveUser = (state: AuthStore) => state.auth.activeUser;
export const selectActiveServerId = (state: AuthStore) =>
  state.auth.activeUser?.serverId;

export const selectIsAuthenticated = (state: AuthStore) =>
  state.auth.isAuthenticated;
export const selectActiveToken = (state: AuthStore) => {
  const activeUser = state.auth.activeUser;
  if (!activeUser) return undefined;
  return state.auth.servers[activeUser.serverId]?.users[activeUser.username];
};

// Memoized selector for all server users
export const selectAllServerUsers = createSelector(
  [(state: AuthStore) => state.auth.servers],
  (servers): ServerUserIdentity[] => {
    return Object.entries(servers).flatMap(([serverId, server]) =>
      Object.keys(server.users).map(username => ({
        serverId,
        username,
      }))
    );
  }
);

// This is a special selector which looks for a given serverId re-renders
// optimally
export const selectSpecificServer = createSelector(
  [
    (state: AuthStore) => state.auth.servers,
    (_state: AuthStore, serverId: string) => serverId,
  ],
  (servers, serverId) => servers[serverId]?.users ?? {}
);

// STATE HELPER FUNCTIONS
// ======================

// Helper functions (which use the store state)
export const getServerConnection = ({
  state,
  serverId,
  username,
}: {
  state: AuthStore;
  serverId: string;
  username: string;
}) => {
  return state.auth.servers[serverId]?.users[username];
};

/**
 * Lists all the connections in the given auth state - appends the serverId
 */
export const listAllConnections = ({state}: {state: AuthState}) => {
  const connections = [];
  for (const serverId of Object.keys(state.servers)) {
    const server = state.servers[serverId]!;
    for (const user of Object.values(server.users)) {
      connections.push({...user, serverId: serverId});
    }
  }
  return connections;
};

// THUNKS
// ======

// These are actions which can be dispatched which can dispatch other store
// actions safely and run asynchronous operations.

export const setServerConnection = createAsyncThunk<
  void,
  SetServerConnectionInput
>('auth/setAndRefreshActiveConnection', async (args, {dispatch, getState}) => {
  // cast and get state
  const state = (getState() as RootState).auth;
  const appDispatch = dispatch as AppDispatch;

  const {serverId, username, token} = args;

  // Run the usual store operation
  appDispatch(assignServerConnection(args));

  // track if we've changed the token so as to know when to prompt the pouch
  // DB to update it's remote connection token
  let tokenIsChanged = true;

  // Check if we've changed the token
  const existingState = state.servers[serverId]?.users[username];

  if (existingState) {
    if (existingState.token === token) {
      tokenIsChanged = false;
    }
  }

  // If the new token has changed, update!
  if (tokenIsChanged) {
    // Here we should update the all remote synced DBs for listing/server with
    // id `serverId` to the new token `token`
    await appDispatch(updateDatabaseCredentials({serverId, token}));
  }
});

export const setAndRefreshActiveConnection = createAsyncThunk<
  void,
  ServerUserIdentity
>(
  'auth/setAndRefreshActiveConnection',
  async (args, {dispatch: rawDispatch}) => {
    // cast and get state
    const dispatch = rawDispatch as AppDispatch;

    // dispatch the job to set active user
    dispatch(setActiveUser(args));

    // Dispatch a refresh too
    dispatch(refreshToken({serverId: args.serverId, username: args.username}));
  }
);

/**
 * Atomic async operation on store to refresh a specific connection
 */
export const refreshToken = createAsyncThunk<
  void,
  {serverId: string; username: string}
>('auth/refreshToken', async ({serverId, username}, {dispatch, getState}) => {
  // cast and get state
  const state = getState() as RootState;
  const appDispatch = dispatch as AppDispatch;

  // Try to refresh token
  const connection = state.auth.servers[serverId]?.users[username];

  if (!connection) {
    appDispatch(
      addAlert({
        message: 'Token refresh failed: unknown connection requested.',
        severity: 'warning',
      })
    );
  }

  if (!isTokenRefreshable(connection)) {
    appDispatch(
      addAlert({
        message: 'No refresh token available.',
        severity: 'warning',
      })
    );
  }

  try {
    const {token} = await requestTokenRefresh(serverId, username, {
      refreshToken: connection.refreshToken!,
    });
    const parsedToken = parseToken(token);

    // Update this connection with newest token
    // This will also prompt an isAuthenticated check
    await appDispatch(
      setServerConnection({
        parsedToken,
        serverId,
        token,
        username,
        refreshToken: connection.refreshToken,
      })
    );
  } catch (error) {
    console.warn('Token refresh failed:', error);
  }
});

/**
 * Atomic async operation on store to refresh the active user's token
 */
export const refreshActiveUser = createAsyncThunk<void, void>(
  'auth/refreshActive',

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (_, {dispatch, getState}) => {
    // cast and get state
    const state = getState() as RootState;
    const appDispatch = dispatch as AppDispatch;

    // Get the active user
    const activeUser = state.auth.activeUser;

    if (!activeUser) {
      console.error(
        'Attempted to refresh active user when active user is not set. No action.'
      );
      return;
    }

    // Dispatch a refresh of the active user
    appDispatch(
      refreshToken({
        serverId: activeUser.serverId,
        username: activeUser.username,
      })
    );
  }
);

/**
 * Atomic async operation on store to refresh all connection's tokens
 */
export const refreshAllUsers = createAsyncThunk<void, void>(
  'auth/refreshAll',
  // eslint-disable-next-line no-unused-vars
  async (_, {dispatch, getState}) => {
    // cast and get state
    const state = getState() as RootState;
    const appDispatch = dispatch as AppDispatch;

    // get all identities
    const connections = listAllConnections({state: state.auth});

    // refresh all of them
    for (const conn of connections) {
      // Only dispatch a refresh operation if the token is going to expire soon
      if (shouldTokenRefresh(conn, TOKEN_REFRESH_WINDOW_MS)) {
        appDispatch(
          refreshToken({
            serverId: conn.serverId,
            username: conn.parsedToken.username,
          })
        );
      }
    }
  }
);

export const {
  setActiveUser,
  removeServerConnection,
  clearActiveConnection,
  refreshIsAuthenticated,
  assignServerConnection,
} = authSlice.actions;

export default authSlice.reducer;

type AuthStore = {auth: AuthState};
