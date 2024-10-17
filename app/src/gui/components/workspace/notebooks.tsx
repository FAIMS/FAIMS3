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
 * Filename: project-list.tsx
 * Description:
 *   TODO
 */

import {useContext, useState} from 'react';
import {Box, Paper, Typography, Button} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import {GridColDef} from '@mui/x-data-grid';
import ProjectStatus from '../notebook/settings/status';
import NotebookSyncSwitch from '../notebook/settings/sync_switch';
import useMediaQuery from '@mui/material/useMediaQuery';
import {useTheme} from '@mui/material/styles';
import {grey} from '@mui/material/colors';
import Tabs from '../ui/tab-grid';
import HeadingGrid from '../ui/heading-grid';
import {NOTEBOOK_LIST_TYPE, NOTEBOOK_NAME} from '../../../buildconfig';
import AddCircleSharpIcon from '@mui/icons-material/AddCircleSharp';
import * as ROUTES from '../../../constants/routes';
import {ProjectsContext} from '../../../context/projects-context';
import {ProjectExtended} from '../../../types/project';
import {useNavigate} from 'react-router-dom';

export default function NoteBooks() {
  const [tabID, setTabID] = useState('1');
  const {projects} = useContext(ProjectsContext);
  const history = useNavigate();

  const theme = useTheme();
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));

  const columns: GridColDef<ProjectExtended>[] = not_xs
    ? [
        {
          field: 'name',
          headerName: 'Name',
          type: 'string',
          flex: 0.4,
          minWidth: 200,
          renderCell: ({row: {activated, name, description}}) => (
            <Box my={1}>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  flexWrap: 'nowrap',
                }}
              >
                <FolderIcon
                  fontSize={'small'}
                  color={activated ? 'secondary' : 'disabled'}
                  sx={{mr: '3px'}}
                />
                <Typography
                  variant={'body2'}
                  fontWeight={activated ? 'bold' : 'normal'}
                  color={activated ? 'black' : grey[800]}
                >
                  {name}
                </Typography>
              </span>
              <Typography variant={'caption'}>{description}</Typography>
            </Box>
          ),
        },
        {
          field: 'last_updated',
          headerName: 'Last Updated',
          type: 'dateTime',
          minWidth: 160,
          flex: 0.2,
          valueGetter: ({value}) => value && new Date(value),
        },
        {
          field: 'status',
          headerName: 'Status',
          type: 'string',
          flex: 0.2,
          minWidth: 160,
          renderCell: ({row: {status}}) => <ProjectStatus status={status} />,
        },
        {
          field: 'actions',
          type: 'actions',
          flex: 0.2,
          minWidth: 160,
          headerName: 'Sync',
          description: `Toggle syncing this ${NOTEBOOK_NAME} to the server`,
          renderCell: ({row}) => (
            <NotebookSyncSwitch
              project={row}
              showHelperText={false}
              setTabID={setTabID}
            />
          ),
        },
      ]
    : [
        {
          field: 'name',
          headerName: 'Name',
          type: 'string',
          flex: 0.4,
          minWidth: 160,
          renderCell: ({row: {activated, name, description, status}}) => (
            <div>
              <div
                style={{
                  display: 'flex',
                }}
              >
                <FolderIcon
                  fontSize={'small'}
                  color={activated ? 'secondary' : 'disabled'}
                  sx={{mr: '3px'}}
                />
                <Typography
                  variant={'body2'}
                  fontWeight={activated ? 'bold' : 'normal'}
                  color={activated ? 'black' : grey[800]}
                >
                  {name}
                </Typography>
              </div>
              <Typography variant={'caption'}>{description}</Typography>
              <div>
                <ProjectStatus status={status} />
              </div>
            </div>
          ),
        },
        {
          field: 'last_updated',
          headerName: 'Last Updated',
          type: 'dateTime',
          minWidth: 100,
          flex: 0.3,
          valueGetter: ({value}) => value && new Date(value),
        },
        {
          field: 'actions',
          type: 'actions',
          flex: 0.3,
          minWidth: 80,
          headerName: 'Sync',
          description: `Toggle syncing this ${NOTEBOOK_NAME} to the server`,
          renderCell: ({row}) => (
            <NotebookSyncSwitch
              project={row}
              showHelperText={false}
              setTabID={setTabID}
            />
          ),
        },
      ];

  const activatedProjects = projects.filter(({activated}) => activated);

  return (
    <Box>
      <Box component={Paper} elevation={0} p={2}>
        <Typography variant={'body1'} gutterBottom>
          You have {activatedProjects.length} {NOTEBOOK_NAME}
          {activatedProjects.length !== 1 ? 's' : ''} activated on this device.
          To start using a {NOTEBOOK_NAME}, visit the{' '}
          <Button variant="text" size={'small'} onClick={() => setTabID('2')}>
            Available
          </Button>{' '}
          tab and click the activate button.
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => history(ROUTES.CREATE_NEW_SURVEY)}
          sx={{mb: 3, mt: 3}}
          startIcon={<AddCircleSharpIcon />}
        >
          Create New Survey
        </Button>
        {NOTEBOOK_LIST_TYPE === 'tabs' ? (
          <Tabs
            projects={projects}
            tabID={tabID}
            handleChange={setTabID}
            columns={columns}
          />
        ) : (
          <HeadingGrid
            pouchProjectList={projects}
            loading={false}
            columns={columns}
          />
        )}
      </Box>
    </Box>
  );
}
