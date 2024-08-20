/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: alert.tsx
 * Description: The SystemAlert component displays alert messages in the form of snackbars at the bottom-center of the screen.
 *   Alerts are shown one at a time with configurable durations and severity levels.
 */

import React, { useContext } from 'react';
import Snackbar from '@mui/material/Snackbar';
import { ThemeProvider } from '@mui/material/styles';
import Alert from '@mui/material/Alert';
import { createUseStyles } from 'react-jss';
import theme from '../theme';
import { store } from '../../context/store';
import { ActionType } from '../../context/actions';

const useStyles = createUseStyles({
  root: {
    width: '100%',
    '& > * + *': {
      marginTop: '16px',
    },
  },
});

/**
 * SystemAlert component is responsible for rendering alerts in the form of snackbars at the bottom-center of the screen.
 * Alerts are shown one at a time, with different durations based on their severity level.
 * 
 * @component
 * @example
 * return (
 *   <SystemAlert />
 * )
 */

export default function SystemAlert() {
  const classes = useStyles();
  const globalState = useContext(store);
  const { dispatch } = globalState;
  const alerts = globalState.state.alerts;

  /**
  * Handles the closing of the current alert.
  *
  * @param {string} key - The unique key identifying the alert to be closed.
  */
  const handleClose = (key: string) => {
    dispatch({
      type: ActionType.DELETE_ALERT,
      payload: { key },
    });
  };

  const currentAlert = alerts.length > 0 ? alerts[alerts.length - 1] : null;

  return (
    <ThemeProvider theme={theme}>
      <div className={classes.root}>
        {currentAlert && (
          <Snackbar
            key={currentAlert.key}
            open={true}
            autoHideDuration={currentAlert.severity === 'error' ? 10000 : 6000}
            onClose={() => handleClose(currentAlert.key)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert
              onClose={() => handleClose(currentAlert.key)}
              severity={currentAlert.severity}
              variant="filled"
              sx={{
                minWidth: '300px',
                boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.3)', // Subtle shadow
                opacity: 0.5, // Slightly hazy effect
                animation: 'fadeIn 0.3s ease-out', // Fade-in animation
                transition: 'transform 0.3s ease-out', // Smooth transition for showing the alert
                transform: 'scale(1)', // Ensures the alert scales nicely
              }}
            >
              {'message' in currentAlert ? currentAlert.message : currentAlert.element}
            </Alert>
          </Snackbar>
        )}
      </div>
    </ThemeProvider>
  );
}
