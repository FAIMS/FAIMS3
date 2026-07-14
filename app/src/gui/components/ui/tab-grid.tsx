import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import {Box, Tab} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridEventListener,
  GridPaginationModel,
} from '@mui/x-data-grid';
import {useNavigate} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';
import {useEffect, useState} from 'react';
import {theme} from '../../themes';
import {
  ACTIVATED_LABEL,
  NOT_ACTIVATED_LABEL,
  notebookListDataGridSx,
} from '../workspace/notebooks';
import {Project} from '../../../context/slices/projectSlice';
import {sortProjectsByNewest} from '../../../lib/notebookListDisplay';

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
}: {
  projects: Project[];
  tabID: string;
  handleChange: React.Dispatch<React.SetStateAction<string>>;
  activatedColumns: GridColDef<Project>[];
  notActivatedColumns: GridColDef<Project>[];
}) {
  const activatedProjects = sortProjectsByNewest(
    projects.filter(({isActivated}) => isActivated)
  );
  const availableProjects = sortProjectsByNewest(
    projects.filter(({isActivated}) => !isActivated)
  );

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

  const history = useNavigate();

  const handleRowClick: GridEventListener<'rowClick'> = ({
    row,
  }: {
    row: Project;
  }) => {
    if (row.isActivated)
      history(
        `${ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE}${row.serverId}/${row.projectId}`
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
              disabled={
                !projects.filter(r => r.isActivated).length && tab === '1'
              }
            />
          ))}
        </TabList>
      </Box>
      {['1', '2'].map(tab => (
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
              rowHeight={75}
              hideFooter
              paginationModel={paginationModel}
              onPaginationModelChange={setPaginationModel}
            />
          </div>
        </TabPanel>
      ))}
    </TabContext>
  );
}
