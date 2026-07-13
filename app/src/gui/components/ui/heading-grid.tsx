import {Stack} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridEventListener,
  GridPaginationModel,
} from '@mui/x-data-grid';
import {config} from '../../../buildconfig';
import {useNavigate} from 'react-router';
import * as ROUTES from '../../../constants/routes';
import {useEffect, useState} from 'react';
import {theme} from '../../themes';
import {
  ACTIVATED_LABEL,
  NOT_ACTIVATED_LABEL,
  notebookListDataGridSx,
} from '../workspace/notebooks';
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
  // pull out active/inactive notebooks
  const activatedProjects = projects.filter(({isActivated}) => isActivated);
  const availableProjects = projects.filter(({isActivated}) => !isActivated);

  const history = useNavigate();

  const handleRowClick: GridEventListener<'rowClick'> = ({
    row: {isActivated, projectId},
  }: {
    row: Project;
  }) => {
    if (isActivated)
      history(`${ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE}${serverId}/${projectId}`);
  };

  // we need a state variable to track pagination model since we want to use a
  // controlled component style to force pagination to behave how we want
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: projects.length,
  });

  // Update pagination settings when the projects changes
  useEffect(() => {
    setPaginationModel(prev => {
      const next = {page: 0, pageSize: projects.length};
      if (prev.page === next.page && prev.pageSize === next.pageSize) {
        return prev;
      }
      return next;
    });
  }, [projects.length]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        minWidth: 0,
      }}
    >
      <div style={{padding: '6px', fontSize: '18px', fontWeight: 'bold'}}>
        {ACTIVATED_LABEL}
      </div>

      <DataGrid
        key={'notebook_list_datagrid_activated'}
        rows={activatedProjects}
        columns={activatedColumns}
        onRowClick={handleRowClick}
        rowHeight={75}
        sx={{
          width: '100%',
          padding: '8px',
          backgroundColor: theme.palette.background.lightBackground,
          borderRadius: '4px',
          boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
          mb: 2,
          ...notebookListDataGridSx,
        }}
        getRowId={({projectId}) => projectId}
        hideFooter={true}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        slots={{
          noRowsOverlay: () => (
            <Stack
              sx={{
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              No {config.notebookNamePluralCapitalized} have been activated yet.
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
        sx={{
          width: '100%',
          padding: '8px',
          backgroundColor: theme.palette.background.lightBackground,
          borderRadius: '4px',
          boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
          mb: 2,
          ...notebookListDataGridSx,
        }}
        onRowClick={handleRowClick}
        getRowId={({projectId}) => projectId}
        rowHeight={75}
        hideFooter
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        slots={{
          noRowsOverlay: () => (
            <Stack
              sx={{
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              You don't have any unactivated {config.notebookNamePlural}.
            </Stack>
          ),
        }}
      />
    </div>
  );
}
