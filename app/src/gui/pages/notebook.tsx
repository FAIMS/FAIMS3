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
import {useState, useEffect, useContext} from 'react';
import {useParams, Navigate} from 'react-router-dom';
import {Box, Grid, Typography} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
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
import {ProjectsContext} from '../../context/projects-context';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function Notebook() {
  const {project_id} = useParams<{project_id: ProjectID}>();
  const [project_info, setProjectInfo] = useState<
    ProjectInformation | undefined
  >(undefined);
  const [project_error, setProjectError] = useState(null as any);
  const loading = project_info === undefined;

  const getInfoWrapper = async () => {
    await sleep(100);

    try {
      const info = await getProjectInfo(project_id!);

      console.log('DEBUG: CURRENT', info);

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

  const projects = useContext(ProjectsContext);

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
