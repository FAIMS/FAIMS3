/*
 * Copyright 2021 Macquarie University
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
 * Description: This duocument is to get all draft record
 *   TODO need to check created draft route
 */

import React, {useEffect, useState} from 'react';
import _ from 'lodash';
import {
  DataGrid,
  GridColDef,
  GridCellParams,
  GridToolbar,
} from '@material-ui/data-grid';
import {Typography} from '@material-ui/core';
import {Link as RouterLink} from 'react-router-dom';
import Link from '@material-ui/core/Link';
import {useTheme} from '@material-ui/core/styles';
import useMediaQuery from '@material-ui/core/useMediaQuery';

import {ProjectID} from '../../../datamodel/core';
import {DraftMetadata} from '../../../datamodel/drafts';
import * as ROUTES from '../../../constants/routes';
import {listenDrafts} from '../../../data_storage/listeners';
import {ProjectUIViewsets} from '../../../datamodel/typesystem';

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
  const defaultMaxRowsMobile = 10;

  // newrows.map((r:any)=>
  //   props.viewsets !== null &&
  //   props.viewsets !== undefined &&
  //   r.type !== null &&
  //   r.type !== undefined &&
  //   props.viewsets[r.type] !== undefined?r.type_label=props.viewsets[r.type].label ?? r.type:r.type)

  const columns: GridColDef[] = [
    {
      field: '_id',
      headerName: 'ID',
      description: 'Draft ID',
      type: 'string',
      width: not_xs ? 300 : 100,
      renderCell: (params: GridCellParams) => (
        <Link
          component={RouterLink}
          to={ROUTES.getDraftRoute(
            project_id ?? 'dummy',
            params.getValue('_id') as DraftMetadata['_id'],
            params.getValue('existing')! as DraftMetadata['existing'],
            params.getValue('type')! as DraftMetadata['type']
          )}
        >
          {params.value}
        </Link>
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
    {field: 'created', headerName: 'Created', type: 'dateTime', width: 200},
    {field: 'updated', headerName: 'Updated', type: 'dateTime', width: 200},
  ];
  return (
    <DataGrid
      key={'drafttable'}
      rows={rows}
      loading={loading}
      getRowId={r => r._id}
      columns={columns}
      autoHeight
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
    <div>
      <Typography variant="overline">New Draft</Typography>
      <div
        style={{
          width: '100%',
          marginBottom: not_xs ? '20px' : '40px',
        }}
      >
        <DraftRecord
          project_id={project_id}
          maxRows={maxRows}
          rows={rows}
          loading={loading}
          viewsets={props.viewsets}
          not_xs={not_xs}
        />
      </div>
    </div>
  );
}
DraftsTable.defaultProps = {
  maxRows: null,
};
