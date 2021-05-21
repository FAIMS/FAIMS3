import React, {useEffect, useState} from 'react';
import {DataGrid, GridColDef, GridCellParams} from '@material-ui/data-grid';
import {CircularProgress, Typography, Button} from '@material-ui/core';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import {Link as RouterLink} from 'react-router-dom';
import Link from '@material-ui/core/Link';

import {Observation, ObservationList} from '../../datamodel';
import * as ROUTES from '../../constants/routes';
import {getObservationList} from '../../databaseAccess';
import {EventStateTracker} from '../../sync/state';
import {ExistingActiveDoc} from '../../sync';

type ObservationsTableProps = {
  listing_id_project_id: string;
  restrictRows: number;
};

const pouchObservationsLists = new EventStateTracker<string, boolean>([
  {
    event_name: 'project_data_paused',
    key_getter: [1, '_id'], //active arg's id
    state_getter: true,
  },
]);

export default function ObservationsTable(props: ObservationsTableProps) {
  const {listing_id_project_id} = props;
  const [loading, setLoading] = useState(true);
  const pouchObservationList: ObservationList | Array<any> = [];
  console.log(pouchObservationList);
  // const observation_list = globalState.state.observation_list[props.project_id];
  const [rows, setRows] = useState<Array<Observation>>([]);
  const columns: GridColDef[] = [
    {
      field: '_id',
      headerName: 'Obs ID',
      description: 'Observation ID',
      type: 'string',
      flex: 1,
      renderCell: (params: GridCellParams) => (
        <Link
          component={RouterLink}
          to={ROUTES.getObservationRoute(
            listing_id_project_id,
            (params.getValue('_id') || '').toString()
          )}
        >
          {params.value}
        </Link>
      ),
    },
    {field: 'created', headerName: 'Created', type: 'dateTime', flex: 1},
    {field: 'created_by', headerName: 'Created by', type: 'string', flex: 1},
    {field: 'updated', headerName: 'Updated', type: 'dateTime', flex: 1},
    {field: 'updated_by', headerName: 'Updated by', type: 'string', flex: 1},
    {
      field: 'view',
      headerName: 'View',
      type: 'string',
      flex: 1,
      renderCell: (params: GridCellParams) => (
        <Button
          variant="outlined"
          component={RouterLink}
          to={ROUTES.getObservationRoute(
            listing_id_project_id,
            (params.getValue('_id') || '').toString()
          )}
        >
          <ChevronRightIcon />
        </Button>
      ),
      valueGetter: params => params.getValue('_id'),
    },
  ];
  useEffect(() => {
    const trigger = () => {
      setLoading(false);
      setRows(Object.values(getObservationList(listing_id_project_id)));
    };
    if (pouchObservationsLists.state.get(listing_id_project_id)) {
      trigger();
    }
    pouchObservationsLists.on_update(listing_id_project_id, trigger);
  }, []);

  return (
    <div>
      <Typography variant="overline">Recent Observations </Typography>
      {loading ? (
        <CircularProgress size={12} thickness={4} />
      ) : (
        <div style={{height: 300, width: '100%'}}>
          <DataGrid
            rows={rows}
            getRowId={r => r._id}
            columns={columns}
            pageSize={5}
            checkboxSelection
          />
        </div>
      )}
    </div>
  );
}
