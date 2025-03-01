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
import {TOKEN_REFRESH_INTERVAL_MS} from '../buildconfig';
import LoadingApp from '../gui/components/loadingApp';
import {initialize} from '../sync/initialize';
import authReducer, {
  refreshAllUsers,
  refreshIsAuthenticated,
  selectIsAuthenticated,
} from './slices/authSlice';
import projectsReducer from './slices/projectSlice';
import syncReducer, {addAlert, setInitialized} from './slices/syncSlice';
import {databaseService} from './slices/helpers/databaseService';
import {logError} from '../logging';
import {getLocalStateDB} from './slices/helpers/databaseHelpers';

// Configure persistence for the auth slice
const authPersistConfig = {key: 'auth', storage};
const persistedAuthReducer = persistReducer(authPersistConfig, authReducer);

// Configure persistence for the projects slice
const projectsPersistConfig = {
  key: 'projects',
  storage,
  blacklist: ['isInitialised'],
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
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
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
  const syncStoreInitialised = useAppSelector(
    state => state.sync.isInitialised
  );
  const projectStoreInitialised = useAppSelector(
    state => state.projects.isInitialised
  );

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
  }, []);

  if (!syncStoreInitialised || !projectStoreInitialised) {
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

export const wipeAllDatabases = async () => {
  // cast and get state
  const state = store.getState() as RootState;
  for (const server of Object.values(state.projects.servers)) {
    for (const project of Object.values(server.projects)) {
      if (project.isActivated && project.database) {
        // Local DB should be wiped
        const localDb = databaseService.getLocalDatabase(
          project.database.localDbId
        );
        // Destroy
        await localDb?.destroy();
        // Then remove
        localDb &&
          databaseService.closeAndRemoveLocalDatabase(
            project.database.localDbId
          );
      }
    }
  }

  const dbsToWipe = [databaseService.getDraftDatabase(), getLocalStateDB()];
  for (const db of dbsToWipe) {
    try {
      console.debug(await db.destroy());
    } catch (err) {
      logError(err);
    }
  }
};
