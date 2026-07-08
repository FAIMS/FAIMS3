import {PutLogoutInput, TokenContents} from '@faims3/data-model';
import {
  createAsyncThunk,
  createSelector,
  createSlice,
  PayloadAction,
} from '@reduxjs/toolkit';
import {TOKEN_REFRESH_WINDOW_MS} from '../../buildconfig';
import {parseToken} from '../../users';
import {requestTokenRefresh} from '../../utils/apiOperations/auth';
import {impersonateUser} from '../../utils/apiOperations/users';
import {AppDispatch, RootState} from '../store';
import {initialiseProjects, updateDatabaseCredentials} from './projectSlice';
import {addAlert} from './alertSlice';

// Types
export interface TokenInfo {
  token: string;
  refreshToken?: string;
  parsedToken: TokenContents;
  expiresAt: number;
  // Present only for impersonation sessions: the username of the admin who
  // initiated the impersonation (i.e. the connection to return to). Stored in
  // state so it survives token refreshes (the JWT audit claim is dropped on
  // refresh).
  impersonatingUser?: string;
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
  // Present only for impersonation sessions - the admin username to return to.
  impersonatingUser?: string;
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
  // When set, marks this connection as an impersonation session initiated by
  // the given admin username. Omitted on refresh - the existing marker is
  // preserved by the reducer.
  impersonatingUser?: string;
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

      // Preserve any existing impersonation marker across refreshes (refresh
      // does not pass impersonatingUser), or set it when explicitly provided.
      const impersonatingUser =
        action.payload.impersonatingUser ??
        state.servers[serverId].users[username]?.impersonatingUser;

      state.servers[serverId].users[username] = {
        token,
        refreshToken,
        parsedToken,
        expiresAt,
        impersonatingUser,
      };

      // Update active user if this is the active user
      if (
        state.activeUser &&
        state.activeUser.serverId === serverId &&
        state.activeUser.username === username
      ) {
        state.activeUser.token = token;
        state.activeUser.parsedToken = parsedToken;
        state.activeUser.impersonatingUser = impersonatingUser;
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
        impersonatingUser: connection.impersonatingUser,
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
              impersonatingUser: details.impersonatingUser,
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
export const selectIsAuthenticated = (state: AuthStore) =>
  state.auth.isAuthenticated;
/** True when the active connection is an impersonation session. */
export const selectIsImpersonating = (state: AuthStore) =>
  !!state.auth.activeUser?.impersonatingUser;
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

/**
 * Memoized selector for the active server ID
 */
export const selectActiveServerId = createSelector(
  [(state: RootState) => state.auth.activeUser],
  activeUser => activeUser?.serverId
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
 * Switches the active user, refreshes activated database credentials when the
 * token changes, and re-fetches the notebook directory for that server so the
 * listing reflects the new user's access.
 */
export const setActiveUserAndRefreshProjects = createAsyncThunk<
  void,
  ServerUserIdentity
>(
  'auth/setActiveUserAndRefreshProjects',
  async (args, {dispatch: rawDispatch, getState}) => {
    const dispatch = rawDispatch as AppDispatch;
    const stateBefore = (getState() as RootState).auth;
    const previousToken = stateBefore.activeUser?.token;
    const newToken =
      stateBefore.servers[args.serverId]?.users[args.username]?.token;

    dispatch(setActiveUser(args));

    if (newToken && newToken !== previousToken) {
      await dispatch(
        updateDatabaseCredentials({serverId: args.serverId, token: newToken})
      );
    }

    await dispatch(initialiseProjects({serverId: args.serverId}));
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

/**
 * Begins impersonating a user on the active server. Calls the impersonation
 * endpoint as the current (admin) active user, stores the returned token pair
 * as an additional connection tagged with the admin's username, and makes it
 * the active user. The admin's own connection is retained so it can be restored
 * via stopImpersonation.
 */
export const startImpersonation = createAsyncThunk<
  {status: 'success' | 'error'; message: string},
  {serverId: string; targetUserId: string}
>(
  'auth/startImpersonation',
  async ({serverId, targetUserId}, {dispatch, getState}) => {
    const state = getState() as RootState;
    const appDispatch = dispatch as AppDispatch;

    const activeUser = state.auth.activeUser;
    if (!activeUser || activeUser.serverId !== serverId) {
      const message = 'You must be signed in to this server to impersonate.';
      appDispatch(addAlert({message, severity: 'warning'}));
      return {status: 'error', message};
    }

    if (activeUser.impersonatingUser) {
      const message =
        'Already impersonating a user. Return to your account first.';
      appDispatch(addAlert({message, severity: 'warning'}));
      return {status: 'error', message};
    }

    const adminUsername = activeUser.username;

    try {
      const {accessToken, refreshToken} = await impersonateUser(
        serverId,
        adminUsername,
        targetUserId
      );
      const parsedToken = parseToken(accessToken);

      // Store the impersonated user as a new connection, tagged with the admin.
      await appDispatch(
        setServerConnection({
          serverId,
          username: parsedToken.username,
          token: accessToken,
          refreshToken,
          parsedToken,
          impersonatingUser: adminUsername,
        })
      );

      // Make it the active user and refresh the notebook list for them.
      await appDispatch(
        setActiveUserAndRefreshProjects({
          serverId,
          username: parsedToken.username,
        })
      );

      return {status: 'success', message: ''};
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to start impersonation.';
      appDispatch(addAlert({message, severity: 'error'}));
      return {status: 'error', message};
    }
  }
);

/**
 * Ends the current impersonation session: restores the admin connection as the
 * active user and removes the impersonated connection (best-effort invalidating
 * its refresh token on the server).
 */
export const stopImpersonation = createAsyncThunk<void, void>(
  'auth/stopImpersonation',
  async (_, {dispatch, getState}) => {
    const state = getState() as RootState;
    const appDispatch = dispatch as AppDispatch;

    const activeUser = state.auth.activeUser;
    if (!activeUser?.impersonatingUser) {
      // Not impersonating - nothing to do.
      return;
    }

    const {serverId} = activeUser;
    const impersonatedUsername = activeUser.username;
    const adminUsername = activeUser.impersonatingUser;

    // Restore the admin as the active user if their connection still exists.
    const adminConnection = state.auth.servers[serverId]?.users[adminUsername];
    if (adminConnection) {
      await appDispatch(
        setActiveUserAndRefreshProjects({serverId, username: adminUsername})
      );
    } else {
      appDispatch(clearActiveConnection());
    }

    // Best-effort: invalidate the impersonated session's refresh token.
    const impersonatedConnection =
      state.auth.servers[serverId]?.users[impersonatedUsername];
    const serverUrl = (getState() as RootState).projects.servers[serverId]
      ?.serverUrl;
    if (serverUrl && impersonatedConnection?.refreshToken) {
      try {
        await fetch(`${serverUrl}/auth/logout`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${impersonatedConnection.token}`,
          },
          body: JSON.stringify({
            refreshToken: impersonatedConnection.refreshToken,
          } satisfies PutLogoutInput),
        });
      } catch (error) {
        console.warn('Failed to invalidate impersonation token:', error);
      }
    }

    // Remove the impersonated connection.
    appDispatch(
      removeServerConnection({serverId, username: impersonatedUsername})
    );
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
