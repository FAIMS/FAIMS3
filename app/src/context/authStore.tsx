import moment from 'moment';
import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {parseToken} from '../users';
import {requestTokenRefresh} from '../utils/apiOperations/auth';

// Types
interface ParsedToken {
  username: string;
  roles: string[];
  name?: string;
  server: string;
}

interface TokenInfo {
  token: string;
  refreshToken?: string;
  parsedToken: ParsedToken;
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
  parsedToken: ParsedToken;
}

interface SetServerConnectionInput {
  serverId: string;
  username: string;
  token: string;
  refreshToken?: string;
  parsedToken: ParsedToken;
}

interface ServerUserIdentity {
  serverId: string;
  username: string;
}

interface AuthState {
  servers: ServerMap;
  activeUser: ActiveUser | null;
  refreshError: string | null;
  isAuthenticated: boolean;

  setServerConnection: (input: SetServerConnectionInput) => void;
  setActiveUser: (input: ServerUserIdentity) => void;
  removeServerConnection: (input: ServerUserIdentity) => void;
  clearActiveConnection: () => void;
  refreshToken: (input: ServerUserIdentity) => Promise<void>;
  refreshActiveUser: () => Promise<void>;
  getActiveToken: () => TokenInfo | null;
  getServerUserInformation: (input: ServerUserIdentity) => TokenInfo | null;
}

const parseJwt = async (token: string): Promise<ParsedToken> => {
  const contents = await parseToken(token);
  return {...contents};
};

const callRefreshApi = async (
  serverId: string,
  username: string,
  refreshToken: string
): Promise<{token: string; refreshToken: string}> => {
  const updatedToken = await requestTokenRefresh(serverId, username, {
    refreshToken,
  });
  return {token: updatedToken.token, refreshToken};
};

const isTokenValid = (tokenInfo: TokenInfo | null | undefined): boolean => {
  if (!tokenInfo) return false;
  return tokenInfo.token != null && tokenInfo.expiresAt > moment.now();
};

const isTokenRefreshable = (
  tokenInfo: TokenInfo | null | undefined
): boolean => {
  if (!tokenInfo) return false;
  return !!tokenInfo.refreshToken;
};

const checkAuthenticationStatus = (state: AuthState): boolean => {
  if (!state.activeUser) return false;
  const {serverId, username} = state.activeUser;
  const connection = state.servers[serverId]?.users[username];
  return isTokenValid(connection);
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      servers: {},
      activeUser: null,
      refreshError: null,
      isAuthenticated: false,

      setServerConnection: ({
        serverId,
        username,
        token,
        refreshToken,
        parsedToken,
      }) => {
        const expiresAt = moment.now() + 1000 * 60;
        set(state => {
          const newState = {
            servers: {
              ...state.servers,
              [serverId]: {
                users: {
                  ...(state.servers[serverId]?.users || {}),
                  [username]: {
                    token,
                    ...(refreshToken && {refreshToken}),
                    parsedToken,
                    expiresAt,
                  },
                },
              },
            },
          };

          // Update active user token if this is the active user
          const activeUserUpdate =
            state.activeUser &&
            state.activeUser.serverId === serverId &&
            state.activeUser.username === username
              ? {
                  activeUser: {
                    ...state.activeUser,
                    token,
                    parsedToken,
                  },
                }
              : {};

          return {
            ...state,
            ...newState,
            ...activeUserUpdate,
            isAuthenticated: checkAuthenticationStatus({...state, ...newState}),
          };
        });
      },

      setActiveUser: ({serverId, username}) => {
        set(state => {
          const connection = state.servers[serverId]?.users[username];
          if (!connection) {
            return {
              ...state,
              activeUser: null,
              isAuthenticated: false,
            };
          }

          const newState = {
            activeUser: {
              serverId,
              username,
              token: connection.token,
              parsedToken: connection.parsedToken,
            },
          };

          return {
            ...state,
            ...newState,
            isAuthenticated: checkAuthenticationStatus({...state, ...newState}),
          };
        });
      },

      removeServerConnection: ({serverId, username}) => {
        set(state => {
          const newState = {...state};

          if (newState.servers[serverId]?.users) {
            delete newState.servers[serverId].users[username];

            if (Object.keys(newState.servers[serverId].users).length === 0) {
              delete newState.servers[serverId];
            }
          }

          if (
            state.activeUser?.serverId === serverId &&
            state.activeUser?.username === username
          ) {
            newState.activeUser = null;
          }

          newState.isAuthenticated = checkAuthenticationStatus(newState);
          return newState;
        });
      },

      clearActiveConnection: () => {
        set(state => ({
          ...state,
          activeUser: null,
          isAuthenticated: false,
        }));
      },

      refreshToken: async ({serverId, username}) => {
        const state = get();
        const connection = state.servers[serverId]?.users[username];

        if (!connection) {
          set(state => ({
            ...state,
            refreshError: 'No connection found',
            isAuthenticated: checkAuthenticationStatus(state),
          }));
          return;
        }

        if (!isTokenRefreshable(connection)) {
          set(state => ({
            ...state,
            refreshError: 'No refresh token available',
            isAuthenticated: checkAuthenticationStatus(state),
          }));
          return;
        }

        try {
          const {token, refreshToken} = await callRefreshApi(
            username,
            serverId,
            connection.refreshToken!
          );
          const parsedToken = await parseJwt(token);

          get().setServerConnection({
            serverId,
            username,
            token,
            refreshToken,
            parsedToken,
          });

          set(state => ({
            ...state,
            refreshError: null,
          }));
        } catch (error) {
          set(state => ({
            ...state,
            refreshError:
              error instanceof Error ? error.message : 'Unknown error',
            isAuthenticated: false,
          }));
        }
      },

      refreshActiveUser: async () => {
        const state = get();
        if (!state.activeUser) {
          console.error('Cannot refresh active user when no user is active.');
          return;
        }
        await state.refreshToken({...state.activeUser});
      },

      getActiveToken: () => {
        const state = get();
        if (!state.activeUser) return null;

        const {serverId, username} = state.activeUser;
        return state.servers[serverId]?.users[username] || null;
      },

      getServerUserInformation: (input: ServerUserIdentity) => {
        return get().servers[input.serverId]?.users[input.username] ?? null;
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);

// Set up the refresh checker
const startTokenRefreshChecker = () => {
  setInterval(() => {
    console.log('Token refresh tick');
    const state = useAuthStore.getState();
    if (state.activeUser) {
      const {serverId, username} = state.activeUser;
      const connection = state.servers[serverId]?.users[username];

      if (connection) {
        const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;
        if (
          connection.expiresAt < fiveMinutesFromNow &&
          isTokenRefreshable(connection)
        ) {
          console.log('Initiating token refresh');
          state.refreshToken({serverId, username});
        } else if (connection.expiresAt <= moment.now()) {
          useAuthStore.setState(state => ({
            ...state,
            isAuthenticated: false,
          }));
        }
      }
    }
  }, 30000);
};

startTokenRefreshChecker();
