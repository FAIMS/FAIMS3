import React, {useContext, useEffect, useState} from 'react';
// import { DataGrid,  } from '@material-ui/data-grid';
// import {ObservationList} from '../../datamodel';
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

  useEffect(() => {
    if (
      typeof observation_list !== 'undefined' &&
      Object.keys(observation_list).length > 0
    ) {
      setLoading(false);
    }
  }, [observation_list]);

  // if (Object.keys(observation_list).length > 0) {
  //   setLoading(false);
  // //   const rows = Object.keys(observation_list).map(key => {
  // //     return (Object.values(observation_list[key].data.values))
  // //   })
  // //   console.log(rows)
  // // } else {
  // //   setLoading(true)
  // //   // try to re-fetch observation list
  // //
  // }

  return (
    <div>
      <Typography variant="overline">Recent Observations </Typography>
      {loading ? (
        <CircularProgress size={12} thickness={4} />
      ) : (
        JSON.stringify(observation_list)
      )}

      {/*<DataGrid rows={rows} columns={columns} pageSize={5} checkboxSelection />*/}
    </div>
  );
}
