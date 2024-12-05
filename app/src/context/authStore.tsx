import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {requestTokenRefresh} from '../utils/apiOperations/auth';
import {parseToken} from '../users';
import moment from 'moment';

// Types
interface ParsedToken {
  // TODO bring this back
  //exp: number;
  username: string;
  roles: string[];
  name?: string;
  server: string;
}

interface TokenInfo {
  token: string;
  refreshToken: string;
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

interface ActiveConnection {
  serverId: string;
  username: string;
}

interface AuthState {
  servers: ServerMap;
  activeConnection: ActiveConnection | null;
  refreshError: string | null;

  // Actions
  setServerConnection: (
    serverId: string,
    username: string,
    token: string,
    refreshToken: string,
    parsedToken: ParsedToken
  ) => void;
  setActiveConnection: (serverId: string, username: string) => void;
  removeServerConnection: (serverId: string, username: string) => void;
  clearActiveConnection: () => void;
  refreshToken: (serverId: string, username: string) => Promise<void>;
}

// TODO: Implement these functions according to your application needs
const parseJwt = async (token: string): Promise<ParsedToken> => {
  // Implement JWT parsing logic here
  const contents = await parseToken(token);
  // TODO expiry on the token - this will come from the API once I re-enable it
  return {...contents};
};

const callRefreshApi = async (
  serverId: string,
  refreshToken: string
): Promise<{token: string; refreshToken: string}> => {
  const updatedToken = await requestTokenRefresh(serverId, {
    refreshToken,
  });
  return {token: updatedToken.token, refreshToken};
};

// Create store
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      servers: {},
      activeConnection: null,
      refreshError: null,

      setServerConnection: (
        serverId,
        username,
        token,
        refreshToken,
        parsedToken
      ) => {
        // Fake expiry for now - to prompt refresh
        // TODO
        const expiresAt = moment.now() + 1000 * 60;
        set(state => ({
          servers: {
            ...state.servers,
            [serverId]: {
              users: {
                ...(state.servers[serverId]?.users || {}),
                [username]: {
                  token,
                  refreshToken,
                  parsedToken,
                  expiresAt,
                },
              },
            },
          },
        }));
      },

      setActiveConnection: (serverId, username) => {
        set({activeConnection: {serverId, username}});
      },

      removeServerConnection: (serverId, username) => {
        set(state => {
          const newState = {...state};

          // Remove the user
          if (newState.servers[serverId]?.users) {
            delete newState.servers[serverId].users[username];

            // If no users left, remove the entire server entry
            if (Object.keys(newState.servers[serverId].users).length === 0) {
              delete newState.servers[serverId];
            }
          }

          // Clear active connection if it matches
          if (
            state.activeConnection?.serverId === serverId &&
            state.activeConnection?.username === username
          ) {
            newState.activeConnection = null;
          }

          return newState;
        });
      },

      clearActiveConnection: () => {
        set({activeConnection: null});
      },

      refreshToken: async (serverId, username) => {
        const state = get();
        const connection = state.servers[serverId]?.users[username];

        if (!connection) {
          set({refreshError: 'No connection found'});
          return;
        }

        try {
          const {token, refreshToken} = await callRefreshApi(
            serverId,
            connection.refreshToken
          );
          const parsedToken = await parseJwt(token);

          get().setServerConnection(
            serverId,
            username,
            token,
            refreshToken,
            parsedToken
          );

          set({refreshError: null});
        } catch (error) {
          set({
            refreshError:
              error instanceof Error ? error.message : 'Unknown error',
          });
          // TODO what happens if an error occurs - do we want to redirect?
        }
      },
    }),
    {
      // Persist everything
      name: 'auth-storage',
    }
  )
);

// Set up the refresh checker
const startTokenRefreshChecker = () => {
  setInterval(() => {
    console.log('Token refresh tick');
    const state = useAuthStore.getState();
    if (state.activeConnection) {
      const {serverId, username} = state.activeConnection;
      const connection = state.servers[serverId]?.users[username];

      if (connection) {
        // Refresh if token expires in next 5 minutes
        const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;
        if (connection.expiresAt < fiveMinutesFromNow) {
          console.log('Initiating token refresh');
          state.refreshToken(serverId, username);
        }
      }
    }
  }, 30000);
};

// Start the checker
startTokenRefreshChecker();
