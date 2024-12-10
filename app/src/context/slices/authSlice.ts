import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import {TokenContents} from '@faims3/data-model';
import {parseToken} from '../../users';
import {requestTokenRefresh} from '../../utils/apiOperations/auth';
import type {RootState} from '../authStore';
import type {AppDispatch} from '../authStore';

// Types
interface TokenInfo {
  token: string;
  refreshToken?: string;
  parsedToken: TokenContents;
  expiresAt: number;
}

interface ServerUser {
  [username: string]: TokenInfo;
}

interface ServerMap {
  [serverId: string]: {
    users: ServerUser;
  };
}

interface ActiveUser {
  serverId: string;
  username: string;
  token: string;
  parsedToken: TokenContents;
}

interface AuthState {
  servers: ServerMap;
  activeUser: ActiveUser | undefined;
  isAuthenticated: boolean;
  refreshError: string | undefined;
}

interface SetServerConnectionInput {
  serverId: string;
  username: string;
  token: string;
  refreshToken?: string;
  parsedToken: TokenContents;
}

interface ServerUserIdentity {
  serverId: string;
  username: string;
}

// Helper functions
const parseJwt = async (token: string): Promise<TokenContents> => {
  const contents = await parseToken(token);
  return {...contents};
};

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

// Async thunks
export const doTokenRefresh = createAsyncThunk<
  ServerUser,
  ServerUserIdentity,
  {rejectValue: string}
>(
  'auth/refreshToken',
  async (
    {serverId, username}: ServerUserIdentity,
    {dispatch, getState, rejectWithValue}
  ) => {
    const state = getState() as RootState;
    const connection = state.auth.servers[serverId]?.users[username];

    if (!connection) {
      return rejectWithValue('No connection found');
    }

    if (!isTokenRefreshable(connection)) {
      return rejectWithValue('No refresh token available');
    }

    try {
      const {token} = await requestTokenRefresh(serverId, username, {
        refreshToken: connection.refreshToken!,
      });
      const parsedToken = await parseJwt(token);

      return {
        serverId,
        username,
        token,
        refreshToken: connection.refreshToken!,
        parsedToken,
      };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }
);

export const refreshActiveUser = createAsyncThunk(
  'auth/refreshActiveUser',
  async (_, {getState, dispatch}) => {
    const state = getState() as {auth: AuthState};
    const appDispatch = dispatch as AppDispatch;
    if (!state.auth.activeUser) {
      throw new Error('Cannot refresh active user when no user is active.');
    }
    await appDispatch(refreshToken(state.auth.activeUser));
  }
);

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
  extraReducers: builder => {
    builder
      .addCase(doTokenRefresh.fulfilled, (state, action) => {
        const {serverId, username, token, refreshToken, parsedToken} =
          action.payload;
        const expiresAt = Date.now() + 1000 * 60;

        if (!state.servers[serverId]) {
          state.servers[serverId] = {users: {}};
        }

        state.servers[serverId].users[username] = {
          token,
          refreshToken,
          parsedToken,
          expiresAt,
        };

        if (
          state.activeUser &&
          state.activeUser.serverId === serverId &&
          state.activeUser.username === username
        ) {
          state.activeUser.token = token;
          state.activeUser.parsedToken = parsedToken;
        }

        state.refreshError = undefined;
        state.isAuthenticated = checkAuthenticationStatus(state);
      })
      .addCase(doTokenRefresh.rejected, (state, action) => {
        state.refreshError = action.payload as string;
        state.isAuthenticated = false;
      });
  },
});

export const {
  setServerConnection,
  setActiveUser,
  removeServerConnection,
  clearActiveConnection,
} = authSlice.actions;

export default authSlice.reducer;

// Selectors
export const selectActiveUser = (state: {auth: AuthState}) =>
  state.auth.activeUser;
export const selectIsAuthenticated = (state: {auth: AuthState}) =>
  state.auth.isAuthenticated;
export const selectActiveToken = (state: {auth: AuthState}) => {
  const activeUser = state.auth.activeUser;
  if (!activeUser) return undefined;
  return state.auth.servers[activeUser.serverId]?.users[activeUser.username];
};
export const selectAllServerUsers = (state: {
  auth: AuthState;
}): ServerUserIdentity[] => {
  return Object.entries(state.auth.servers).flatMap(([serverId, server]) =>
    Object.keys(server.users).map(username => ({
      serverId,
      username,
    }))
  );
};
