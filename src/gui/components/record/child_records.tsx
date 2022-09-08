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
 * Filename: child_records.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {Box, Typography} from '@mui/material';
import {useHistory} from 'react-router-dom';
import {DataGrid, GridColDef, GridEventListener} from '@mui/x-data-grid';

const columns: GridColDef[] = [
  {field: 'id', headerName: 'ID', flex: 0.2, minWidth: 100},
  {
    field: 'recordName',
    headerName: 'Record name',
    flex: 0.5,
    minWidth: 100,
  },
  {
    field: 'lastUpdatedBy',
    headerName: 'Last Updated',
    flex: 0.3,
    minWidth: 300,
  },
  {field: 'recordRoute', hide: true},
];

const rows = [
  {
    id: 1,
    recordName: 'Snow',
    lastUpdatedBy: '10/12/2020 10:53pm by Joe Blogs',
    recordRoute: 'go to record 1!',
  },
  {
    id: 2,
    recordName: 'Snow',
    lastUpdatedBy: '10/12/2020 11:09am by John Smith',
    recordRoute: 'go to record 2!',
  },
  {
    id: 3,
    recordName: 'Snow',
    lastUpdatedBy: '10/12/2020 11:09am by John Smith',
    recordRoute: 'go to record 2!',
  },
  {
    id: 4,
    recordName: 'Snow',
    lastUpdatedBy: '10/12/2020 11:09am by John Smith',
    recordRoute: 'go to record 2!',
  },
  {
    id: 5,
    recordName: 'Snow',
    lastUpdatedBy: '10/12/2020 11:09am by John Smith',
    recordRoute: 'go to record 2!',
  },
  {
    id: 6,
    recordName: 'Snow',
    lastUpdatedBy: '10/12/2020 11:09am by John Smith',
    recordRoute: 'go to record 2!',
  },
  {
    id: 7,
    recordName: 'Snow',
    lastUpdatedBy: '10/12/2020 11:09am by John Smith',
    recordRoute: 'go to record 2!',
  },
];
interface ChildRecordViewProps {}
export default function ChildRecordView(props: ChildRecordViewProps) {
  /**
   * Display the child records associated with a records in a MUI Data Grid.
   * Row click to go to child record
   * Data Grid is set to autoHeight (grid will size according to its content) up to
   * Notes for Kate -
   *  - The entire row should link to the child record (i.e., when a user clicks the row,
   *  they should move to that record). I've added the logic here, it needs wiring up to the data
   *  - Last updated by shows date time and author
   *
   */
  const location = useHistory();
  const handleRowClick: GridEventListener<'rowClick'> = params => {
    alert(params.row.recordRoute);
    // location.push(params.row.recordRoute);
  };

  return (
    <Box style={{border: 'solid 1px red'}} mb={2}>
      <Typography variant={'overline'}>Child Records</Typography>
      <Box sx={{width: '100%'}}>
        <DataGrid
            autoHeight
            density={'compact'}
          rows={rows}
          columns={columns}
          pageSize={5}
          rowsPerPageOptions={[5]}
            disableSelectionOnClick
          onRowClick={handleRowClick}
            sx={{cursor: 'pointer'}}
        />
      </Box>
    </Box>
  );
}
