import {Stack} from '@mui/material';
import {
  DataGrid,
  GridEventListener,
  GridPaginationModel,
} from '@mui/x-data-grid';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '../../../buildconfig';
import {ProjectExtended} from '../../../types/project';
import {useNavigate} from 'react-router';
import * as ROUTES from '../../../constants/routes';
import {useEffect, useState} from 'react';

/**
 * Renders a grid with two sections: Active and Not Active.
 * Each section displays a DataGrid component with the provided data.
 *
 * @param projects - The list of project information.
 * @param columns - The columns configuration for the grid.
 * @returns The rendered HeadingGrid component.
 */
export default function HeadingProjectGrid({
  projects,
  columns,
}: {
  projects: ProjectExtended[];
  columns: any;
}) {
  // pull out active/inactive surveys
  const activatedProjects = projects.filter(({activated}) => activated);
  const availableProjects = projects.filter(({activated}) => !activated);

  const history = useNavigate();

  const handleRowClick: GridEventListener<'rowClick'> = ({
    row: {activated, project_id},
  }) => {
    if (activated) history(`${ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE}${project_id}`);
  };

  // we need a state variable to track pagination model since we want to use a
  // controlled component style to force pagination to behave how we want
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 1,
    pageSize: projects.length,
  });

  // Update pagination settings when the projects changes
  useEffect(() => {
    setPaginationModel({page: 1, pageSize: projects.length});
  }, [projects]);

  return (
    <div style={{display: 'flex', flexDirection: 'column'}}>
      <div style={{padding: '6px', fontSize: '18px', fontWeight: 'bold'}}>
        Active
      </div>

      <DataGrid
        key={'notebook_list_datagrid_activated'}
        rows={activatedProjects}
        columns={columns}
        onRowClick={handleRowClick}
        autoHeight
        sx={{cursor: 'pointer'}}
        getRowId={({_id}) => _id}
        hideFooter={true}
        getRowHeight={() => 'auto'}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
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
        key={'notebook_list_datagrid_not_activated'}
        rows={availableProjects}
        columns={columns}
        autoHeight
        sx={{cursor: 'pointer'}}
        onRowClick={handleRowClick}
        getRowId={({_id}) => _id}
        getRowHeight={() => 'auto'}
        hideFooter
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
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
