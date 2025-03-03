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
 */

/**
 * Description:
 * Name: Notebook component
 * This component displays detailed information about a specific notebook
 * in a project. It handles loading, error states, and fetches project
 * information using the project ID from the URL. It also provides navigation
 * back to the list of notebooks and displays the notebook's active status.
 *
 * Dependencies:
 * - React hooks: useState, useEffect
 * - React Router: useParams, useNavigate
 * - Material UI: Box, Typography, Chip, IconButton, CircularProgress
 */
import {CircularProgress, Stack, Typography} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {useNavigate, useParams} from 'react-router-dom';
import * as ROUTES from '../../constants/routes';
import NotebookComponent from '../components/notebook';
import BackButton from '../components/ui/BackButton';
import {useAppSelector} from '../../context/store';
import NotFound404 from './404';

export default function Notebook() {
  const theme = useTheme();
  const {serverId, projectId} = useParams<{
    projectId: string;
    serverId: string;
  }>();
  if (!projectId || !serverId) return <NotFound404 />;

  const history = useNavigate();
  const project = useAppSelector(
    state => state.projects.servers[serverId]?.projects[projectId]
  );
  const largerThanMedium = useMediaQuery(theme.breakpoints.up('md'));

  if (!project) return <CircularProgress data-testid="progressbar" />;

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems={'center'} spacing={2}>
        <BackButton
          label="Back"
          onClick={() => history(ROUTES.INDEX)}
        ></BackButton>

        <Typography
          variant={largerThanMedium ? 'h3' : 'h4'}
          component="div"
          sx={{
            fontWeight: 'bold',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {project.metadata.name}
        </Typography>
      </Stack>

      <NotebookComponent project={project} />
    </Stack>
  );
}
