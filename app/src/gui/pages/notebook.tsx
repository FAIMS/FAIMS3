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
import MenuBookIcon from '@mui/icons-material/MenuBook';
import Breadcrumbs from '../components/ui/breadcrumbs';
import * as ROUTES from '../../constants/routes';

import {getProjectInfo} from '../../sync/projects';
import {ProjectID} from '@faims3/data-model';
import {CircularProgress} from '@mui/material';

import NotebookComponent from '../components/notebook';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import RefreshNotebook from '../components/notebook/refresh';
import {ProjectInformation} from '@faims3/data-model';
import {logError} from '../../logging';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '../../buildconfig';

export default function Notebook() {
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
    {link: ROUTES.NOTEBOOK_LIST_ROUTE, title: `${NOTEBOOK_NAME_CAPITALIZED}s`},
    {
      title: !loading ? project_info.name : '',
    },
  ];
  const theme = useTheme();
  const mq_above_md = useMediaQuery(theme.breakpoints.up('md'));

  if (project_error !== null) {
    logError(`Failed to load ${NOTEBOOK_NAME} ${project_id}, ${project_error}`);
    return <Navigate to="/404" />;
  }
  const handleRefresh = () => {
    return getInfoWrapper();
  };

  return !loading ? (
    <Box>
      <Box
        sx={{
          textAlign: 'center',
          padding: '8px 0',
          backgroundColor: '#f5f5f5',
        }}
      >
        <Grid container direction="column" alignItems="center">
          <Grid item>
            <MenuBookIcon
              color={'secondary'}
              fontSize={mq_above_md ? 'large' : 'medium'}
            />
          </Grid>
          <Grid item>
            <Typography
              variant={mq_above_md ? 'h3' : 'h4'}
              component={'div'}
              sx={{fontWeight: 'bold'}}
            >
              {project_info.name}
            </Typography>
          </Grid>
        </Grid>
      </Box>

      <Box sx={{paddingLeft: '16px', marginTop: '8px'}}>
        <Breadcrumbs data={breadcrumbs} />
      </Box>

      <Box sx={{paddingTop: '16px'}}>
        <RefreshNotebook
          handleRefresh={handleRefresh}
          project_name={project_info.name}
        />
        <NotebookComponent
          project={project_info}
          handleRefresh={handleRefresh}
        />
      </Box>
    </Box>
  ) : (
    <CircularProgress data-testid="progressbar" />
  );
}
