import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import {Box, Stack, Tab} from '@mui/material';
import {DataGrid, GridEventListener} from '@mui/x-data-grid';
import {ProjectInformation} from '@faims3/data-model/build/src/types';
import {NOTEBOOK_NAME, NOTEBOOK_NAME_CAPITALIZED} from '../../../buildconfig';
import ProjectCardList from './project-card-list';
import {projectListLayout} from '../../themes';

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
  pouchProjectList,
  tabID,
  handleChange,
  handleRowClick,
  loading,
  columns,
  sortModel,
}: {
  pouchProjectList: ProjectInformation[];
  tabID: string;
  handleChange: (event: React.SyntheticEvent, newValue: string) => void;
  handleRowClick: GridEventListener<'rowClick'>;
  loading: boolean;
  columns: any;
  sortModel: any;
}) {
  return (
    <TabContext
      value={
        pouchProjectList.filter(r => r.is_activated).length === 0 ? '2' : tabID
      }
    >
      <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
        <TabList onChange={handleChange} aria-label="tablist">
          <Tab
            label={
              'Activated (' +
              pouchProjectList.filter(r => r.is_activated).length +
              ')'
            }
            value="1"
            disabled={
              pouchProjectList.filter(r => r.is_activated).length === 0
                ? true
                : false
            }
          />
          <Tab
            label={
              'Available (' +
              pouchProjectList.filter(r => !r.is_activated).length +
              ')'
            }
            value="2"
          />
        </TabList>
      </Box>
      <TabPanel value="1" sx={{px: 0}}>
        <div style={{display: 'flex', height: '100%'}}>
          <div style={{flexGrow: 1}}>
            {projectListLayout === 'card-list' ? (
              <ProjectCardList
                projects={pouchProjectList.filter(r => r.is_activated)}
              />
            ) : (
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
                    <Stack
                      height="100%"
                      alignItems="center"
                      justifyContent="center"
                    >
                      No {NOTEBOOK_NAME_CAPITALIZED}s have been activated yet.
                    </Stack>
                  ),
                }}
              />
            )}
          </div>
        </div>
      </TabPanel>
      <TabPanel value="2" sx={{px: 0}}>
        <div style={{display: 'flex', height: '100%'}}>
          <div style={{flexGrow: 1}}>
            {projectListLayout === 'card-list' ? (
              <ProjectCardList
                projects={pouchProjectList.filter(r => !r.is_activated)}
              />
            ) : (
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
                    <Stack
                      height="100%"
                      alignItems="center"
                      justifyContent="center"
                    >
                      You don't have any unactivated {NOTEBOOK_NAME}s.
                    </Stack>
                  ),
                }}
              />
            )}
          </div>
        </div>
      </TabPanel>
    </TabContext>
  );
}
