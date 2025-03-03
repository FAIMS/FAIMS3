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
 * Filename: draft_table.tsx
 * Description: This document is to get all draft record
 *   TODO need to check created draft route
 */

import {DraftMetadata, ProjectID, ProjectUIViewsets} from '@faims3/data-model';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import {Box, Grid, Link, Paper, Typography} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {DataGrid, GridCellParams, GridEventListener} from '@mui/x-data-grid';
import React from 'react';
import {useNavigate} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';
import {NotebookDraftDataGridToolbar} from './datagrid_toolbar';
import RecordDelete from './delete';

type DraftsRecordProps = {
  project_id: ProjectID;
  serverId: string;
  maxRows: number | null;
  rows: any;
  loading: boolean;
  viewsets?: ProjectUIViewsets | null;
  handleRefresh: () => void;
};

export function DraftsTable(props: DraftsRecordProps) {
  const {project_id, serverId, maxRows, rows, loading} = props;
  const theme = useTheme();
  const history = useNavigate();
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));

  const mobileView: boolean = not_xs;
  const defaultMaxRowsMobile = 10;

  // The entire row is clickable to the record
  const handleRowClick: GridEventListener<'rowClick'> = params => {
    history(
      ROUTES.getDraftRoute(
        project_id ?? 'dummy',
        params.row._id as DraftMetadata['_id'],
        params.row.existing! as DraftMetadata['existing'],
        params.row.type! as DraftMetadata['type'],
        params.row.record_id as DraftMetadata['record_id']
      )
    );
  };

  function getRowType(params: GridCellParams) {
    // The type (or Kind) is prettified and should be filterable as such.
    return props.viewsets !== null &&
      props.viewsets !== undefined &&
      params.row.type !== null &&
      params.row.type !== undefined &&
      props.viewsets[(params.row.type || '').toString()] !== undefined
      ? (props.viewsets[(params.row.type || '').toString()].label ??
          params.row.type)
      : params.row.type;
  }
  const columns: any[] = !mobileView
    ? [
        {
          field: 'draft_icon',
          headerName: '',
          type: 'string',
          width: 40,
          renderCell: () => <ArticleOutlinedIcon sx={{my: 2}} />,
          hide: false,
          sortable: false,
          filterable: false,
          disableColumnMenu: true,
        },
        {
          field: 'type',
          headerName: 'Kind',
          type: 'string',
          width: 200,
          valueGetter: getRowType,
        },
        {
          field: '_id',
          headerName: 'Draft ID',
          description: 'Draft ID',
          type: 'string',
          flex: 0.5,
          minWidth: 400,
          renderCell: (params: GridCellParams) => params.value,
        },
        {
          field: 'hrid',
          headerName: 'HRID/UUID',
          description: 'Human Readable Record ID',
          type: 'string',
          width: 300,
          renderCell: (params: GridCellParams) => (
            <Link underline={'none'} sx={{fontWeight: 'bold'}}>
              {params.row.hrid}
            </Link>
          ),
        },
        {field: 'updated', headerName: 'Updated', type: 'dateTime', width: 200},
        {field: 'created', headerName: 'Created', type: 'dateTime', width: 200},
        {
          field: 'delete',
          headerName: 'Actions',
          type: 'actions',
          renderCell: (params: GridCellParams) => {
            return (
              <RecordDelete
                project_id={project_id}
                serverId={serverId}
                record_id={params.row.record_id}
                revision_id={params.row.revision_id}
                draft_id={params.row._id}
                show_label={false}
                handleRefresh={props.handleRefresh}
              />
            );
          },
        },
      ]
    : [
        {
          field: '_id',
          headerName: 'Draft ID',
          description: 'Draft ID',
          type: 'string',
          flex: 1,
          renderCell: (params: GridCellParams) => (
            <Box sx={{width: '100%', my: 1}}>
              <Grid
                container
                direction="row"
                justifyContent="flex-start"
                alignItems="center"
                spacing={0}
              >
                <Grid item>
                  <ArticleOutlinedIcon
                    fontSize={'small'}
                    sx={{
                      verticalAlign: 'middle',
                      marginRight: '4px',
                      color: theme.palette.secondary.main,
                    }}
                  />
                </Grid>
                <Grid item>
                  <Typography>
                    Kind:{'  '}
                    {getRowType(params)}
                  </Typography>
                </Grid>
              </Grid>

              <Typography color="textSecondary">
                Draft ID: {params.row.value}
              </Typography>
              <Typography color="textSecondary">
                HRID/UUID: {params.row.hrid}
              </Typography>

              <Typography
                color="textSecondary"
                variant="subtitle2"
                gutterBottom
                component="div"
              >
                Updated: {(params.row.updated || '').toString()}
              </Typography>
            </Box>
          ),
        },
        {
          field: 'delete',
          headerName: 'Actions',
          type: 'actions',
          renderCell: (params: GridCellParams) => {
            return (
              <RecordDelete
                project_id={project_id}
                serverId={serverId}
                record_id={params.row.record_id}
                revision_id={params.row.revision_id}
                draft_id={params.row._id}
                show_label={false}
                handleRefresh={props.handleRefresh}
              />
            );
          },
        },
      ];

  return (
    <React.Fragment>
      <Box component={Paper} elevation={0}>
        <DataGrid
          key={'drafttable'}
          rows={rows}
          loading={loading}
          getRowId={r => r._id}
          columns={columns}
          autoHeight
          sx={{
            cursor: 'pointer',
            padding: '8px',
            backgroundColor: theme.palette.background.tabsBackground,
            borderRadius: '4px',
            boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
            mb: 2,
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: theme.palette.background.default,
              borderBottom: '1px solid #ccc',
            },
            '& .MuiDataGrid-columnSeparator': {
              visibility: 'visible',
              color: '#ccc',
            },
            '& .MuiDataGrid-cell': {
              borderBottom: '1px solid #eee',
            },
          }}
          getRowHeight={() => 'auto'}
          disableRowSelectionOnClick
          onRowClick={handleRowClick}
          components={{
            Toolbar: NotebookDraftDataGridToolbar,
          }}
          componentsProps={{
            filterPanel: {sx: {maxWidth: '96vw'}},
          }}
          initialState={{
            sorting: {
              sortModel: [{field: 'updated', sort: 'desc'}],
            },
            pagination: {
              paginationModel: {
                pageSize:
                  maxRows !== null
                    ? not_xs
                      ? maxRows
                      : defaultMaxRowsMobile
                    : not_xs
                      ? 25
                      : defaultMaxRowsMobile,
              },
            },
          }}
        />
      </Box>
    </React.Fragment>
  );
}
