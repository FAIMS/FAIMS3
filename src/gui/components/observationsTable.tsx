import React, {useContext, useEffect, useState} from 'react';
import {DataGrid, GridColDef} from '@material-ui/data-grid';

import {Observation, ObservationList} from '../../datamodel';
import {store} from '../../store';
import {CircularProgress, Typography} from '@material-ui/core';
type ObservationsTableProps = {
  project_id: string;
  restrictRows: number;
};
export default function ObservationsTable(props: ObservationsTableProps) {
  const globalState = useContext(store);
  const [loading, setLoading] = useState(true);
  const observation_list = globalState.state.observation_list[props.project_id];
  const [rows, setRows] = useState<Array<Observation>>([]);
  const columns: GridColDef[] = [
    {field: '_id', headerName: 'ID', type: 'string'},
    // {field: '_project_id', headerName: 'Project Name'},
    {field: 'created', headerName: 'Created', type: 'dateTime', width: 130},
    {field: 'created_by', headerName: 'Created by', type: 'string', width: 130},
    {field: 'updated', headerName: 'Updated', type: 'dateTime', width: 130},
    {field: 'updated_by', headerName: 'Updated by', type: 'string', width: 130},
  ];
  useEffect(() => {
    if (
      typeof observation_list !== 'undefined' &&
      Object.keys(observation_list).length > 0
    ) {
      setLoading(false);
      setRows(Object.values(observation_list));

    }
  }, [observation_list]);

  return (
    <div>
      <Typography variant="overline">Recent Observations </Typography>
      {loading ? (
        <CircularProgress size={12} thickness={4} />
      ) : (
        <div style={{height: 300, width: '100%'}}>
          <DataGrid
            rows={rows}
            getRowId={(r) => r._id}
            columns={columns}
            pageSize={5}
            checkboxSelection
          />
        </div>
      )}
    </div>
  );
}
