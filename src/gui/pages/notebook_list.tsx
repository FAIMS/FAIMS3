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
import {Box, Paper, Typography, Grid, Alert} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';

import {
  DataGrid,
  GridColDef,
  GridCellParams,
  GridEventListener,
} from '@mui/x-data-grid';
import Breadcrumbs from '../components/ui/breadcrumbs';
import * as ROUTES from '../../constants/routes';
import {getProjectList, listenProjectList} from '../../databaseAccess';
import {useEventedPromise} from '../pouchHook';
import {TokenContents} from '../../datamodel/core';
import CircularLoading from '../components/ui/circular_loading';

type NoteBookListProps = {
  token?: null | undefined | TokenContents;
};

export default function NoteBookList(props: NoteBookListProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const history = useHistory();
  const pouchProjectList = useEventedPromise(
    getProjectList,
    listenProjectList,
    true,
    []
  ).expect();

  const breadcrumbs = [
    {link: ROUTES.INDEX, title: 'Home'},
    {title: 'Notebooks'},
  ];
  const handleRowClick: GridEventListener<'rowClick'> = params => {
    history.push(ROUTES.NOTEBOOK + params.row.project_id);
  };
  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Name',
      type: 'string',
      flex: 0.5,
      renderCell: (params: GridCellParams) => (
        <Box my={1}>
          <Typography variant={'h5'} sx={{m: 0}} component={'div'}>
            <Grid
              container
              justifyContent="flex-start"
              alignItems="center"
              spacing={1}
            >
              <Grid item>
                <FolderIcon
                  color={'secondary'}
                  style={{verticalAlign: 'middle'}}
                />
              </Grid>
              <Grid item>{params.row.name}</Grid>
            </Grid>
          </Typography>
          <Typography variant={'caption'}>{params.row.description}</Typography>
        </Box>
      ),
    },
    {
      field: 'last_updated',
      headerName: 'Last Updated',
      type: 'string',
      flex: 0.2,
    },
    {
      field: 'created',
      headerName: 'Created',
      type: 'string',
      flex: 0.2,
    },
    {
      field: 'status',
      headerName: 'Status',
      type: 'string',
      flex: 0.1,
    },
  ];

  return (
    <Box>
      <Breadcrumbs data={breadcrumbs} />
      {pouchProjectList === null ? (
        <CircularLoading label={'Loading notebooks'} />
      ) : Object.keys(pouchProjectList).length === 0 ? (
        <Alert severity={'info'}>No notebooks found</Alert>
      ) : (
        <Box component={Paper} elevation={0}>
          <DataGrid
            key={'notebook_list_datagrid'}
            rows={pouchProjectList}
            loading={loading}
            columns={columns}
            onRowClick={handleRowClick}
            autoHeight
            getRowId={r => r.project_id}
            hideFooter={true}
            getRowHeight={() => 'auto'}
            initialState={{
              sorting: {
                sortModel: [{field: 'name', sort: 'asc'}],
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
