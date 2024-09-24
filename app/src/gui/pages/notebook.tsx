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
import {useContext} from 'react';
import {useParams} from 'react-router-dom';
import {Box, Grid, Typography} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import {CircularProgress} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import RefreshNotebook from '../components/notebook/refresh';
import {ProjectsContext} from '../../context/projects-context';
import NotebookComponent from '../components/notebook';

export default function Notebook() {
  const {project_id} = useParams<{
    project_id: string;
  }>();

  const project = useContext(ProjectsContext).projects.find(
    ({_id, listing}) => project_id === `${listing}||${_id}`
  );

  const theme = useTheme();
  const mq_above_md = useMediaQuery(theme.breakpoints.up('md'));

  return project ? (
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
              <Grid item>{project.name}</Grid>
            </Grid>
          </Typography>
        </Grid>
        <Grid item xs>
          {/* <Breadcrumbs data={breadcrumbs} /> */}
        </Grid>
      </Grid>
      <RefreshNotebook handleRefresh={() => {}} project_name={project.name} />
      <NotebookComponent
        project={project}
        handleRefresh={() => new Promise(() => {})}
      />
    </Box>
  ) : (
    <CircularProgress data-testid="progressbar" />
  );
}
