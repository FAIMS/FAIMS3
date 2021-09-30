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
 * Filename: table.tsx
 * Description:
 *   TODO
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
import {RecordMetadata} from '../../../datamodel/ui';
import * as ROUTES from '../../../constants/routes';
import {listenRecordsList} from '../../../data_storage/listeners';

type DraftsTableProps = {
  project_id: ProjectID;
  maxRows: number | null;
};

export default function DraftsTable(props: DraftsTableProps) {
  const {project_id, maxRows} = props;
  const [loading, setLoading] = useState(true);
  const theme = useTheme();
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));
  const defaultMaxRowsMobile = 10;
  const [rows, setRows] = useState<Array<RecordMetadata>>([]);
  const columns: GridColDef[] = [
    {
      field: 'record_id',
      headerName: 'Obs ID',
      description: 'Record ID',
      type: 'string',
      width: not_xs ? 300 : 100,
      renderCell: (params: GridCellParams) => (
        <Link
          component={RouterLink}
          to={ROUTES.getRecordRoute(
            project_id || 'dummy',
            (params.getValue('record_id') || '').toString(),
            (params.getValue('revision_id') || '').toString()
          )}
        >
          {params.value}
        </Link>
      ),
    },
    {field: 'created', headerName: 'Created', type: 'dateTime', width: 200},
    {field: 'created_by', headerName: 'Created by', type: 'string', width: 200},
    {field: 'updated', headerName: 'Updated', type: 'dateTime', width: 200},
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
  ];

  useEffect(() => {
    //  Dependency is only the project_id, ie., register one callback for this component
    // on load - if the record list is updated, the callback should be fired
    if (project_id === undefined) return; //dummy project
    const destroyListener = listenRecordsList(
      project_id,
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
      <Typography variant="overline">Recent Records</Typography>
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
DraftsTable.defaultProps = {
  maxRows: null,
};
