/*
 * Copyright 2021,2022 Macquarie University
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
import Snackbar from '@material-ui/core/Snackbar';
import MuiAlert from '@material-ui/lab/Alert';
import {makeStyles, Theme} from '@material-ui/core/styles';
import {store} from '../../store';
import {ActionType} from '../../actions';

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    width: '100%',
    '& > * + *': {
      marginTop: theme.spacing(2),
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
  return (
    <div className={classes.root}>
      {alerts.length > 0 ? (
        <Snackbar
          open={true}
          autoHideDuration={6000}
          anchorOrigin={{vertical: 'top', horizontal: 'right'}}
        >
          <MuiAlert
            onClose={() => handleClose(oldest_alert.key)}
            severity={oldest_alert.severity}
          >
            {'message' in oldest_alert
              ? oldest_alert.message
              : oldest_alert.element}
          </MuiAlert>
        </Snackbar>
      ) : (
        ''
      )}
    </div>
  );
}
