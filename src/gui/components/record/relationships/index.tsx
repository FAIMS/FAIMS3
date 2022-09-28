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
 * Filename: relationships/index.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {Box, Divider, Grid, Link, Typography} from '@mui/material';
import {
  DataGrid,
  GridCellParams,
  GridColDef,
  GridEventListener,
  GridToolbarContainer,
  GridToolbarFilterButton,
} from '@mui/x-data-grid';
import {RelationshipsComponentProps} from './types';
import LinkedRecords from './linked_records';
import ChildRecords from './child_records';
import ArticleIcon from '@mui/icons-material/Article';
import {v4 as uuidv4} from 'uuid';

export function DataGridToolbar() {
  return (
    <GridToolbarContainer>
      <Grid
        container
        spacing={2}
        justifyContent="space-between"
        alignItems="center"
      >
        <Grid item>
          <GridToolbarFilterButton />
        </Grid>
      </Grid>
    </GridToolbarContainer>
  );
}
export default function RelationshipsComponent(
  props: RelationshipsComponentProps
) {
  /**
   * Display the child records associated with a records in a MUI Data Grid.
   * Row click to go to child record
   * Data Grid is set to autoHeight (grid will size according to its content) up to 5 rows
   *
   *
   */
  // TODO these are defined... on the notebook?
  const relationship_types = [
    {link: 'is below', reciprocal: 'is above'},
    {link: 'is above', reciprocal: 'is below'},
    {link: 'is related to', reciprocal: 'is related to'},
  ];
  const data = [
    {
      section: 'core 1',
      field_id: uuidv4(),
      field_name: 'Field PH',

      record_id: uuidv4(),
      type: 'Water',
      hrid: 'Eh (99) TEST 499 V.3 44444-04-04T04:44',
      lastUpdatedBy: '10/12/2020 10:53pm by Joe Blogs',
      link_type: 'has child',
    },
    {
      section: 'core 1',
      field_id: uuidv4(),
      field_name: 'Field PH',

      record_id: uuidv4(),
      hrid: 'Mundi-V3.4',
      type: 'Water',
      lastUpdatedBy: '10/12/2020 11:09am by John Smith',
      route: 'go to record 2!',
      link_type: 'has child',
    },
    {
      section: 'core 2',
      field_id: uuidv4(),
      field_name: 'Field PH',

      record_id: uuidv4(),
      hrid: 'Mundi-V3.4',
      type: 'Water',
      lastUpdatedBy: '10/12/2020 11:09am by John Smith',
      route: 'go to record 2!',
      link_type: 'has child',
    },
    {
      section: 'core 2',
      field_id: uuidv4(),
      field_name: 'Field EH',

      record_id: uuidv4(),
      hrid: 'Mundi-V3.4',
      type: 'Water',
      lastUpdatedBy: '10/12/2020 11:09am by John Smith',
      route: 'go to record 2!',
      link_type: 'has child',
    },
    {
      section: 'core 2',
      field_id: uuidv4(),
      field_name: 'Field EH',

      record_id: uuidv4(),
      hrid: 'Mundi-V3.4',
      type: 'Water',
      lastUpdatedBy: '10/12/2020 11:09am by John Smith',
      route: 'go to record 2!',
      link_type: 'is above',
    },
    {
      section: 'core 2',
      field_id: uuidv4(),
      field_name: 'Field EH',

      record_id: uuidv4(),
      hrid: 'Mundi-V3.4',
      type: 'Water',
      lastUpdatedBy: '10/12/2020 11:09am by John Smith',
      route: 'go to record 2!',
      link_type: 'is next to',
    },
    {
      section: 'core 1',
      field_id: uuidv4(),
      field_name: 'Field EH',

      record_id: uuidv4(),
      hrid: 'Mundi-V3.4',
      type: 'Water',
      lastUpdatedBy: '10/12/2020 11:09am by John Smith',
      route: 'go to record 2!',
      link_type: 'is related to',
    },
  ];
  const columns: GridColDef[] = [
    {
      field: 'section',
      headerName: 'Section',
      type: 'string',
      renderCell: (params: GridCellParams) => (
        <Typography variant={'h6'} sx={{textTransform: 'capitalise'}}>
          {params.value}
        </Typography>
      ),
      minWidth: 200,
    },
    {
      field: 'field_name',
      headerName: 'Field',
      minWidth: 200,
    },
    {field: 'link_type', headerName: 'relationship', minWidth: 200},
    {
      field: 'record_id',
      headerName: 'UUID',
      description: 'UUID Record ID',
      type: 'string',
      hide: true,
    },
    {
      field: 'type',
      headerName: 'Kind',
      minWidth: 200,
    },
    // {
    //     field: 'article_icon',
    //     headerName: '',
    //     type: 'string',
    //     width: 30,
    //     renderCell: (params: GridCellParams) => <ArticleIcon sx={{my: 2}} />,
    //     hide: false,
    //     sortable: false,
    //     filterable: false,
    //     disableColumnMenu: true,
    // },
    {
      field: 'hrid',
      headerName: 'HRID',
      minWidth: 300,
      renderCell: (params: GridCellParams) => (
        <Link underline={'none'} sx={{fontWeight: 'bold'}}>
          {params.value}
        </Link>
      ),
    },
    {
      field: 'lastUpdatedBy',
      headerName: 'Last Updated',
      minWidth: 300,
    },
    {field: 'route', hide: true, filterable: false},
  ];
  return (
    <Box mb={2}>
      <Grid
        container
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={1}
      >
        <Grid item xs={'auto'}>
          <Typography variant={'h6'}>Parent record </Typography>
        </Grid>
        <Grid item xs>
          <Divider />
        </Grid>
      </Grid>
      <Typography variant={'body2'} gutterBottom>
        <Link underline={'none'} sx={{fontWeight: 'bold'}}>
          {uuidv4()}
        </Link>
      </Typography>

      <Grid
        container
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={1}
      >
        <Grid item xs={'auto'}>
          <Typography variant={'h6'}>Linked records</Typography>
        </Grid>
        <Grid item xs>
          <Divider />
        </Grid>
      </Grid>
      {props.child_records !== null && (
        <DataGrid
          autoHeight
          initialState={{
            columns: {
              columnVisibilityModel: {
                // Hide column route, the other columns will remain visible
                route: false,
                record_id: false,
                field_id: false,
              },
            },
          }}
          getRowId={r => r.record_id}
          density={'compact'}
          rows={data}
          columns={columns}
          pageSize={10}
          rowsPerPageOptions={[5]}
          disableSelectionOnClick
          components={{
            Toolbar: DataGridToolbar,
          }}
          sx={{borderRadius: '0', cursor: 'pointer', border: 'none'}}
        />
      )}
      <ChildRecords child_records={props.child_records} />
      <LinkedRecords
        linked_records={props.linked_records}
        relationships={relationship_types}
      />
    </Box>
  );
}
