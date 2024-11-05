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

import AddCircleSharpIcon from '@mui/icons-material/AddCircleSharp';
import FolderIcon from '@mui/icons-material/Folder';
import {Box, Button, Paper, Typography} from '@mui/material';
import {grey} from '@mui/material/colors';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {GridColDef} from '@mui/x-data-grid';
import {useContext, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {NOTEBOOK_LIST_TYPE, NOTEBOOK_NAME} from '../../../buildconfig';
import * as ROUTES from '../../../constants/routes';
import {ProjectsContext} from '../../../context/projects-context';
import {ProjectExtended} from '../../../types/project';
import {CREATE_NOTEBOOK_ROLES, userHasRoleInAnyListing} from '../../../users';
import {useGetAllUserInfo} from '../../../utils/useGetCurrentUser';
import NotebookSyncSwitch from '../notebook/settings/sync_switch';
import HeadingProjectGrid from '../ui/heading-grid';
import Tabs from '../ui/tab-grid';

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
            <Box my={3}>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'nowrap',
                  padding: '12px 0',
                }}
              >
                <FolderIcon
                  fontSize={'small'}
                  color={activated ? 'primary' : 'disabled'}
                  sx={{mr: '8px'}}
                />
                <Typography
                  variant={'body1'}
                  fontWeight={activated ? 'bold' : 'normal'}
                  color={activated ? 'black' : grey[800]}
                  sx={{
                    padding: '4px 0',
                    lineHeight: 1,
                  }}
                >
                  {name}
                </Typography>
              </span>
              <Typography variant={'caption'}>{description}</Typography>
            </Box>
          ),
        },
        // commenting this untill the functionality is fixed for this column.
        // {
        //   field: 'last_updated',
        //   headerName: 'Last Updated',
        //   type: 'dateTime',
        //   minWidth: 160,
        //   flex: 0.2,
        //   valueGetter: ({value}) => value && new Date(value),
        // },
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
          renderCell: ({row: {activated, name, description}}) => (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  padding: '12px 0',
                }}
              >
                <FolderIcon
                  fontSize={'small'}
                  color={activated ? 'secondary' : 'disabled'}
                  sx={{mr: '4px'}}
                />
                <Typography
                  variant={'body2'}
                  fontWeight={activated ? 'bold' : 'normal'}
                  color={activated ? 'black' : grey[800]}
                  sx={{
                    padding: '4px 0',
                  }}
                >
                  {name}
                </Typography>
              </div>
              <Typography variant={'caption'} sx={{paddingTop: '4px'}}>
                {description}
              </Typography>
            </div>
          ),
        },
        // commenting this untill the functionality is fixed for this column.

        // {
        //   field: 'last_updated',
        //   headerName: 'Last Updated',
        //   type: 'dateTime',
        //   minWidth: 100,
        //   flex: 0.3,
        //   valueGetter: ({value}) => value && new Date(value),
        // },
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

  // fetch all user info then determine if any listing has permission to create notebooks
  const allUserInfo = useGetAllUserInfo();
  const showCreateNewNotebookButton = allUserInfo?.data
    ? userHasRoleInAnyListing(allUserInfo.data, CREATE_NOTEBOOK_ROLES)
    : false;

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
        {showCreateNewNotebookButton && (
          <Button
            variant="contained"
            color="primary"
            onClick={() => history(ROUTES.CREATE_NEW_SURVEY)}
            sx={{mb: 3, mt: 3, backgroundColor: theme.palette.primary.main}}
            startIcon={<AddCircleSharpIcon />}
          >
            Create New {NOTEBOOK_NAME}
          </Button>
        )}
        {NOTEBOOK_LIST_TYPE === 'tabs' ? (
          <Tabs
            projects={projects}
            tabID={tabID}
            handleChange={setTabID}
            columns={columns}
          />
        ) : (
          <HeadingProjectGrid projects={projects} columns={columns} />
        )}
      </Box>
    </Box>
  );
}
