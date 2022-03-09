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
import Alert from '@mui/material/Alert';
import { Theme } from '@mui/material/styles';
import makeStyles from '@mui/styles/makeStyles';
import {store} from '../../store';
import {ActionType} from '../../actions';

const useStyles = makeStyles(theme => ({
  root: {
    width: '100%',
    '& > * + *': {
      marginTop: '16px',
    },
  },
}));

export default function SystemAlert() {
  const classes = useStyles();
  const globalState = useContext(store);
  const {dispatch} = globalState;
  const handleClose = (key: string) => {
    dispatch({
      type: ActionType.DELETE_ALERT,
      payload: {
        key: key,
      },
    });
  };

  const alerts = globalState.state.alerts;
  const oldest_alert = alerts[0];
  if(alerts.length > 0)
    console.log(oldest_alert.severity)
  return (
    <div className={classes.root}>
      {alerts.length > 0 ? (
        <Snackbar
          open={true}
          autoHideDuration={6000}
          anchorOrigin={{vertical: 'top', horizontal: 'right'}}
        >
          <Alert
            onClose={() => handleClose(oldest_alert.key)}
            severity={oldest_alert.severity==='error'?'error':oldest_alert.severity==='warnings'?'warning':'success'}
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
  );
}
