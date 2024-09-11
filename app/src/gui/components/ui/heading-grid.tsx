import {Stack} from '@mui/material';
import {DataGrid} from '@mui/x-data-grid';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '../../../buildconfig';
import {ProjectExtended} from '../../../types/project';

/**
 * Renders a grid with two sections: Active and Not Active.
 * Each section displays a DataGrid component with the provided data.
 *
 * @param pouchProjectList - The list of project information.
 * @param handleRowClick - The event listener for row click.
 * @param loading - A boolean indicating if the data is loading.
 * @param columns - The columns configuration for the DataGrid.
 * @param sortModel - The sorting configuration for the DataGrid.
 * @returns The rendered HeadingGrid component.
 */
export default function HeadingGrid({
  pouchProjectList,
  loading,
  columns,
}: {
  pouchProjectList: ProjectExtended[];
  loading: boolean;
  columns: any;
}) {
  return (
    <div style={{display: 'flex', flexDirection: 'column'}}>
      <div style={{padding: '6px', fontSize: '18px', fontWeight: 'bold'}}>
        Active
      </div>
      <DataGrid
        key={'active_notebook_list_datagrid'}
        rows={pouchProjectList.filter(r => r.activated)}
        loading={loading}
        columns={columns}
        autoHeight
        sx={{cursor: 'pointer'}}
        getRowId={r => r._id}
        hideFooter={true}
        getRowHeight={() => 'auto'}
        initialState={{
          pagination: {
            paginationModel: {
              pageSize: pouchProjectList.length,
            },
          },
        }}
        slots={{
          noRowsOverlay: () => (
            <Stack height="100%" alignItems="center" justifyContent="center">
              No {NOTEBOOK_NAME_CAPITALIZED}s have been activated yet.
            </Stack>
          ),
        }}
      />
      <div style={{height: '16px'}} />
      <div style={{padding: '6px', fontSize: '18px', fontWeight: 'bold'}}>
        Not active
      </div>
      <DataGrid
        key={'not_active_notebook_list_datagrid'}
        rows={pouchProjectList.filter(r => !r.activated)}
        loading={loading}
        columns={columns}
        autoHeight
        sx={{cursor: 'pointer'}}
        getRowId={r => r._id}
        hideFooter={true}
        getRowHeight={() => 'auto'}
        initialState={{
          pagination: {
            paginationModel: {
              pageSize: pouchProjectList.length,
            },
          },
        }}
        slots={{
          noRowsOverlay: () => (
            <Stack height="100%" alignItems="center" justifyContent="center">
              You don't have any unactivated {NOTEBOOK_NAME}s.
            </Stack>
          ),
        }}
      />
    </div>
  );
}
