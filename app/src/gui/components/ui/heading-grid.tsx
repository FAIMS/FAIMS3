import {Stack} from '@mui/material';
import {DataGrid, GridEventListener} from '@mui/x-data-grid';
import {ProjectInformation} from 'faims3-datamodel/build/src/types';

export default function HeadingGrid({
  pouchProjectList,
  handleRowClick,
  loading,
  columns,
  sortModel,
}: {
  pouchProjectList: ProjectInformation[];
  handleRowClick: GridEventListener<'rowClick'>;
  loading: boolean;
  columns: any;
  sortModel: any;
}) {
  return (
    <div style={{display: 'flex', flexDirection: 'column'}}>
      <div style={{padding: '6px', fontSize: '18px', fontWeight: 'bold'}}>
        Active
      </div>
      <DataGrid
        key={'notebook_list_datagrid'}
        rows={pouchProjectList.filter(r => r.is_activated)}
        loading={loading}
        columns={columns}
        onRowClick={handleRowClick}
        autoHeight
        sx={{cursor: 'pointer'}}
        getRowId={r => r.project_id}
        hideFooter={true}
        getRowHeight={() => 'auto'}
        initialState={{
          sorting: {
            sortModel: [sortModel],
          },
          pagination: {
            paginationModel: {
              pageSize: pouchProjectList.length,
            },
          },
        }}
        slots={{
          noRowsOverlay: () => (
            <Stack height="100%" alignItems="center" justifyContent="center">
              No Notebooks have been activated yet.
            </Stack>
          ),
        }}
      />
      <div style={{height: '16px'}} />
      <div style={{padding: '6px', fontSize: '18px', fontWeight: 'bold'}}>
        Not active
      </div>
      <DataGrid
        key={'notebook_list_datagrid'}
        rows={pouchProjectList.filter(r => !r.is_activated)}
        loading={loading}
        columns={columns}
        autoHeight
        sx={{cursor: 'pointer'}}
        getRowId={r => r.project_id}
        hideFooter={true}
        getRowHeight={() => 'auto'}
        initialState={{
          sorting: {
            sortModel: [sortModel],
          },
          pagination: {
            paginationModel: {
              pageSize: pouchProjectList.length,
            },
          },
        }}
        slots={{
          noRowsOverlay: () => (
            <Stack height="100%" alignItems="center" justifyContent="center">
              You don't have any unactivated notebooks.
            </Stack>
          ),
        }}
      />
    </div>
  );
}
