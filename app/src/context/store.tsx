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
import {set_sync_status_callbacks} from '../sync/connection';
import {initialize} from '../sync/initialize';
import {getSyncStatusCallbacks} from '../utils/status';
import authReducer, {
  refreshAllUsers,
  refreshIsAuthenticated,
  selectIsAuthenticated,
} from './slices/authSlice';
import syncReducer, {addAlert, setInitialized} from './slices/syncSlice';

// Configure persistence for the auth slice
const persistConfig = {key: 'auth', storage};
const persistedAuthReducer = persistReducer(persistConfig, authReducer);

// Token refresh interval in milliseconds (15 seconds)
const TOKEN_REFRESH_INTERVAL = 5000;

// Configure the store
export const store = configureStore({
  reducer: {
    // auth slice (persisted)
    auth: persistedAuthReducer,
    // sync slice
    sync: syncReducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      // TODO fix this
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
        await dispatch(refreshAllUsers({}));
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
      TOKEN_REFRESH_INTERVAL
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
        await dispatch(refreshAllUsers({}));
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

    // And setup callbacks for sync operations (only done once)
    set_sync_status_callbacks(getSyncStatusCallbacks(dispatch));

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
