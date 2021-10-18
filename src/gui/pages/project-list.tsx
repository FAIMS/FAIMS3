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
 * Filename: project-list.tsx
 * Description:
 *   TODO
 */

import React, {useRef} from 'react';
import {makeStyles} from '@material-ui/core/styles';
import {Button, Container, Grid, TextField} from '@material-ui/core';
import Breadcrumbs from '../components/ui/breadcrumbs';
import ProjectCard from '../components/project/card';
import * as ROUTES from '../../constants/routes';
// import {store} from '../../store';
import {listenProjectList} from '../../databaseAccess';
import {ProjectInformation} from '../../datamodel/ui';
import {useState} from 'react';
import {useEffect} from 'react';
import {CircularProgress} from '@material-ui/core';
import {create_new_project_dbs} from '../../sync/new-project';
import {ProjectID} from '../../datamodel/core';
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

export default function ProjectList() {
  const classes = useStyles();
  // const globalState = useContext(store);
  const [projectList, setProjectList] = useState(
    null as null | ProjectInformation[]
  );
  const breadcrumbs = [
    {link: ROUTES.INDEX, title: 'Index'},
    {title: 'Projects'},
  ];

  useEffect(() => {
    return listenProjectList(setProjectList);
  }, []);

  const inputRef = useRef<string>('');

  const [promiseState, setPromiseState] = useState<
    undefined | {} | ProjectID | null
  >(null);

  return (
    <Container maxWidth="lg">
      <Breadcrumbs data={breadcrumbs} />
      <div className={classes.gridRoot}>
        <Grid container spacing={1}>
          <TextField
            onChange={event => {
              inputRef.current = event.target.value;
            }}
          />
          <Button
            onClick={() => {
              setPromiseState(undefined);
              create_new_project_dbs(inputRef.current).then(
                result => setPromiseState(result),
                err => setPromiseState(err)
              );
            }}
            variant="contained"
            color="primary"
          >
            Create
          </Button>
          {promiseState === null ? (
            <React.Fragment />
          ) : promiseState === undefined ? (
            <CircularProgress />
          ) : typeof promiseState === 'string' ? (
            promiseState
          ) : (
            promiseState.toString()
          )}
          {projectList === null ? (
            <CircularProgress size={24} thickness={6} />
          ) : (
            projectList.map(project_info => {
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
