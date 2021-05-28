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
import {DataGrid, GridColDef, GridCellParams} from '@material-ui/data-grid';
import {Typography} from '@material-ui/core';
import {Link as RouterLink} from 'react-router-dom';
import Link from '@material-ui/core/Link';

import {Observation, ProjectID} from '../../../datamodel';
import * as ROUTES from '../../../constants/routes';
import {listenObservationsList} from '../../../databaseAccess';

type ObservationsTableProps = {
  project_id: ProjectID;
  restrictRows: number;
  compact: boolean;
};

export default function ObservationsTable(props: ObservationsTableProps) {
  const {project_id, compact} = props;
  const [loading, setLoading] = useState(true);
  const pouchObservationList = {};
  const [rows, setRows] = useState<Array<Observation>>([]);
  const columns: GridColDef[] = [
    {
      field: 'observation_id',
      headerName: 'Obs ID',
      description: 'Observation ID',
      type: 'string',
      flex: 1,
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
    {field: 'created', headerName: 'Created', type: 'dateTime', flex: 1},
    {field: 'created_by', headerName: 'Created by', type: 'string', flex: 1},
    {field: 'updated', headerName: 'Updated', type: 'dateTime', flex: 1},
    {
      field: 'updated_by',
      headerName: 'Last updated by',
      type: 'string',
      flex: 1,
    },
  ];
  useEffect(() => {
    if (project_id === undefined) return; //dummy project
    const destroyListener = listenObservationsList(
      project_id,
      newObservationList => {
        setLoading(false);
        Object.assign(pouchObservationList, newObservationList);
        setRows(Object.values(pouchObservationList));
      }
    );
    return destroyListener; // destroyListener called when this component unmounts.
  }, []);

  return (
    <div>
      <Typography variant="overline">Recent Observations</Typography>
      <div style={{height: compact ? 250 : 400, width: '100%'}}>
        <DataGrid
          rows={rows}
          loading={loading}
          getRowId={r => r.observation_id}
          columns={columns}
          pageSize={5}
          checkboxSelection
        />
      </div>
    </div>
  );
}
ObservationsTable.defaultProps = {
  compact: false,
};
