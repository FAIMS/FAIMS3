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
 * Filename: signin.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {makeStyles} from '@material-ui/core/styles';
import {Container, Grid} from '@material-ui/core';
import Breadcrumbs from '../components/ui/breadcrumbs';
import ProjectCard from '../components/project/card';
import * as ROUTES from '../../constants/routes';
import {listenProjectList} from '../../databaseAccess';
import {ProjectInformation} from '../../datamodel';
import {useState} from 'react';
import {useEffect} from 'react';
import {CircularProgress} from '@material-ui/core';
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

type SignInProps = {
  // project: string;
};

export function SignIn(props: SignInProps) {
  const classes = useStyles();

  const breadcrumbs = [
    {link: ROUTES.INDEX, title: 'Index'},
    {title: 'Sign In'},
  ];

  return (
    <Container maxWidth="lg">
      <Breadcrumbs data={breadcrumbs} />
      <div className={classes.gridRoot}>
        <Grid container spacing={1}>
          <Grid item xs={12}>
            <React.Fragment />
          </Grid>
        </Grid>
      </div>
    </Container>
  );
}
