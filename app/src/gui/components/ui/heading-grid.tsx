import {Stack} from '@mui/material';
import {DataGrid, GridEventListener} from '@mui/x-data-grid';
import {ProjectInformation} from 'faims3-datamodel/build/src/types';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '../../../buildconfig';

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
              You don't have any unactivated {NOTEBOOK_NAME}s.
            </Stack>
          ),
        }}
      />
    </div>
  );
}
