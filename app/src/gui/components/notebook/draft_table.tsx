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
  const isMobile = !useMediaQuery(theme.breakpoints.up('sm'));

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
          field: 'hrid',
          headerName: 'Field ID',
          description: 'Human Readable Record ID',
          type: 'string',
          flex: 1,
          renderCell: (params: GridCellParams) => (
            <Typography fontWeight="bold">{params.row.hrid}</Typography>
          ),
        },
        // {
        //   field: 'created',
        //   headerName: 'Created',
        //   type: 'dateTime',
        //   width: 200,
        //   renderCell: (params: GridCellParams) => (
        //     <Typography>
        //       {params.row.created
        //         ? new Date(params.row.created).toLocaleString()
        //         : '-'}
        //     </Typography>
        //   ),
        // },
        // {
        //   field: 'created_by',
        //   headerName: 'Created By',
        //   type: 'string',
        //   width: 150,
        //   renderCell: (params: GridCellParams) => (
        //     <Typography>{params.row.created_by || '-'}</Typography>
        //   ),
        // },
        // {
        //   field: 'updated',
        //   headerName: 'Last Updated',
        //   type: 'dateTime',
        //   width: 200,
        //   renderCell: (params: GridCellParams) => (
        //     <Typography>
        //       {params.row.updated
        //         ? new Date(params.row.updated).toLocaleString()
        //         : '-'}
        //     </Typography>
        //   ),
        // },
        // {
        //   field: 'updated_by',
        //   headerName: 'Last Updated By',
        //   type: 'string',
        //   width: 150,
        //   renderCell: (params: GridCellParams) => (
        //     <Typography>{params.row.updated_by || '-'}</Typography>
        //   ),
        // },
        {
          field: 'delete',
          headerName: 'Actions',
          type: 'actions',
          renderCell: (params: GridCellParams) => (
            <RecordDelete
              project_id={project_id}
              serverId={serverId}
              record_id={params.row.record_id}
              revision_id={params.row.revision_id}
              draft_id={params.row._id}
              show_label={false}
              handleRefresh={props.handleRefresh}
            />
          ),
        },
      ]
    : [
        {
          field: 'summary',
          headerName: 'Details',
          type: 'string',
          flex: 1,
          renderCell: (params: GridCellParams) => (
            <Box sx={{width: '100%', my: 1}}>
              <Typography fontWeight="bold">
                Field ID: {params.row.hrid}
              </Typography>
              {/* <Typography color="textSecondary">
                Created: {params.row.created || '-'}
              </Typography>
              <Typography color="textSecondary">
                Created By: {params.row.created_by || '-'}
              </Typography>
              <Typography color="textSecondary">
                Last Updated: {params.row.updated || '-'}
              </Typography> */}
            </Box>
          ),
        },
        {
          field: 'delete',
          headerName: 'Actions',
          type: 'actions',
          renderCell: (params: GridCellParams) => (
            <RecordDelete
              project_id={project_id}
              serverId={serverId}
              record_id={params.row.record_id}
              revision_id={params.row.revision_id}
              draft_id={params.row._id}
              show_label={false}
              handleRefresh={props.handleRefresh}
            />
          ),
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
            backgroundColor: theme.palette.background.default,
            borderRadius: '4px',
            boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
            mb: 2,
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: theme.palette.grey[100],
              borderBottom: '2px solid #ccc',
            },
            '& .MuiDataGrid-columnSeparator': {
              visibility: 'visible',
              color: '#ccc',
            },
            '& .MuiDataGrid-cell': {
              padding: '16px 24px',
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
            sorting: {sortModel: [{field: 'created', sort: 'desc'}]},
            pagination: {
              paginationModel: {
                pageSize:
                  maxRows !== null
                    ? isMobile
                      ? defaultMaxRowsMobile
                      : maxRows
                    : 25,
              },
            },
          }}
        />
      </Box>
    </React.Fragment>
  );
}
