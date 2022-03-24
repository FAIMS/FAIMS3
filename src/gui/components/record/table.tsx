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
 * Filename: table.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {Link as RouterLink} from 'react-router-dom';

import {
  DataGrid,
  GridColDef,
  GridCellParams,
  GridToolbar,
} from '@mui/x-data-grid';
import {Typography} from '@mui/material';
import Link from '@mui/material/Link';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import * as ROUTES from '../../../constants/routes';
import {ProjectID} from '../../../datamodel/core';
import {ProjectUIViewsets} from '../../../datamodel/typesystem';
import {RecordMetadata} from '../../../datamodel/ui';
import {getMetadataForAllRecords} from '../../../data_storage/index';
import {getAllRecordsWithRegex} from '../../../data_storage/queries';
import {useEventedPromise} from '../../pouchHook';
import {listenDataDB} from '../../../sync';
import {DEBUG_APP} from '../../../buildconfig';

type RecordsTableProps = {
  project_id: ProjectID;
  maxRows: number | null;
  rows: RecordMetadata[];
  loading: boolean;
  viewsets?: ProjectUIViewsets | null;
};

type RecordsBrowseTableProps = {
  project_id: ProjectID;
  maxRows: number | null;
  filter_deleted: boolean;
  viewsets?: ProjectUIViewsets | null;
};

type RecordsSearchTableProps = {
  project_id: ProjectID;
  maxRows: number | null;
  query: string;
  viewsets?: ProjectUIViewsets | null;
};

function RecordsTable(props: RecordsTableProps) {
  const {project_id, maxRows, rows, loading} = props;
  const theme = useTheme();
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));
  const defaultMaxRowsMobile = 10;
  // const newrows:any=[];
  // rows.map((r:any,index:number)=>
  //   props.viewsets !== null &&
  //   props.viewsets !== undefined &&
  //   r.type !== null &&
  //   r.type !== undefined &&
  //   props.viewsets[r.type] !== undefined? newrows[index]={...r,type_label:props.viewsets[r.type].label?? r.type }:newrows[index]={...r})

  const columns: GridColDef[] = not_xs
    ? [
        {
          field: 'hrid',
          headerName: 'HRID/UUID',
          description: 'Human Readable Record ID',
          type: 'string',
          width: not_xs ? 300 : 100,
          renderCell: (params: GridCellParams) => (
            <Link
              component={RouterLink}
              to={ROUTES.getRecordRoute(
                project_id || 'dummy',
                (params.row.record_id || '').toString(),
                (params.row.revision_id || '').toString()
              )}
            >
              {params.value}
            </Link>
          ),
        },
        // {field: 'hrid', headerName: 'HRID/UUID', type: 'string', width: 200},
        {field: 'created', headerName: 'Created', type: 'dateTime', width: 200},
        {
          field: 'created_by',
          headerName: 'Created by',
          type: 'string',
          width: 200,
        },
        {field: 'updated', headerName: 'Updated', type: 'dateTime', width: 200},
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
          field: 'updated_by',
          headerName: 'Last updated by',
          type: 'string',
          width: 200,
        },
        {
          field: 'conflicts',
          headerName: 'Conflicts',
          type: 'boolean',
          width: 200,
        },
        {
          field: 'record_id',
          headerName: 'UUID',
          description: 'UUID Record ID',
          type: 'string',
          width: not_xs ? 300 : 100,
          renderCell: (params: GridCellParams) => (
            <Link
              component={RouterLink}
              to={ROUTES.getRecordRoute(
                project_id || 'dummy',
                (params.row.record_id || '').toString(),
                (params.row.revision_id || '').toString()
              )}
            >
              {params.row.hrid}
            </Link>
          ),
          hide: true,
        },
      ]
    : [
        {
          field: 'hrid',
          headerName: 'Record',
          description: 'Human Readable Record ID',
          type: 'string',
          width: 300,
          renderCell: (params: GridCellParams) => (
            <div>
              <Typography>
                {' '}
                <Link
                  component={RouterLink}
                  to={ROUTES.getRecordRoute(
                    project_id || 'dummy',
                    (params.row.record_id || '').toString(),
                    (params.row.revision_id || '').toString()
                  )}
                >
                  {params.value}
                </Link>
              </Typography>
              <Typography color="textSecondary">
                {' '}
                Kind:{' '}
                {props.viewsets !== null &&
                props.viewsets !== undefined &&
                params.row.type !== null &&
                params.row.type !== undefined &&
                props.viewsets[(params.row.type || '').toString()] !== undefined
                  ? props.viewsets[(params.row.type || '').toString()].label ??
                    params.row.type
                  : params.row.type}
              </Typography>
              <Typography
                color="textSecondary"
                variant="subtitle2"
                gutterBottom
                component="div"
              >
                Created: {(params.row.created || '').toString()}
              </Typography>
              <Typography
                color="textSecondary"
                variant="subtitle2"
                gutterBottom
                component="div"
              >
                Created By {params.row.created_by}
              </Typography>
              <Typography
                color="textSecondary"
                variant="subtitle2"
                gutterBottom
                component="div"
              >
                Updated By {params.row.updated_by}
              </Typography>

              {params.row.conflicts === true && (
                <Typography
                  color="error"
                  variant="subtitle2"
                  gutterBottom
                  component="div"
                >
                  Conflict
                </Typography>
              )}

              {/* <Typography>
                <br />{' '}
              </Typography> */}
            </div>
          ),
        },
        {field: 'updated', headerName: 'Updated', type: 'dateTime', width: 200},
      ];

  return (
    <div>
      <Typography
        variant="overline"
        style={not_xs ? {} : {paddingLeft: '10px'}}
      >
        Recent Record
      </Typography>
      <div
        style={{
          width: '100%',
          marginBottom: not_xs ? '20px' : '40px',
        }}
      >
        <DataGrid
          rows={rows}
          loading={loading}
          getRowId={r => r.record_id}
          columns={columns}
          autoHeight
          rowHeight={not_xs ? 52 : 130}
          pageSize={
            maxRows !== null
              ? not_xs
                ? maxRows
                : defaultMaxRowsMobile
              : not_xs
              ? 25
              : defaultMaxRowsMobile
          }
          checkboxSelection
          density={not_xs ? 'standard' : 'comfortable'}
          components={{
            Toolbar: GridToolbar,
          }}
          sortModel={[{field: 'updated', sort: 'desc'}]}
        />
      </div>
    </div>
  );
}

export function RecordsBrowseTable(props: RecordsBrowseTableProps) {
  const {project_id, maxRows, filter_deleted} = props;

  if (DEBUG_APP) {
    console.debug('Filter deleted:', filter_deleted);
  }
  const rows = useEventedPromise(
    async (project_id: ProjectID) => {
      if (DEBUG_APP) {
        console.log('RecordsBrowseTable updating', project_id);
      }
      const metadata = await getMetadataForAllRecords(
        project_id,
        filter_deleted
      );
      return metadata;
    },
    listenDataDB.bind(null, project_id, {since: 'now', live: true}),
    false,
    [project_id],
    project_id
  );

  if (DEBUG_APP) {
    console.debug('New records:', rows);
  }
  return (
    <RecordsTable
      project_id={project_id}
      maxRows={maxRows}
      rows={rows.value ?? []}
      loading={rows.loading !== undefined}
      viewsets={props.viewsets}
    />
  );
}
RecordsBrowseTable.defaultProps = {
  maxRows: null,
  filter_deleted: true,
};

export function RecordsSearchTable(props: RecordsSearchTableProps) {
  const {project_id, maxRows, query} = props;

  const rows = useEventedPromise(
    async (project_id: ProjectID, query: string) =>
      Object.values(await getAllRecordsWithRegex(project_id, query)),
    listenDataDB.bind(null, project_id, {since: 'now', live: true}),
    false,
    [project_id, query],
    project_id,
    query
  );

  if (DEBUG_APP) {
    console.debug('New records:', rows);
  }
  return (
    <RecordsTable
      project_id={project_id}
      maxRows={maxRows}
      rows={rows.value ?? []}
      loading={rows.loading !== undefined}
      viewsets={props.viewsets}
    />
  );
}
RecordsBrowseTable.defaultProps = {
  maxRows: null,
};
