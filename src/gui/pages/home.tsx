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
 * Filename: home.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {makeStyles} from '@material-ui/core/styles';
import {Link as RouterLink} from 'react-router-dom';
import {Container, Typography, Box, Grid, Paper, Link} from '@material-ui/core';
import ProjectCard from '../components/project/card';
import * as ROUTES from '../../constants/routes';
// import {store} from '../../store';
import {getProjectList} from '../../databaseAccess';
import Breadcrumbs from '../components/ui/breadcrumbs';
import DashboardActions from '../components/dashboard/actions';

const useStyles = makeStyles(theme => ({
  gridRoot: {
    flexGrow: 1,
  },
  container: {
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(4),
  },
  paper: {
    padding: theme.spacing(2),
    display: 'flex',
    overflow: 'auto',
    flexDirection: 'column',
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
}));

export default function Home() {
  const classes = useStyles();
  // const globalState = useContext(store);
  const pouchProjectList = getProjectList();
  const breadcrumbs = [{link: ROUTES.HOME, title: 'Home'}, {title: 'WorkSpace'}];
  return (
    <Container maxWidth="lg">
      <Breadcrumbs data={breadcrumbs} />
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="overline">Add new Record</Typography>
          <Paper className={classes.paper}>
            <DashboardActions pouchProjectList={pouchProjectList} />
          </Paper>
        </Grid>

        {/* Recent Projects */}
        <Grid item xs={12} md={12} lg={12}>
          <Typography variant="overline">My Notebooks</Typography>
          <Paper className={classes.paper}>
            <Grid container spacing={1}>
              {Object.keys(pouchProjectList).length === 0 ? (
                <span>No Notebooks found</span>
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
            <Box mt={2}>
              <Link
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
                component={RouterLink}
                to={ROUTES.PROJECT_LIST}
              >
                View all notebooks
                {/*<ChevronRightIcon />*/}
              </Link>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}
