import React from 'react';
import {Divider, Grid, Typography} from '@mui/material';
import {RecordProps} from './types';
import {
  DataGrid,
  GridCellParams,
  GridColDef,
  GridEventListener,
} from '@mui/x-data-grid';
import ArticleIcon from '@mui/icons-material/Article';
interface ParentRecordProps {
  parent_records: Array<RecordProps> | null;
}

export default function ParentRecords(props: ParentRecordProps) {
  const handleRowClick: GridEventListener<'rowClick'> = params => {
    // history.push(params.row.route);
    alert('go to row route');
  };
  const columns: GridColDef[] = [
    {
      field: 'article_icon',
      headerName: '',
      type: 'string',
      width: 30,
      renderCell: (params: GridCellParams) => <ArticleIcon sx={{my: 2}} />,
      hide: false,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
    },
    {
      field: 'type',
      headerName: 'Kind',
      flex: 0.2,
      minWidth: 100,
    },
    {
      field: 'hrid',
      headerName: 'HRID',
      flex: 0.2,
      minWidth: 70,
    },
    {
      field: 'lastUpdatedBy',
      headerName: 'Last Updated',
      flex: 0.2,
      minWidth: 300,
    },
    {field: 'route', hide: true, filterable: false},
    {
      field: 'record_id',
      headerName: 'UUID',
      description: 'UUID Record ID',
      type: 'string',
      hide: true,
    },
  ];
  return (
    <Grid
      container
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      spacing={1}
    >
      <Grid item xs={'auto'}>
        <Typography variant={'h6'}>Parent records</Typography>
      </Grid>
      <Grid item xs>
        <Divider />
      </Grid>

      {props.parent_records !== null && (
        <Grid item xs={12}>
          <DataGrid
            autoHeight
            initialState={{
              columns: {
                columnVisibilityModel: {
                  // Hide column route, the other columns will remain visible
                  route: false,
                  record_id: false
                },
              },
            }}
            getRowId={r => r.record_id}
            density={'compact'}
            rows={props.parent_records}
            columns={columns}
            pageSize={5}
            rowsPerPageOptions={[5]}
            disableSelectionOnClick
            onRowClick={handleRowClick}
            sx={{borderRadius: '0', cursor: 'pointer', border: 'none'}}
          />
        </Grid>
      )}
    </Grid>
  );
}
