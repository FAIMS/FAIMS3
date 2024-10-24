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
import {useContext} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {Box, Chip, Grid, IconButton, Typography} from '@mui/material';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import {CircularProgress} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {ProjectsContext} from '../../context/projects-context';
import NotebookComponent from '../components/notebook';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ErrorIcon from '@mui/icons-material/Error';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import * as ROUTES from '../../constants/routes';
import {NOTEBOOK_NAME_CAPITALIZED} from '../../buildconfig';

export default function Notebook() {
  const {project_id} = useParams<{
    project_id: string;
  }>();

  const project = useContext(ProjectsContext).projects.find(
    project => project_id === project.project_id
  );

  if (!project) return <CircularProgress data-testid="progressbar" />;

  const theme = useTheme();
  const mq_above_md = useMediaQuery(theme.breakpoints.up('md'));

  const history = useNavigate();
  const isActive = project?.activated;

  return (
    <Box>
      {/* Back Button Section */}
      <Box sx={{display: 'flex', alignItems: 'center', padding: '8px'}}>
        <IconButton
          onClick={() => history(ROUTES.INDEX)}
          aria-label="back"
          size="small"
          sx={{color: 'black'}}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography
          variant="body1"
          sx={{marginLeft: '8px', fontWeight: 'bold'}}
        >
          Back to {NOTEBOOK_NAME_CAPITALIZED}s
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
        }}
      >
        <Box
          sx={{display: 'flex', alignItems: 'center', flexGrow: 1, minWidth: 0}}
        >
          <MenuBookIcon
            color="primary"
            fontSize={mq_above_md ? 'large' : 'medium'}
            sx={{marginRight: '8px'}}
          />
          <Typography
            variant={mq_above_md ? 'h4' : 'h5'}
            component="div"
            sx={{
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontSize: '1.6rem',
            }}
          >
            {project.name}
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            textAlign: 'center',
            marginLeft: {xs: '32px', sm: '24px', md: '20px'},
          }}
        >
          {isActive ? (
            <Chip
              label="Active"
              icon={<CheckCircleIcon />}
              sx={{
                backgroundColor: 'green',
                color: 'white',
                fontSize: '15px',
                fontWeight: 'bold',
                borderRadius: '8px',
                '& .MuiChip-icon': {
                  color: 'white',
                },
              }}
            />
          ) : (
            <Chip
              label="Not Active"
              icon={<ErrorIcon sx={{color: 'white'}} />}
              sx={{
                backgroundColor: '#b62b2b',
                color: 'white',
                fontSize: '15px',
                fontWeight: 'bold',
                borderRadius: '8px',
                '& .MuiChip-icon': {
                  color: 'white',
                },
              }}
            />
          )}
        </Box>
      </Box>
      {/* <Grid
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
      </Grid> */}
      <NotebookComponent project={project} />
    </Box>
  );
}
