import {Stack} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridEventListener,
  GridPaginationModel,
} from '@mui/x-data-grid';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '../../../buildconfig';
import {useNavigate} from 'react-router';
import * as ROUTES from '../../../constants/routes';
import {useEffect, useState} from 'react';
import {theme} from '../../themes';
import {ACTIVATED_LABEL, NOT_ACTIVATED_LABEL} from '../workspace/notebooks';
import {Project} from '../../../context/slices/projectSlice';

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
  activatedColumns,
  notActivatedColumns,
  serverId,
}: {
  projects: Project[];
  activatedColumns: GridColDef<Project>[];
  notActivatedColumns: GridColDef<Project>[];
  serverId: string;
}) {
  // pull out active/inactive surveys
  const activatedProjects = projects.filter(({isActivated}) => isActivated);
  const availableProjects = projects.filter(({isActivated}) => !isActivated);

  const history = useNavigate();

  const handleRowClick: GridEventListener<'rowClick'> = ({
    row: {isActivated, project_id},
  }) => {
    if (isActivated)
      history(`${ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE}${serverId}/${project_id}`);
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
        {ACTIVATED_LABEL}
      </div>

      <DataGrid
        key={'notebook_list_datagrid_activated'}
        rows={activatedProjects}
        columns={activatedColumns}
        onRowClick={handleRowClick}
        rowHeight={75}
        autoHeight
        sx={{
          cursor: 'pointer',
          padding: '8px',
          backgroundColor: theme.palette.background.lightBackground,
          borderRadius: '4px',
          boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
          mb: 2,
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: theme.palette.background.default,
            borderBottom: '1px solid #ccc',
          },
          '& .MuiDataGrid-columnSeparator': {
            visibility: 'visible',
            color: '#ccc',
          },
          '& .MuiDataGrid-cell': {
            borderBottom: '1px solid #eee',
          },
        }}
        getRowId={({projectId}) => projectId}
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
        {NOT_ACTIVATED_LABEL}
      </div>
      <DataGrid
        key={'notebook_list_datagrid_not_activated'}
        rows={availableProjects}
        columns={notActivatedColumns}
        autoHeight
        sx={{
          cursor: 'pointer',
          padding: '8px',
          backgroundColor: theme.palette.background.lightBackground,
          borderRadius: '4px',
          boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
          mb: 2,
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: theme.palette.background.default,
            borderBottom: '1px solid #ccc',
          },
          '& .MuiDataGrid-columnSeparator': {
            visibility: 'visible',
            color: '#ccc',
          },
          '& .MuiDataGrid-cell': {
            borderBottom: '1px solid #eee',
          },
        }}
        onRowClick={handleRowClick}
        getRowId={({projectId}) => projectId}
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
