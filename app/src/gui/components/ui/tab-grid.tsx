import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import {Box, Tab} from '@mui/material';
import {
  DataGrid,
  GridEventListener,
  GridPaginationModel,
} from '@mui/x-data-grid';
import {ProjectExtended} from '../../../types/project';
import {useNavigate} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';
import {useEffect, useState} from 'react';

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
  columns,
}: {
  projects: ProjectExtended[];
  tabID: string;
  handleChange: React.Dispatch<React.SetStateAction<string>>;
  columns: any;
}) {
  const activatedProjects = projects.filter(({activated}) => activated);
  const availableProjects = projects.filter(({activated}) => !activated);

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

  const history = useNavigate();

  const handleRowClick: GridEventListener<'rowClick'> = ({
    row: {activated, project_id},
  }) => {
    if (activated) history(`${ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE}${project_id}`);
  };
  return (
    <TabContext value={tabID}>
      <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
        <TabList onChange={(_, value: string) => handleChange(value)}>
          {['1', '2'].map(tab => (
            <Tab
              key={tab}
              label={
                tab === '1'
                  ? `Activated (${activatedProjects.length})`
                  : `Available (${availableProjects.length})`
              }
              value={tab}
              disabled={
                !projects.filter(r => r.activated).length && tab === '1'
              }
            />
          ))}
        </TabList>
      </Box>
      {['1', '2'].map(tab => (
        <TabPanel key={tab} value={tab} sx={{px: 0}}>
          <div style={{flexGrow: 1}}>
            <DataGrid
              key={`notebook_list_datagrid_${tab}`}
              rows={tab === '1' ? activatedProjects : availableProjects}
              columns={columns}
              sx={{cursor: tab === '1' ? 'pointer' : 'default'}}
              onRowClick={handleRowClick}
              getRowId={({_id}) => _id}
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
