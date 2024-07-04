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
 * Description:
 *   TODO
 */

import React, {useContext} from 'react';
import Snackbar from '@mui/material/Snackbar';
import {ThemeProvider} from '@mui/material/styles';
import theme from '../../gui/theme';
import Alert from '@mui/material/Alert';
import {createUseStyles} from 'react-jss';

import {store} from '../../context/store';
import {ActionType} from '../../context/actions';

/* eslint-disable @typescript-eslint/no-unused-vars */
// const useStyles = makeStyles((theme: any) => ({
//   root: {
//     width: '100%',
//     '& > * + *': {
//       marginTop: '16px',
//     },
//   },
// }));

const useStyles = createUseStyles({
  root: {
    width: '100%',
    '& > * + *': {
      marginTop: '16px',
    },
  },
});

export default function SystemAlert() {
  const classes = useStyles();
  const globalState = useContext(store);
  const {dispatch} = globalState;
  const alerts = globalState.state.alerts;

  if (alerts.length === 0) return <></>;

  const oldest_alert = alerts[alerts.length - 1]; // adjust the sequence to display the latest alert on the top, instead of bottom

  const handleClose = (key: string) => {
    dispatch({
      type: ActionType.DELETE_ALERT,
      payload: {
        key: key,
      },
    });
  };
  // this code is to move the successful message after 2 second, need to be updated in the next stage
  setTimeout(() => {
    if (
      oldest_alert !== undefined &&
      ['success', 'info'].includes(oldest_alert.severity)
    )
      handleClose(oldest_alert.key);
  }, 3000);
  // if (alerts.length > 0) console.log(oldest_alert.severity);
  return (
    <ThemeProvider theme={theme}>
      <div className={classes.root}>
        {alerts.length > 0 ? (
          <Snackbar
            open={true}
            autoHideDuration={6000}
            anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
          >
            <Alert
              onClose={() => handleClose(oldest_alert.key)}
              severity={oldest_alert.severity}
              variant={'filled'}
            >
              {'message' in oldest_alert
                ? oldest_alert.message
                : oldest_alert.element}
            </Alert>
          </Snackbar>
        ) : (
          ''
        )}
      </div>
    </ThemeProvider>
  );
}
