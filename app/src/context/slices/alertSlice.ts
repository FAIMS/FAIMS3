/**
 * A redux store for managing alerts
 */

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

interface AlertState {
  alerts: Alert[];
}

// Initial state
const initialState: AlertState = {
  alerts: [],
};

// Create slice (combines actions and reducers)
const alertsSlice = createSlice({
  name: 'alert',
  initialState,
  reducers: {
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
  },
});

// Export actions
export const {addAlert, deleteAlert} = alertsSlice.actions;

export default alertsSlice.reducer;
