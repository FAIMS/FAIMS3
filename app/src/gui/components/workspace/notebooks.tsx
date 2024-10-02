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
import { Box, Button, Paper, Typography } from '@mui/material';
import { grey } from '@mui/material/colors';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { GridColDef } from '@mui/x-data-grid';
import { useContext, useState } from 'react';
import { NOTEBOOK_LIST_TYPE, NOTEBOOK_NAME } from '../../../buildconfig';
import { ProjectsContext } from '../../../context/projects-context';
import { ProjectExtended } from '../../../types/project';
import { getClusterId, userCanCreateNotebooks } from '../../../users';
import { projectListVerbose } from '../../themes';
import ProjectStatus from '../notebook/settings/status';
import NotebookSyncSwitch from '../notebook/settings/sync_switch';
import CircularLoading from '../ui/circular_loading';
import HeadingGrid from '../ui/heading-grid';
import Tabs from '../ui/tab-grid';

export default function NoteBooks(props: NoteBookListProps) {
  const [tabID, setTabID] = React.useState('1');
  const [canCreateNotebooks, setCanCreateNotebooks] = useState<boolean>(false);
  const handleChange = (event: React.SyntheticEvent, newValue: string) => {
    setTabID(newValue);
  };

  const history = useNavigate();
  const {projects} = useContext(ProjectsContext);
  const theme = useTheme();
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));
  const columns: GridColDef<ProjectExtended>[] = not_xs;

  useEffect(() => {
    // Check if the user has permission to create notebooks
    try {
      const cluster_id = await getClusterId();
      if (cluster_id) {
        const permission = await userCanCreateNotebooks(cluster_id);
        setCanCreateNotebooks(permission ?? false);
      }
    } catch (error) {
      console.error('Error checking user permissions:', error);
      setCanCreateNotebooks(false);
    }
  }, []);

  const handleRowClick: GridEventListener<'rowClick'> = params => {
    if (params.row.is_activated) {
      history(ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE + params.row.project_id);
    } else {
      // do nothing
    }
  };
  const {projects} = useContext(ProjectsContext);

  const theme = useTheme();
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));

  const activatedProjects = projects.filter(({activated}) => activated);

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

  return (
    <Box>
      {projects.length === 0 ? (
        <CircularLoading label={`Loading ${NOTEBOOK_NAME}s`} />
      ) : (
        <Box component={Paper} elevation={0} p={2}>
          {projectListVerbose && (
            <Typography variant={'body1'} gutterBottom>
              You have {activatedProjects} {NOTEBOOK_NAME}
              {activatedProjects.length !== 1 ? 's' : ''} activated on this
              device. To start syncing a {NOTEBOOK_NAME}, visit the{' '}
              <Button
                variant="text"
                size={'small'}
                onClick={() => {
                  setTabID('2');
                }}
              >
                Available
              </Button>{' '}
              tab and click the activate button.
            </Typography>
          )}
          {canCreateNotebooks && (
            <Button
              variant="contained"
              color="primary"
              onClick={() => history(ROUTES.CREATE_NEW_SURVEY)}
              sx={{mb: 3, mt: 3}}
              startIcon={<AddCircleSharpIcon />}
            >
              Create New Survey
            </Button>
          )}
          {NOTEBOOK_LIST_TYPE === 'tabs' ? (
            <Tabs
              pouchProjectList={projects}
              tabID={tabID}
              handleChange={handleChange}
              handleRowClick={handleRowClick}
              loading={loading}
              columns={columns}
              sortModel={props.sortModel}
            />
          ) : (
            <HeadingGrid
              pouchProjectList={pouchProjectList}
              handleRowClick={handleRowClick}
              loading={loading}
              columns={columns}
              sortModel={props.sortModel}
            />
          )}
        </Box>
      )}
    </Box>
  );
}
