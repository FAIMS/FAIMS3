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

import {Observation, ObservationList, ProjectID} from '../../../datamodel';
import * as ROUTES from '../../../constants/routes';
import {observationListTracker} from '../../../databaseAccess';
import {useDBTracker} from '../../pouchHook';
import {useTheme} from '@material-ui/core/styles';
import useMediaQuery from '@material-ui/core/useMediaQuery';

type ObservationsTableProps = {
  project_id: ProjectID;
  maxRows: number | null;
};

export default function ObservationsTable(props: ObservationsTableProps) {
  const {project_id, maxRows} = props;
  const theme = useTheme();
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));
  const defaultMaxRowsMobile = 10;

  const rows = useDBTracker(observationListTracker, [project_id] as [string]);

  const columns: GridColDef[] = [
    {
      field: 'observation_id',
      headerName: 'Obs ID',
      description: 'Observation ID',
      type: 'string',
      width: not_xs ? 300 : 100,
      renderCell: (params: GridCellParams) => (
        <Link
          component={RouterLink}
          to={ROUTES.getObservationRoute(
            project_id || 'dummy',
            (params.getValue('observation_id') || '').toString()
          )}
        >
          {params.value}
        </Link>
      ),
    },
    //{field: 'created', headerName: 'Created', type: 'dateTime', width: 200},
    //{field: 'created_by', headerName: 'Created by', type: 'string', width: 200},
    {field: 'updated', headerName: 'Updated', type: 'dateTime', width: 200},
    {
      field: 'updated_by',
      headerName: 'Last updated by',
      type: 'string',
      width: 200,
    },
  ];

  return (
    <div>
      <Typography variant="overline">Recent Observations</Typography>
      <div
        style={{
          width: '100%',
          marginBottom: not_xs ? '20px' : '40px',
        }}
      >
        <DataGrid
          rows={Object.values(rows.value || {})}
          loading={rows.loading !== undefined}
          getRowId={r => r.observation_id}
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
ObservationsTable.defaultProps = {
  maxRows: null,
};
