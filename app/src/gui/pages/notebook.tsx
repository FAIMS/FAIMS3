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
import {useParams, Navigate, useNavigate} from 'react-router-dom';
import {Box, Chip, IconButton, Typography} from '@mui/material';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import * as ROUTES from '../../constants/routes';

import {getProjectInfo} from '../../sync/projects';
import {ProjectID} from '@faims3/data-model';
import {CircularProgress} from '@mui/material';

import NotebookComponent from '../components/notebook';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {ProjectInformation} from '@faims3/data-model';
import {logError} from '../../logging';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '../../buildconfig';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ErrorIcon from '@mui/icons-material/Error';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

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

  const theme = useTheme();
  const mq_above_md = useMediaQuery(theme.breakpoints.up('md'));

  if (project_error !== null) {
    logError(`Failed to load ${NOTEBOOK_NAME} ${project_id}, ${project_error}`);
    return <Navigate to="/404" />;
  }
  const handleRefresh = () => {
    return getInfoWrapper();
  };

  const history = useNavigate();
  const isActive = project_info?.is_activated;

  return !loading ? (
    <Box>
      {/* Back Button Section */}
      <Box sx={{display: 'flex', alignItems: 'center', padding: '8px'}}>
        <IconButton
          onClick={() => history(ROUTES.NOTEBOOK_LIST_ROUTE)}
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
            {project_info.name}
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

      <Box sx={{paddingTop: '16px'}}>
        {/* @TODO remove later
        <RefreshNotebook
          handleRefresh={handleRefresh}
          project_name={project_info.name}
        /> */}
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
