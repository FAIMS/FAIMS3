import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {TokenContents} from '@faims3/data-model';
import {parseToken} from '../../users';
import {requestTokenRefresh} from '../../utils/apiOperations/auth';
import {store} from '../store';

// Types
export interface TokenInfo {
  token: string;
  refreshToken?: string;
  parsedToken: TokenContents;
  expiresAt: number;
}

export interface ServerUser {
  [username: string]: TokenInfo;
}

export interface ServerMap {
  [serverId: string]: {
    users: ServerUser;
  };
}

export interface ActiveUser {
  serverId: string;
  username: string;
  token: string;
  parsedToken: TokenContents;
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
}

export interface ServerUserIdentity {
  serverId: string;
  username: string;
}

const isTokenValid = (tokenInfo: TokenInfo | undefined): boolean => {
  if (!tokenInfo) return false;
  return tokenInfo.token != undefined && tokenInfo.expiresAt > Date.now();
};

const isTokenRefreshable = (tokenInfo: TokenInfo | undefined): boolean => {
  if (!tokenInfo) return false;
  return !!tokenInfo.refreshToken;
};

const checkAuthenticationStatus = (state: AuthState): boolean => {
  if (!state.activeUser) return false;
  const {serverId, username} = state.activeUser;
  const connection = state.servers[serverId]?.users[username];
  return isTokenValid(connection);
};

// Refresh token store operation
export const refreshToken = async ({
  serverId,
  username,
}: ServerUserIdentity) => {
  // Get the current state and relevant connection
  const state = store.getState();
  const connection = state.auth.servers[serverId]?.users[username];

  if (!connection) {
    throw new Error('No connection found');
  }

  if (!isTokenRefreshable(connection)) {
    throw new Error('No refresh token available.');
  }

  try {
    const {token} = await requestTokenRefresh(serverId, username, {
      refreshToken: connection.refreshToken!,
    });
    const parsedToken = parseToken(token);

    // Update this connection with newest token
    store.dispatch(
      setServerConnection({
        parsedToken,
        serverId,
        token,
        username,
        refreshToken: connection.refreshToken,
      })
    );
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unknown error');
  }
};

export const refreshActiveUser = async () => {
  const state = store.getState();
  if (!state.auth.activeUser) {
    throw new Error('Cannot refresh active user when no user is active.');
  }
  await refreshToken({
    serverId: state.auth.activeUser.serverId,
    username: state.auth.activeUser.username,
  });
};

// Slice
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
    setServerConnection: (
      state,
      action: PayloadAction<SetServerConnectionInput>
    ) => {
      const {serverId, username, token, refreshToken, parsedToken} =
        action.payload;
      const expiresAt = Date.now() + 1000 * 60;

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
      };

      state.isAuthenticated = checkAuthenticationStatus(state);
    },

    removeServerConnection: (
      state,
      action: PayloadAction<ServerUserIdentity>
    ) => {
      const {serverId, username} = action.payload;

      if (state.servers[serverId]?.users) {
        delete state.servers[serverId].users[username];

        if (Object.keys(state.servers[serverId].users).length === 0) {
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

export const {
  setServerConnection,
  setActiveUser,
  removeServerConnection,
  clearActiveConnection,
} = authSlice.actions;

export default authSlice.reducer;

type AuthStore = {auth: AuthState};

// Selectors
export const selectActiveUser = (state: AuthStore) => state.auth.activeUser;
export const selectIsAuthenticated = (state: AuthStore) =>
  state.auth.isAuthenticated;
export const selectActiveToken = (state: AuthStore) => {
  const activeUser = state.auth.activeUser;
  if (!activeUser) return undefined;
  return state.auth.servers[activeUser.serverId]?.users[activeUser.username];
};
export const selectAllServerUsers = (
  state: AuthStore
): ServerUserIdentity[] => {
  return Object.entries(state.auth.servers).flatMap(([serverId, server]) =>
    Object.keys(server.users).map(username => ({
      serverId,
      username,
    }))
  );
};

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
