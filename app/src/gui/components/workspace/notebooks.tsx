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

import React, {useContext} from 'react';
import {Box, Paper, Typography, Button} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import {GridColDef, GridCellParams, GridEventListener} from '@mui/x-data-grid';
import {TokenContents} from '@faims3/data-model';
import CircularLoading from '../ui/circular_loading';
import ProjectStatus from '../notebook/settings/status';
import NotebookSyncSwitch from '../notebook/settings/sync_switch';
import useMediaQuery from '@mui/material/useMediaQuery';
import {useTheme} from '@mui/material/styles';
import {grey} from '@mui/material/colors';
import Tabs from '../ui/tab-grid';
import HeadingGrid from '../ui/heading-grid';
import {NOTEBOOK_LIST_TYPE, NOTEBOOK_NAME} from '../../../buildconfig';
import {ProjectsContext} from '../../../context/projects-context';
import {ActivatedContext} from '../../../context/activated-context';
import {activateProject} from '../../../dbs/activated-db';
import * as ROUTES from '../../../constants/routes';
import { useNavigate } from 'react-router-dom';

interface sortModel {
  field: string;
  sort: 'asc' | 'desc';
}
type NoteBookListProps = {
  token?: null | undefined | TokenContents;
  sortModel: sortModel;
};

export default function NoteBooks(props: NoteBookListProps) {
  const [tabID, setTabID] = React.useState('1');

  const activated = useContext(ActivatedContext);
  const projects = useContext(ProjectsContext).map(project => ({
    activated: !!activated.get(project._id),
    ...project,
  }));

  const theme = useTheme();
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));
  const history = useNavigate();

  const handleRowClick: GridEventListener<'rowClick'> = ({ row: { is_activated, project_id } }) => is_activated && history(ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE + project_id);

  const columns: GridColDef[] = not_xs
    ? [
        {
          field: 'name',
          headerName: 'Name',
          type: 'string',
          flex: 0.4,
          minWidth: 200,
          renderCell: (params: GridCellParams) => (
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
                  color={params.row.is_activated ? 'secondary' : 'disabled'}
                  sx={{mr: '3px'}}
                />
                <Typography
                  variant={'body2'}
                  fontWeight={params.row.is_activated ? 'bold' : 'normal'}
                  color={params.row.is_activated ? 'black' : grey[800]}
                >
                  {params.row.name}
                </Typography>
              </span>
              <Typography variant={'caption'}>
                {params.row.description}
              </Typography>
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
          renderCell: (params: GridCellParams) => (
            <ProjectStatus status={params.row.status} />
          ),
        },
        {
          field: 'actions',
          type: 'actions',
          flex: 0.2,
          minWidth: 160,
          headerName: 'Sync',
          description: `Toggle syncing this ${NOTEBOOK_NAME} to the server`,
          renderCell: (params: GridCellParams) => (
            <NotebookSyncSwitch
              project={params.row}
              showHelperText={false}
              project_status={params.row.status}
              handleActivation={activateProject}
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
          renderCell: (params: GridCellParams) => (
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
                  color={params.row.activated ? 'secondary' : 'disabled'}
                  sx={{mr: '3px'}}
                />
                <Typography
                  variant={'body2'}
                  fontWeight={params.row.activated ? 'bold' : 'normal'}
                  color={params.row.activated ? 'black' : grey[800]}
                >
                  {params.row.name}
                </Typography>
              </span>
              <Typography variant={'caption'}>
                {params.row.description}
              </Typography>
              <Box my={1}>
                <ProjectStatus status={params.row.status} />
              </Box>
            </Box>
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
          renderCell: (params: GridCellParams) => (
            <NotebookSyncSwitch
              project={params.row}
              showHelperText={false}
              project_status={params.row.status}
              handleActivation={activateProject}
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
          <Typography variant={'body1'} gutterBottom>
            You have {projects.filter(({_id}) => activated.get(_id)).length}{' '}
            {NOTEBOOK_NAME}
            {projects.filter(({_id}) => activated.get(_id)).length !== 1
              ? 's'
              : ''}{' '}
            activated on this device. To start syncing a {NOTEBOOK_NAME}, visit
            the{' '}
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
          {NOTEBOOK_LIST_TYPE === 'tabs' ? (
            <Tabs
              pouchProjectList={projects}
              tabID={tabID}
              handleChange={() => {}}
              handleRowClick={handleRowClick}
              loading={false}
              columns={columns}
              sortModel={props.sortModel}
            />
          ) : (
            <HeadingGrid
              pouchProjectList={projects}
              handleRowClick={handleRowClick}
              loading={false}
              columns={columns}
              sortModel={props.sortModel}
            />
          )}
        </Box>
      )}
    </Box>
  );
}
