import {configureStore} from '@reduxjs/toolkit';
import React, {useEffect, useRef} from 'react';
import {
  Provider,
  TypedUseSelectorHook,
  useDispatch,
  useSelector,
} from 'react-redux';
import {persistReducer, persistStore} from 'redux-persist';
import {PersistGate} from 'redux-persist/integration/react';
import storage from 'redux-persist/lib/storage';
import LoadingApp from '../gui/components/loadingApp';
import {set_sync_status_callbacks} from '../sync/connection';
import {initialize} from '../sync/initialize';
import {getSyncStatusCallbacks} from '../utils/status';
import authReducer from './slices/authSlice';
import syncReducer, {addAlert, setInitialized} from './slices/syncSlice';

// Configure persistence for the auth slice
const persistConfig = {key: 'auth', storage};
const persistedAuthReducer = persistReducer(persistConfig, authReducer);

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
      serializableCheck: {},
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

// Provider component
export const StateProvider: React.FC<{children: React.ReactNode}> = ({
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
    return <LoadingApp />;
  }

  return (
    <Provider store={store}>
      {
        // Persistence gate to ensure app is not loaded before auth slice persists
      }
      <PersistGate loading={<LoadingApp />} persistor={persistor}>
        {children}
      </PersistGate>
    </Provider>
  );
};
