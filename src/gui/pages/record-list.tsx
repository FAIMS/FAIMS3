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
 * Filename: record-list.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import makeStyles from '@mui/styles/makeStyles';
import {Box, Container, Grid} from '@mui/material';
import * as ROUTES from '../../constants/routes';
import Breadcrumbs from '../components/ui/breadcrumbs';
import Skeleton from '@mui/material/Skeleton';
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
  const breadcrumbs = [{link: ROUTES.INDEX, title: 'Home'}, {title: 'Records'}];
  // const pouchRecordList = {};

  return (
    <Container maxWidth="lg">
      <Box display="flex" flexDirection="row-reverse" p={1} m={1}>
        <Breadcrumbs data={breadcrumbs} />
      </Box>

      <div className={classes.gridRoot}>
        <Grid container spacing={1}>
          <Grid item xs={12} key={'skeleton-record-list-grid'}>
            <Skeleton animation="wave" variant="rectangular" height={100} />
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
