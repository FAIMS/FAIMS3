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
 * Filename: home.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {
  Typography,
  Box,
  Grid,
  Paper,
  // Link,
  CircularProgress,
} from '@mui/material';
import ProjectCard from '../components/project/card';
import * as ROUTES from '../../constants/routes';
// import {store} from '../../store';
import {getProjectList, listenProjectList} from '../../databaseAccess';
import Breadcrumbs from '../components/ui/breadcrumbs';
import {useEventedPromise} from '../pouchHook';

export default function Home() {
  const pouchProjectList = useEventedPromise(
    getProjectList,
    listenProjectList,
    true,
    []
  ).expect();

  const breadcrumbs = [
    {link: ROUTES.INDEX, title: 'Home'},
    {title: 'Workspace'},
  ];

  return (
    <React.Fragment>
      <Breadcrumbs data={breadcrumbs} />
      <Grid container spacing={3}>
        {/* Recent Projects */}
        <Grid item xs={12} md={12} lg={12}>
          <Typography variant="overline">My Notebooks</Typography>
          <Paper>
            <Grid container spacing={1}>
              {pouchProjectList === null ? (
                <CircularProgress />
              ) : Object.keys(pouchProjectList).length === 0 ? (
                <span>No notebooks found</span>
              ) : (
                pouchProjectList.map(project_info => {
                  const project_id = project_info.project_id;
                  if (project_info !== null) {
                    return (
                      <Grid item xs={12} key={'project-list-grid' + project_id}>
                        <ProjectCard project={project_info} dashboard={true} />
                      </Grid>
                    );
                  } else {
                    return (
                      <Grid item xs={12} key={'project-list-grid' + project_id}>
                        Project could not be loaded
                      </Grid>
                    );
                  }
                })
              )}
            </Grid>
            <Box mt={2}></Box>
          </Paper>
        </Grid>
      </Grid>
    </React.Fragment>
  );
}
