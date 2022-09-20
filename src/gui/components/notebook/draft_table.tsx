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

import React, {useEffect, useState} from 'react';
import _ from 'lodash';
import {
  DataGrid,
  GridColDef,
  GridCellParams,
  GridEventListener,
} from '@mui/x-data-grid';
import {Typography, Box, Paper, Grid} from '@mui/material';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import {useHistory} from 'react-router-dom';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import {ProjectID} from '../../../datamodel/core';
import {DraftMetadata} from '../../../datamodel/drafts';
import * as ROUTES from '../../../constants/routes';
import {listenDrafts} from '../../../drafts';
import {ProjectUIViewsets} from '../../../datamodel/typesystem';
import {NotebookDraftDataGridToolbar} from './datagrid_toolbar';

type DraftsTableProps = {
  project_id: ProjectID;
  maxRows: number | null;
  viewsets?: ProjectUIViewsets | null;
};

type DraftsRecordProps = {
  project_id: ProjectID;
  maxRows: number | null;
  rows: any;
  loading: boolean;
  viewsets?: ProjectUIViewsets | null;
  not_xs: boolean;
};

function DraftRecord(props: DraftsRecordProps) {
  const {project_id, maxRows, rows, loading, not_xs} = props;
  // const newrows: any = rows;
  const defaultMaxRowsMobile = 25;
  const history = useHistory();
  const handleRowClick: GridEventListener<'rowClick'> = params => {
    history.push(
      ROUTES.getDraftRoute(
        project_id ?? 'dummy',
        params.row._id as DraftMetadata['_id'],
        params.row.existing! as DraftMetadata['existing'],
        params.row.type! as DraftMetadata['type']
      )
    );
  };
  const columns: GridColDef[] = not_xs
    ? [
        {
          field: '_id',
          headerName: 'UUID',
          description: 'Draft ID',
          type: 'string',
          flex: 0.5,
          minWidth: 400,
          renderCell: (params: GridCellParams) => (
            <Grid
              container
              direction="row"
              justifyContent="flex-start"
              alignItems="center"
              spacing={0}
            >
              <Grid item>
                <ArticleOutlinedIcon
                  sx={{verticalAlign: 'middle', marginRight: '4px', my: 2}}
                />
              </Grid>
              <Grid item>{params.value}</Grid>
            </Grid>
          ),
        },
        {
          field: 'type',
          headerName: 'Kind',
          type: 'string',
          width: 200,
          renderCell: (params: GridCellParams) => (
            <>
              {props.viewsets !== null &&
              props.viewsets !== undefined &&
              params.value !== null &&
              params.value !== undefined &&
              props.viewsets[params.value.toString()] !== undefined
                ? props.viewsets[params.value.toString()].label ?? params.value
                : params.value}
            </>
          ),
        },
        {
          field: 'hrid',
          headerName: 'ID',
          description: 'Draft ID',
          type: 'string',
          width: 300,
          renderCell: (params: GridCellParams) => <span>{params.value}</span>,
        },
        {field: 'updated', headerName: 'Updated', type: 'dateTime', width: 200},
        {field: 'created', headerName: 'Created', type: 'dateTime', width: 200},
      ]
    : [
        {
          field: '_id',
          headerName: 'Draft ID',
          description: 'Draft ID',
          type: 'string',
          flex:1,
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
                    sx={{verticalAlign: 'middle', marginRight: '4px'}}
                  />
                </Grid>
                <Grid item>
                  <Typography>
                    Kind:{'  '}
                    {props.viewsets !== null &&
                    props.viewsets !== undefined &&
                    params.row.type !== null &&
                    params.row.type !== undefined &&
                    props.viewsets[(params.row.type || '').toString()] !==
                      undefined
                      ? props.viewsets[(params.row.type || '').toString()]
                          .label ?? params.row.type
                      : params.row.type}
                  </Typography>
                </Grid>
              </Grid>

              <Typography color="textSecondary">
                Draft ID: {params.value}
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
      ];

  return (
    <DataGrid
      key={'drafttable'}
      rows={rows}
      loading={loading}
      getRowId={r => r._id}
      columns={columns}
      autoHeight
      sx={{cursor: 'pointer'}}
      getRowHeight={() => 'auto'}
      disableSelectionOnClick
      onRowClick={handleRowClick}
      components={{
        Toolbar: NotebookDraftDataGridToolbar,
      }}
      initialState={{
        sorting: {
          sortModel: [{field: 'updated', sort: 'desc'}],
        },
        pagination: {
          pageSize:
            maxRows !== null
              ? not_xs
                ? maxRows
                : defaultMaxRowsMobile
              : not_xs
              ? 25
              : defaultMaxRowsMobile,
        },
      }}
    />
  );
}
export default function DraftsTable(props: DraftsTableProps) {
  const {project_id, maxRows} = props;
  const [loading, setLoading] = useState(true);
  const theme = useTheme();
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));

  const [rows, setRows] = useState<Array<DraftMetadata>>([]);

  useEffect(() => {
    //  Dependency is only the project_id, ie., register one callback for this component
    // on load - if the record list is updated, the callback should be fired
    if (project_id === undefined) return; //dummy project
    const destroyListener = listenDrafts(
      project_id,
      'all',
      newPouchRecordList => {
        setLoading(false);
        if (!_.isEqual(Object.values(newPouchRecordList), rows)) {
          setRows(Object.values(newPouchRecordList));
        }
      }
    );

    return destroyListener; // destroyListener called when this component unmounts.
  }, [project_id, rows]);

  return (
    <Box component={Paper} elevation={0}>
      <DraftRecord
        project_id={project_id}
        maxRows={maxRows}
        rows={rows}
        loading={loading}
        viewsets={props.viewsets}
        not_xs={not_xs}
      />
    </Box>
  );
}
DraftsTable.defaultProps = {
  maxRows: null,
};
