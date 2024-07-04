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
import {useNavigate} from 'react-router-dom';
import {Box, Paper, Typography, Alert, Button, Stack} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';

import {
  DataGrid,
  GridColDef,
  GridCellParams,
  GridEventListener,
} from '@mui/x-data-grid';

import * as ROUTES from '../../../constants/routes';
import {getAllProjectList, listenProjectList} from '../../../databaseAccess';
import {useEventedPromise} from '../../pouchHook';
import {TokenContents} from 'faims3-datamodel';
import CircularLoading from '../../components/ui/circular_loading';
import ProjectStatus from '../notebook/settings/status';
import NotebookSyncSwitch from '../notebook/settings/sync_switch';
import useMediaQuery from '@mui/material/useMediaQuery';
import {useTheme} from '@mui/material/styles';
import {grey} from '@mui/material/colors';
import Tab from '@mui/material/Tab';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';

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
  const [value, setValue] = React.useState('1');

  const handleChange = (event: React.SyntheticEvent, newValue: string) => {
    setValue(newValue);
  };

  const history = useNavigate();
  const theme = useTheme();
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));
  const pouchProjectList = useEventedPromise(
    'NoteBooks component',
    getAllProjectList,
    listenProjectList,
    true,
    []
  ).expect();

  const handleRowClick: GridEventListener<'rowClick'> = params => {
    if (params.row.is_activated) {
      history(ROUTES.NOTEBOOK + params.row.project_id);
    } else {
      // do nothing
    }
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
          description: 'Toggle syncing this notebook to the server',
          renderCell: (params: GridCellParams) => (
            <NotebookSyncSwitch
              project={params.row}
              showHelperText={false}
              project_status={params.row.status}
              handleTabChange={setValue}
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
          description: 'Toggle syncing this notebook to the server',
          renderCell: (params: GridCellParams) => (
            <NotebookSyncSwitch
              project={params.row}
              showHelperText={false}
              project_status={params.row.status}
              handleTabChange={setValue}
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
        <Box component={Paper} elevation={0} p={2}>
          <Typography variant={'body1'} gutterBottom>
            You have {pouchProjectList.filter(r => r.is_activated).length}{' '}
            notebook
            {pouchProjectList.filter(r => r.is_activated).length !== 1
              ? 's'
              : ''}{' '}
            activated on this device. To start syncing a notebook, visit the{' '}
            <Button
              variant="text"
              size={'small'}
              onClick={() => {
                setValue('2');
              }}
            >
              Available
            </Button>{' '}
            tab and click the activate button.
          </Typography>
          <TabContext
            value={
              pouchProjectList.filter(r => r.is_activated).length === 0
                ? '2'
                : value
            }
          >
            <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
              <TabList onChange={handleChange} aria-label="tablist">
                <Tab
                  label={
                    'Activated (' +
                    pouchProjectList.filter(r => r.is_activated).length +
                    ')'
                  }
                  value="1"
                  disabled={
                    pouchProjectList.filter(r => r.is_activated).length === 0
                      ? true
                      : false
                  }
                />
                <Tab
                  label={
                    'Available (' +
                    pouchProjectList.filter(r => !r.is_activated).length +
                    ')'
                  }
                  value="2"
                />
              </TabList>
            </Box>
            <TabPanel value="1" sx={{px: 0}}>
              <div style={{display: 'flex', height: '100%'}}>
                <div style={{flexGrow: 1}}>
                  <DataGrid
                    key={'notebook_list_datagrid'}
                    rows={pouchProjectList.filter(r => r.is_activated)}
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
                        paginationModel: {
                          pageSize: pouchProjectList.length,
                        },
                      },
                    }}
                    components={{
                      NoRowsOverlay: () => (
                        <Stack
                          height="100%"
                          alignItems="center"
                          justifyContent="center"
                        >
                          No Notebooks have been activated yet.
                        </Stack>
                      ),
                    }}
                  />
                </div>
              </div>
            </TabPanel>
            <TabPanel value="2" sx={{px: 0}}>
              <div style={{display: 'flex', height: '100%'}}>
                <div style={{flexGrow: 1}}>
                  <DataGrid
                    key={'notebook_list_datagrid'}
                    rows={pouchProjectList.filter(r => !r.is_activated)}
                    loading={loading}
                    columns={columns}
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
                        paginationModel: {
                          pageSize: pouchProjectList.length,
                        },
                      },
                    }}
                    components={{
                      NoRowsOverlay: () => (
                        <Stack
                          height="100%"
                          alignItems="center"
                          justifyContent="center"
                        >
                          You don't have any unactivated notebooks.
                        </Stack>
                      ),
                    }}
                  />
                </div>
              </div>
            </TabPanel>
          </TabContext>
        </Box>
      )}
    </Box>
  );
}
