// SPDX-License-Identifier: Apache-2.0
import {Stack} from '@mui/material';
import {DataGrid, GridColDef, GridEventListener} from '@mui/x-data-grid';
import {config} from '../../../buildconfig';
import {useNavigate} from 'react-router';
import * as ROUTES from '../../../constants/routes';
import {theme} from '../../themes';
import {
  ACTIVATED_LABEL,
  NOT_ACTIVATED_LABEL,
  notebookListDataGridSx,
} from '../workspace/notebooks';
import {isNotebookActivationBlocked} from '../../../context/slices/helpers/notebookDefinition';
import type {Project} from '../../../context/slices/projectSlice';
import {
  isProjectActivating,
  partitionNotebookListProjects,
} from '../../../lib/notebookListDisplay';
import {useNotebookListPagination} from './notebook-list-pagination';

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
  activatingProjectKeys = [],
}: {
  projects: Project[];
  activatedColumns: GridColDef<Project>[];
  notActivatedColumns: GridColDef<Project>[];
  serverId: string;
  activatingProjectKeys?: readonly string[];
}) {
  const {activatedProjects, availableProjects} = partitionNotebookListProjects(
    projects,
    activatingProjectKeys
  );

  const history = useNavigate();

  const handleRowClick: GridEventListener<'rowClick'> = ({
    row,
  }: {
    row: Project;
  }) => {
    if (row.isActivated || isNotebookActivationBlocked(row)) {
      history(ROUTES.getNotebookRoute({serverId, projectId: row.projectId}));
    }
  };

  const activatedPagination = useNotebookListPagination(
    activatedProjects.length
  );
  const availablePagination = useNotebookListPagination(
    availableProjects.length
  );

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
        autoHeight
        sx={{
          width: '100%',
          backgroundColor: theme.palette.background.lightBackground,
          borderRadius: '4px',
          boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
          mb: 2,
          ...notebookListDataGridSx,
        }}
        getRowId={({projectId}) => projectId}
        getRowClassName={({row}) =>
          isProjectActivating(row, activatingProjectKeys)
            ? 'notebook-row-activating'
            : ''
        }
        hideFooter={activatedPagination.hideFooter}
        paginationModel={activatedPagination.paginationModel}
        onPaginationModelChange={activatedPagination.onPaginationModelChange}
        pageSizeOptions={activatedPagination.pageSizeOptions}
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
          backgroundColor: theme.palette.background.lightBackground,
          borderRadius: '4px',
          boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
          mb: 2,
          ...notebookListDataGridSx,
        }}
        onRowClick={handleRowClick}
        getRowId={({projectId}) => projectId}
        rowHeight={75}
        autoHeight
        hideFooter={availablePagination.hideFooter}
        paginationModel={availablePagination.paginationModel}
        onPaginationModelChange={availablePagination.onPaginationModelChange}
        pageSizeOptions={availablePagination.pageSizeOptions}
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
