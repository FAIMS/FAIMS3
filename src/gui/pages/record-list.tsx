/*
 * Copyright 2021 Macquarie University
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
 * Filename: record-list.tsx
 * Description:
 *   TODO
 */

import React, {useContext, useEffect} from 'react';
import {makeStyles} from '@material-ui/core/styles';
import {Box, Container, Grid} from '@material-ui/core';
import * as ROUTES from '../../constants/routes';
import Breadcrumbs from '../components/ui/breadcrumbs';
import {store} from '../../store';
import Skeleton from '@material-ui/lab/Skeleton';
import {ActionType} from '../../actions';
import InProgress from '../components/ui/inProgress';

const useStyles = makeStyles(theme => ({
  gridRoot: {
    flexGrow: 1,
  },
  bullet: {
    display: 'inline-block',
    margin: '0 2px',
    transform: 'scale(0.8)',
  },
  title: {
    fontSize: 14,
  },
  pos: {
    marginBottom: 12,
  },
  avatar: {
    borderRadius: 8,
    // backgroundColor: red[500],
    backgroundColor: theme.palette.secondary.light,
  },
  overline: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: 500,
  },
}));

export default function RecordList() {
  const classes = useStyles();
  const globalState = useContext(store);
  const {dispatch} = globalState;
  const breadcrumbs = [{link: ROUTES.HOME, title: 'Home'}, {title: 'Records'}];
  useEffect(() => {
    dispatch({
      type: ActionType.ADD_ALERT,
      payload: {
        message: 'Test: this is a global error message',
        severity: 'error',
      },
    });
    dispatch({
      type: ActionType.ADD_ALERT,
      payload: {
        message: 'Test: this is a global success message',
        severity: 'success',
      },
    });
    dispatch({
      type: ActionType.ADD_ALERT,
      payload: {
        message: 'Test: this is a global info message',
        severity: 'info',
      },
    });
  }, []);
  // const pouchRecordList = {};

  return (
    <Container maxWidth="lg">
      <Box display="flex" flexDirection="row-reverse" p={1} m={1}>
        <Breadcrumbs data={breadcrumbs} />
      </Box>

      <div className={classes.gridRoot}>
        <Grid container spacing={1}>
          <Grid item xs={12} key={'skeleton-record-list-grid'}>
            <Skeleton animation="wave" variant="rect" height={100} />
          </Grid>
          <InProgress />
          <p>
            This component (also shown on the user's home/dashboard) shows the
            latest e.g., 100 records across all the user's projects, and allows
            for filtering by meta data (owner, last updated etc).
          </p>
        </Grid>
      </div>
    </Container>
  );
}
