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
 * Filename: project-list.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import makeStyles from '@mui/styles/makeStyles';
import {Container, Grid} from '@mui/material';
import Breadcrumbs from '../components/ui/breadcrumbs';
import ProjectCard from '../components/project/card';
import * as ROUTES from '../../constants/routes';
import {getProjectList, listenProjectList} from '../../databaseAccess';
import {CircularProgress} from '@mui/material';
import {useEventedPromise} from '../pouchHook';
import {TokenContents} from '../../datamodel/core';

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
  NoPadding: {
    [theme.breakpoints.down('md')]: {
      paddingLeft: 5,
      paddingRight: 5,
    },
  },
}));

type ProjectProps = {
  token?: null | undefined | TokenContents;
};

export default function ProjectList(props: ProjectProps) {
  const classes = useStyles();
  const pouchProjectList = useEventedPromise(
    getProjectList,
    listenProjectList,
    true,
    []
  ).expect();
  const breadcrumbs = [
    {link: ROUTES.HOME, title: 'Home'},
    {title: 'Notebooks'},
  ];

  return (
    <Container maxWidth="lg" className={classes.NoPadding}>
      <Breadcrumbs data={breadcrumbs} token={props.token} />
      <div className={classes.gridRoot}>
        <Grid container spacing={1}>
          {pouchProjectList === null ? (
            <CircularProgress size={24} thickness={6} />
          ) : (
            pouchProjectList.map(project_info => {
              return (
                <Grid
                  item
                  xs={12}
                  key={'project-list-grid' + project_info.project_id}
                >
                  <ProjectCard
                    project={project_info}
                    listView={true}
                    showRecords={true}
                    dashboard={false}
                  />
                </Grid>
              );
            })
          )}
        </Grid>
      </div>
    </Container>
  );
}