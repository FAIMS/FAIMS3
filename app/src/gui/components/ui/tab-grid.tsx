import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import {Box, Tab} from '@mui/material';
import {DataGrid, GridEventListener} from '@mui/x-data-grid';
import {ProjectExtended} from '../../../types/project';
import {useNavigate} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';

/**
 * Renders a tabbed grid component.
 *
 * @param pouchProjectList - The list of project information.
 * @param tabID - The ID of the active tab.
 * @param handleChange - The event handler for tab change.
 * @param handleRowClick - The event handler for row click.
 * @param loading - A boolean indicating whether the grid is loading.
 * @param columns - The columns configuration for the grid.
 * @param sortModel - The sorting configuration for the grid.
 * @returns The rendered tabbed grid component.
 */
export default function TabGrid({
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
            />
          </div>
        </TabPanel>
      ))}
    </TabContext>
  );
}
