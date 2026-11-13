// SPDX-License-Identifier: Apache-2.0
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import {Box, Tab} from '@mui/material';
import {DataGrid, GridColDef, GridEventListener} from '@mui/x-data-grid';
import {useNavigate} from 'react-router-dom';
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
 * Renders a tabbed grid component.
 *
 * @param projects - The list of project information.
 * @param tabID - The ID of the active tab.
 * @param handleChange - The event handler for tab change.
 * @param columns - The columns configuration for the grid.
 * @returns The rendered tabbed grid component.
 */
export default function TabProjectGrid({
  projects,
  tabID,
  handleChange,
  activatedColumns,
  notActivatedColumns,
  activatingProjectKeys = [],
}: {
  projects: Project[];
  tabID: string;
  handleChange: React.Dispatch<React.SetStateAction<string>>;
  activatedColumns: GridColDef<Project>[];
  notActivatedColumns: GridColDef<Project>[];
  activatingProjectKeys?: readonly string[];
}) {
  const {activatedProjects, availableProjects} = partitionNotebookListProjects(
    projects,
    activatingProjectKeys
  );

  const activatedPagination = useNotebookListPagination(
    activatedProjects.length
  );
  const availablePagination = useNotebookListPagination(
    availableProjects.length
  );

  const history = useNavigate();

  const handleRowClick: GridEventListener<'rowClick'> = ({
    row,
  }: {
    row: Project;
  }) => {
    if (row.isActivated || isNotebookActivationBlocked(row))
      history(
        ROUTES.getNotebookRoute({
          serverId: row.serverId,
          projectId: row.projectId,
        })
      );
  };

  return (
    <TabContext value={tabID}>
      <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
        <TabList
          onChange={(_, value: string) => handleChange(value)}
          sx={{
            backgroundColor: theme.palette.background.tabsBackground,
            '& .MuiTabs-indicator': {
              backgroundColor: theme.palette.secondary.contrastText,
            },
          }}
        >
          {['1', '2'].map(tab => (
            <Tab
              key={tab}
              label={
                tab === '1'
                  ? `${ACTIVATED_LABEL} (${activatedProjects.length})`
                  : `${NOT_ACTIVATED_LABEL} (${availableProjects.length})`
              }
              value={tab}
              data-testid={
                tab === '1'
                  ? 'app-notebooks-tab-active'
                  : 'app-notebooks-tab-not-active'
              }
              disabled={activatedProjects.length === 0 && tab === '1'}
            />
          ))}
        </TabList>
      </Box>
      {['1', '2'].map(tab => {
        const pagination =
          tab === '1' ? activatedPagination : availablePagination;
        return (
          <TabPanel key={tab} value={tab} sx={{px: 0}}>
            <div style={{width: '100%', minWidth: 0}}>
              <DataGrid
                onRowClick={handleRowClick}
                key={`notebook_list_datagrid_${tab}`}
                rows={tab === '1' ? activatedProjects : availableProjects}
                columns={tab === '1' ? activatedColumns : notActivatedColumns}
                sx={{
                  width: '100%',
                  cursor: tab === '1' ? 'pointer' : 'default',
                  ...notebookListDataGridSx,
                }}
                getRowId={({projectId}) => projectId}
                getRowClassName={({row}) =>
                  isProjectActivating(row, activatingProjectKeys)
                    ? 'notebook-row-activating'
                    : ''
                }
                rowHeight={75}
                autoHeight
                hideFooter={pagination.hideFooter}
                paginationModel={pagination.paginationModel}
                onPaginationModelChange={pagination.onPaginationModelChange}
                pageSizeOptions={pagination.pageSizeOptions}
                slotProps={{
                  row: {
                    // Shared landmark for e2e; activated rows navigate on click.
                    'data-testid': 'app-notebook-row',
                  },
                }}
              />
            </div>
          </TabPanel>
        );
      })}
    </TabContext>
  );
}
