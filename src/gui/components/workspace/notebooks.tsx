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

import React, {useEffect, useState} from 'react';
import {useHistory} from 'react-router-dom';
import {Box, Paper, Typography, Alert} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';

import {
  DataGrid,
  GridColDef,
  GridCellParams,
  GridEventListener,
} from '@mui/x-data-grid';

import * as ROUTES from '../../../constants/routes';
import {getProjectList, listenProjectList} from '../../../databaseAccess';
import {useEventedPromise} from '../../pouchHook';
import {TokenContents} from '../../../datamodel/core';
import CircularLoading from '../../components/ui/circular_loading';
import ProjectStatus from '../notebook/settings/status';
import NotebookSyncSwitch from '../notebook/settings/sync_switch';
import useMediaQuery from '@mui/material/useMediaQuery';
import {useTheme} from '@mui/material/styles';

interface sortModel {
  field: string;
  sort: 'asc' | 'desc';
}
type NoteBookListProps = {
  token?: null | undefined | TokenContents;
  sortModel: sortModel; // {field: 'name', sort: 'asc'}
};

export default function NoteBooks(props: NoteBookListProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [counter, setCounter] = React.useState(5);
  const history = useHistory();
  const theme = useTheme();
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));
  const pouchProjectList = useEventedPromise(
    'NoteBooks component',
    getProjectList,
    listenProjectList,
    true,
    []
  ).expect();

  const handleRowClick: GridEventListener<'rowClick'> = params => {
    history.push(ROUTES.NOTEBOOK + params.row.project_id);
  };
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
                  color={'secondary'}
                  sx={{mr: '3px'}}
                />
                <Typography variant={'body2'} fontWeight={'bold'}>
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
            <ProjectStatus status={params.value} />
          ),
        },
        {
          field: 'actions',
          type: 'actions',
          flex: 0.2,
          minWidth: 160,
          headerName: 'Sync',
          description: 'Toggle syncing this notebook to the server',
          renderCell: (params: GridCellParams) => (
            <NotebookSyncSwitch
              project={params.row}
              showHelperText={false}
              project_status={params.row.status}
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
                  color={'secondary'}
                  sx={{mr: '3px'}}
                />
                <Typography variant={'body2'} fontWeight={'bold'}>
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
          minWidth: 80,
          flex: 0.3,
          valueGetter: ({value}) => value && new Date(value),
        },
        {
          field: 'actions',
          type: 'actions',
          flex: 0.3,
          minWidth: 60,
          headerName: 'Sync',
          description: 'Toggle syncing this notebook to the server',
          renderCell: (params: GridCellParams) => (
            <NotebookSyncSwitch
              project={params.row}
              showHelperText={false}
              project_status={params.row.status}
            />
          ),
        },
      ];

  // if the counter changes, add a new timeout, but only if > 0
  useEffect(() => {
    counter > 0 && setTimeout(() => setCounter(counter - 1), 1000);
    counter === 0 && setLoading(false);
  }, [counter]);

  return (
    <Box>
      {pouchProjectList === null ? (
        <CircularLoading label={'Loading notebooks'} />
      ) : Object.keys(pouchProjectList).length === 0 ? (
        <Alert severity={'info'}>
          No notebooks found. Checking again in {counter} seconds.
        </Alert>
      ) : (
        <Box component={Paper} elevation={0}>
          <DataGrid
            key={'notebook_list_datagrid'}
            rows={pouchProjectList}
            loading={loading}
            columns={columns}
            onRowClick={handleRowClick}
            autoHeight
            sx={{cursor: 'pointer'}}
            getRowId={r => r.project_id}
            hideFooter={true}
            getRowHeight={() => 'auto'}
            initialState={{
              sorting: {
                sortModel: [props.sortModel],
              },
              pagination: {
                pageSize: pouchProjectList.length,
              },
            }}
          />
        </Box>
      )}
    </Box>
  );
}
