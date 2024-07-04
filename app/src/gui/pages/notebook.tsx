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
 * Filename: notebook.tsx
 * Description:
 *   TODO
 */
import React, {useState, useEffect} from 'react';
import {useParams, Navigate} from 'react-router-dom';
import {Box, Grid, Typography} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import Breadcrumbs from '../components/ui/breadcrumbs';
import * as ROUTES from '../../constants/routes';

import {getProjectInfo} from '../../databaseAccess';
import {ProjectID} from 'faims3-datamodel';
import {CircularProgress} from '@mui/material';

import NotebookComponent from '../components/notebook';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import RefreshNotebook from '../components/notebook/refresh';
import {ProjectInformation} from 'faims3-datamodel';
import {logError} from '../../logging';

export default function Notebook() {
  /**
   *
   */
  const {project_id} = useParams<{project_id: ProjectID}>();
  const [project_info, setProjectInfo] = useState(
    undefined as ProjectInformation | undefined
  );
  const [project_error, setProjectError] = useState(null as any);
  const loading = project_info === undefined;

  const getInfoWrapper = async () => {
    try {
      const info = await getProjectInfo(project_id!);
      setProjectInfo(info);
    } catch (err) {
      setProjectError(err);
    }
  };

  useEffect(() => {
    const getInfo = async () => {
      await getInfoWrapper();
    };
    getInfo();
  }, [project_id]);

  const breadcrumbs = [
    // {link: ROUTES.INDEX, title: 'Home'},
    {link: ROUTES.NOTEBOOK_LIST, title: 'Notebooks'},
    {
      title: !loading ? project_info.name : '',
    },
  ];
  const theme = useTheme();
  const mq_above_md = useMediaQuery(theme.breakpoints.up('md'));

  if (project_error !== null) {
    logError(`Failed to load notebook ${project_id}, ${project_error}`);
    return <Navigate to="/404" />;
  }
  const handleRefresh = () => {
    /**
     * Handler for Refreshing project
     */
    return getInfoWrapper();
  };

  return !loading ? (
    <Box>
      <Grid
        container
        direction="row"
        justifyContent="flex-start"
        alignItems="center"
        spacing={2}
      >
        <Grid item xs={'auto'}>
          <Typography variant={mq_above_md ? 'h3' : 'h4'} component={'div'}>
            <Grid
              container
              direction="row"
              justifyContent="flex-start"
              alignItems="center"
              spacing={1}
            >
              <Grid item>
                <FolderIcon
                  color={'secondary'}
                  fontSize={mq_above_md ? 'large' : 'medium'}
                  style={{verticalAlign: 'middle'}}
                />
              </Grid>
              <Grid item>{project_info.name}</Grid>
            </Grid>
          </Typography>
        </Grid>
        <Grid item xs>
          <Breadcrumbs data={breadcrumbs} />
        </Grid>
      </Grid>
      <RefreshNotebook
        handleRefresh={handleRefresh}
        project_name={project_info.name}
      />
      <NotebookComponent project={project_info} handleRefresh={handleRefresh} />
    </Box>
  ) : (
    <CircularProgress data-testid="progressbar" />
  );
}
