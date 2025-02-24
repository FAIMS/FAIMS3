import {AlertColor} from '@mui/material/Alert/Alert';
import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {v4 as uuidv4} from 'uuid';

// Types
interface Alert {
  severity: AlertColor;
  key: string;
  message?: string;
  element?: JSX.Element[];
}

interface SyncState {
  isSyncingUp: boolean;
  isSyncingDown: boolean;
  hasUnsyncedChanges: boolean;
  isSyncError: boolean;
  alerts: Alert[];
  isInitialised: boolean;
}

// Initial state
const initialState: SyncState = {
  isSyncingUp: false,
  isSyncingDown: false,
  hasUnsyncedChanges: false,
  isSyncError: false,
  alerts: [],
  isInitialised: false,
};

// Create slice (combines actions and reducers)
const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    setSyncingUp: (state, action: PayloadAction<boolean>) => {
      state.isSyncingUp = action.payload;
    },
    setSyncingDown: (state, action: PayloadAction<boolean>) => {
      state.isSyncingDown = action.payload;
    },
    setUnsyncedChanges: (state, action: PayloadAction<boolean>) => {
      state.hasUnsyncedChanges = action.payload;
    },
    setSyncError: (state, action: PayloadAction<boolean>) => {
      state.isSyncError = action.payload;
    },
    addAlert: (state, action: PayloadAction<Omit<Alert, 'key'>>) => {
      state.alerts.push({
        ...action.payload,
        key: uuidv4(),
      });
    },
    deleteAlert: (state, action: PayloadAction<{key: string}>) => {
      state.alerts = state.alerts.filter(
        alert => alert.key !== action.payload.key
      );
    },
    setInitialized: (state, action: PayloadAction<boolean>) => {
      state.isInitialised = action.payload;
    },
  },
});

// Export actions
export const {
  setSyncingUp,
  setSyncingDown,
  setUnsyncedChanges,
  setSyncError,
  addAlert,
  deleteAlert,
  setInitialized,
} = syncSlice.actions;

export default syncSlice.reducer;
