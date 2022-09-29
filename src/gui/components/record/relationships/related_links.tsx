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
 * Filename: relationships/index.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {NavLink} from 'react-router-dom';
import {Alert, Box, Divider, Grid, Link, Typography} from '@mui/material';
import {
  DataGrid,
  GridActionsCellItem,
  GridRowId,
  GridRowParams,
  GridCellParams,
  GridColDef,
  GridColumns,
  GridToolbarContainer,
  GridToolbarFilterButton,
} from '@mui/x-data-grid';
import {RelatedLinksComponentProps} from './types';
import ArticleIcon from '@mui/icons-material/Article';
import DeleteIcon from '@mui/icons-material/Delete';
import LinkIcon from '@mui/icons-material/Link';

export function DataGridToolbar() {
  return (
    <GridToolbarContainer>
      <Grid
        container
        spacing={2}
        justifyContent="space-between"
        alignItems="center"
      >
        <Grid item>
          <GridToolbarFilterButton />
        </Grid>
      </Grid>
    </GridToolbarContainer>
  );
}

export default function RelatedLinksComponent(
  props: RelatedLinksComponentProps
) {
  /**
   * Display the related records linked to this record.
   * Allow deletion of the link.
   *
   *
   */
  const deleteLink = React.useCallback(
    (id: GridRowId) => () => {
      alert('delete link to ' + id);
    },
    []
  );
  const columns: GridColumns = [
    {
      field: 'section',
      headerName: 'Section',
      type: 'string',
      renderCell: (params: GridCellParams) => (
        <Typography variant={'h6'} sx={{textTransform: 'capitalise'}}>
          {params.value}
        </Typography>
      ),
      minWidth: 100,
    },
    {
      field: 'field_name',
      headerName: 'Field',
      minWidth: 100,
    },
    {field: 'link_type', headerName: 'relationship', minWidth: 100},
    {
      field: 'record_id',
      headerName: 'UUID',
      description: 'UUID Record ID',
      type: 'string',
      hide: true,
    },
    {
      field: 'type',
      headerName: 'Kind',
      minWidth: 100,
    },
    {
      field: 'hrid',
      headerName: 'HRID',
      minWidth: 300,
      renderCell: (params: GridCellParams) => (
        <Link underline={'none'} sx={{fontWeight: 'bold'}}>
          <Grid container direction="row" alignItems="center" spacing={'4px'}>
            <ArticleIcon fontSize={'inherit'} /> {params.value}
          </Grid>
        </Link>
      ),
    },
    {
      field: 'lastUpdatedBy',
      headerName: 'Last Updated',
      minWidth: 300,
    },
    {field: 'link_id', hide: true, filterable: false},
    {field: 'route', hide: true, filterable: false},
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      getActions: (params: GridRowParams) => [
        <GridActionsCellItem
          icon={<DeleteIcon color={'error'} />}
          onClick={deleteLink(params.row.link_id)}
          label="Delete link"
          showInMenu
        />,
      ],
    },
  ];
  return (
    <Box mb={2}>
      {props.show_title ? (
        <Grid
          container
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          spacing={1}
        >
          <Grid item xs={'auto'}>
            <Grid
              container
              spacing={1}
              justifyContent={'center'}
              alignItems={'flex-start'}
            >
              <Grid item>
                <LinkIcon fontSize={'inherit'} sx={{mt: '3px'}} />
              </Grid>
              <Grid item>
                <Typography variant={'h6'}>Related</Typography>
              </Grid>
            </Grid>
          </Grid>
          <Grid item xs>
            <Divider />
          </Grid>
        </Grid>
      ) : (
        ''
      )}
      {props.related_links !== null && (
        <DataGrid
          autoHeight
          initialState={{
            columns: {
              columnVisibilityModel: {
                route: false,
                record_id: false,
                field_id: false,
                link_id: false,
                section: props.show_section,
                field_name: props.show_field,
                link_type: props.show_link_type,
              },
            },
          }}
          getRowId={r => r.record_id}
          density={'compact'}
          rows={props.related_links}
          columns={columns}
          pageSize={10}
          rowsPerPageOptions={[5]}
          disableSelectionOnClick
          components={{
            Toolbar: DataGridToolbar,
          }}
          sx={{cursor: 'pointer', border: 'none'}}
        />
      )}
    </Box>
  );
}
