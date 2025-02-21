import {configureStore} from '@reduxjs/toolkit';
import React, {useEffect, useRef} from 'react';
import {
  Provider,
  TypedUseSelectorHook,
  useDispatch,
  useSelector,
} from 'react-redux';
import {
  FLUSH,
  PAUSE,
  PERSIST,
  persistReducer,
  persistStore,
  PURGE,
  REGISTER,
  REHYDRATE,
} from 'redux-persist';
import {PersistGate} from 'redux-persist/integration/react';
import storage from 'redux-persist/lib/storage';
import LoadingApp from '../gui/components/loadingApp';
import {initialize} from '../sync/initialize';
import authReducer, {
  refreshAllUsers,
  refreshIsAuthenticated,
  selectIsAuthenticated,
} from './slices/authSlice';
import projectsReducer, {
  Project,
  ProjectsState,
  Server,
} from './slices/projectSlice';
import syncReducer, {addAlert, setInitialized} from './slices/syncSlice';
import {TOKEN_REFRESH_INTERVAL_MS} from '../buildconfig';

// Configure persistence for the auth slice
const authPersistConfig = {key: 'auth', storage};
const persistedAuthReducer = persistReducer(authPersistConfig, authReducer);

// Configure persistence for the projects slice
const projectsPersistConfig = {
  key: 'projects',
  storage,
  transforms: [
    {
      // Transform for handling project state before persistence
      in: (state: ProjectsState) => {
        // Create a deep copy to avoid mutating the original state
        const newState: ProjectsState = JSON.parse(JSON.stringify(state));

        // Remove all database connections from projects before persisting
        Object.values(newState.servers).forEach((server: Server) => {
          Object.values(server.projects).forEach((project: Project) => {
            if (project.isActivated) {
              // Keep isActivated flag but remove database object (this is re-produceable)
              project.database = project.database
                ? {
                    isSyncing: project.database.isSyncing,
                    isSyncingAttachments: project.database.isSyncingAttachments,
                    // intentionally do not persist this reference - we will initialise it properly
                    localDb: undefined as any,
                    remote: project.database.remote
                      ? {
                          connectionConfiguration:
                            project.database.remote.connectionConfiguration,
                          // restore this
                          sync: undefined as any,
                          // restore this
                          remoteDb: undefined as any,
                        }
                      : undefined,
                  }
                : undefined;
            }
          });
        });
        return newState;
      },
      // Transform for handling project state after rehydration
      out: (state: ProjectsState) => {
        return state;
      },
    },
  ],
};

const persistedProjectsReducer = persistReducer(
  projectsPersistConfig,
  projectsReducer
);

// Configure the store
export const store = configureStore({
  reducer: {
    // auth slice (persisted)
    auth: persistedAuthReducer,
    // projects slice (persisted)
    projects: persistedProjectsReducer,
    // sync slice
    sync: syncReducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      // TODO fix this
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        // Ignore these paths in the state when checking for serializability
        ignoredPaths: [
          'projects.servers.*.projects.*.database.localDb',
          'projects.servers.*.projects.*.database.remote.remoteDb',
          'projects.servers.*.projects.*.database.remote.sync',
        ],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

// Setup persistor export for app persist gate
const persistor = persistStore(store);

// Infer types from store
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Create typed hooks
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

const LoadingComponent = LoadingApp;

// Provider component
export const StateProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  return (
    <Provider store={store}>
      {
        // Persistence gate to ensure app is not loaded before auth slice persists
      }
      <PersistGate loading={<LoadingComponent />} persistor={persistor}>
        {children}
      </PersistGate>
    </Provider>
  );
};

/**
 * TokenRefreshTimer component
 * Handles periodic token refresh attempts and authentication status checks
 */
const TokenRefreshTimer: React.FC = () => {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  useEffect(() => {
    const refreshTokenAndCheckAuth = async () => {
      try {
        // This dispatch handles the case where there is no active user or
        // similar concerns - avoids us needing to worry about reading state
        // synchronously here
        await dispatch(refreshAllUsers());
      } finally {
        // Always check authentication status after refresh attempt
        dispatch(refreshIsAuthenticated({}));
      }
    };

    // Initial check
    refreshTokenAndCheckAuth();

    // Set up interval
    const intervalId = setInterval(
      refreshTokenAndCheckAuth,
      TOKEN_REFRESH_INTERVAL_MS
    );

    // Cleanup
    return () => clearInterval(intervalId);
  }, [dispatch, isAuthenticated]);

  return null;
};

/**
 * NetworkUpHandler component
 *
 * Attaches to the network up condition a token
 * refresh so that a token refresh is always attempted when the network comes
 * back up.
 */
const NetworkUpHandler: React.FC = () => {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  useEffect(() => {
    const promptRefresh = async () => {
      try {
        // This dispatch handles the case where there is no active user or
        // similar concerns - avoids us needing to worry about reading state
        // synchronously here
        await dispatch(refreshAllUsers());
      } finally {
        // Always check authentication status after refresh attempt
        dispatch(refreshIsAuthenticated({}));
      }
    };

    // Attach to network up handler
    window.addEventListener('online', promptRefresh);

    return () => {
      // Detach for cleanup
      window.removeEventListener('online', promptRefresh);
    };
  }, [dispatch, isAuthenticated]);

  return null;
};

/**
 * InitialiseGate component This checks that the app store is initialised,
 * returning loading fall back. Initiates if not, and only runs once.
 *
 * It also starts a timer process which refreshes the token.
 */
export const InitialiseGate: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const dispatch = useAppDispatch();
  const mounted = useRef(false);

  // Initialised state
  const isInitialized = useAppSelector(state => state.sync.isInitialized);

  useEffect(() => {
    // Don't initialise twice
    if (mounted.current) {
      return;
    }

    // mark as started
    mounted.current = true;

    const init = async () => {
      await initialize()
        .then(() => {
          dispatch(setInitialized(true));
        })
        .catch(err => {
          console.error('Could not initialize: ', err);
          dispatch(
            addAlert({
              message:
                err instanceof Error ? err.message : 'Initialization failed',
              severity: 'error',
            })
          );
        });
    };

    // Run initialisation logic
    init();

    return () => {
      mounted.current = false;
    };
  }, []);

  if (!isInitialized) {
    return <LoadingComponent />;
  }

  return (
    <>
      {
        // Include timer
      }
      <TokenRefreshTimer />
      <NetworkUpHandler />
      {children}
    </>
  );
};

/**
 * Dangerous function which resets the redux store, purges persistence, and
 * clears all localStorage
 */
export const clearReduxAndLocalStorage = async () => {
  // Reset the store
  store.dispatch({type: 'RESET_STORE'});
  // then ensure persistence is cleared out
  await persistor.purge();
  // then also clear all local storage
  localStorage.clear();
};
