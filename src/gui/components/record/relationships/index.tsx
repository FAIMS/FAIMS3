/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: relationships/index.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Tabs,
  Tab,
  ListItemIcon,
  Button,
  Link,
  Grid,
} from '@mui/material';
import {NavLink} from 'react-router-dom';
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';
import {
  DataGrid,
  GridColDef,
  GridToolbarContainer,
  GridToolbarFilterButton,
  GridPagination,
} from '@mui/x-data-grid';

import {TabPanelProps, RecordProps, RelationshipsComponentProps} from './types';

function TabPanel(props: TabPanelProps) {
  const {children, value, index, ...other} = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`child-parent-tabpanel-${index}`}
      aria-labelledby={`child-parent-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box>
          <Typography>{children}</Typography>
        </Box>
      )}
    </div>
  );
}
function CustomToolbar() {
  return (
    <Grid
      container
      direction="row"
      justifyContent="space-between"
      alignItems="center"
    >
      <Grid item>
        <GridToolbarContainer>
          <GridToolbarFilterButton />
        </GridToolbarContainer>
      </Grid>
      <Grid item>
        <GridPagination />
      </Grid>
    </Grid>
  );
}

function a11yProps(index: number) {
  return {
    id: `child-parent-tab-${index}`,
    'aria-controls': `child-parent-tabpanel-${index}`,
  };
}

export default function RelationshipsComponent(
  props: RelationshipsComponentProps
) {
  /**
   * Display the child records associated with a records in a MUI Data Grid.
   * Row click to go to child record
   * Data Grid is set to autoHeight (grid will size according to its content) up to 5 rows
   * Notes for Kate
   *  TODO hopefully it's easy to spot that the
   *
   */
  const [value, setValue] = React.useState(0);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };
  const columns: GridColDef[] = [
    {
      field: 'id',
      headerName: 'ID',
      flex: 0.2,
      minWidth: 70,
      renderCell: cellValues => (
        <Button component={NavLink} to={cellValues.row.route} variant={'text'}>
          {cellValues.row.id}
        </Button>
      ),
    },
    {
      field: 'title',
      headerName: 'Record title',
      flex: 0.2,
      minWidth: 100,
    },
    {
      field: 'lastUpdatedBy',
      headerName: 'Last Updated',
      flex: 0.2,
      minWidth: 300,
    },
    {field: 'route', hide: true, filterable: false},
    {
      field: 'type',
      headerName: 'Record Type',
      flex: 0.2,
      minWidth: 100,
    },
    {
      field: 'children',
      headerName: 'Child Records',
      flex: 0.2,
      minWidth: 200,
      renderCell: cellValues => (
        <List
          dense={true}
          sx={{p: 0, maxHeight: '100px', overflowY: 'scroll', width: '100%'}}
        >
          {cellValues.row.children.map((value: RecordProps, index: number) => (
            <React.Fragment>
              <ListItem key={'child_record_link' + index} sx={{p: 0}}>
                <ListItemIcon sx={{minWidth: '30px'}}>
                  <SubdirectoryArrowRightIcon fontSize={'small'} />
                </ListItemIcon>
                <ListItemText>
                  <NavLink to={value.route} component={Link}>
                    {value.title}
                  </NavLink>
                </ListItemText>
              </ListItem>
            </React.Fragment>
          ))}
        </List>
      ),
    },
  ];

  return (
    <Box style={{border: 'solid 1px red'}} mb={2}>
      <Box sx={{width: '100%'}}>
        <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
          <Tabs
            value={value}
            onChange={handleChange}
            aria-label="basic tabs example"
          >
            {props.childRecords !== null ? (
              <Tab label="Child Records" {...a11yProps(0)} />
            ) : (
              ''
            )}
            {props.parentRecords !== null ? (
              <Tab label="Parent Records" {...a11yProps(1)} />
            ) : (
              ''
            )}
            {props.linkRecords !== null ? (
              <Tab label="Linked Records" {...a11yProps(2)} />
            ) : (
              ''
            )}
          </Tabs>
        </Box>
        {props.childRecords !== null ? (
          <TabPanel value={value} index={0}>
            <DataGrid
              autoHeight
              components={{
                Footer: CustomToolbar,
              }}
              hideFooterSelectedRowCount
              initialState={{
                columns: {
                  columnVisibilityModel: {
                    // Hide column route, the other columns will remain visible
                    route: false,
                  },
                },
              }}
              getRowHeight={() => 'auto'}
              density={'compact'}
              rows={props.childRecords}
              columns={columns}
              pageSize={5}
              rowsPerPageOptions={[5]}
              disableSelectionOnClick
              // sx={{cursor: 'pointer'}}
              sx={{borderRadius: '0'}}
            />
          </TabPanel>
        ) : (
          ''
        )}
        {props.parentRecords !== null ? (
          <TabPanel value={value} index={1}>
            {props.parentRecords.length > 1 ? (
              <Typography
                variant={'caption'}
                component={'div'}
                sx={{mt: 2, ml: 2}}
              >
                This record is linked to multiple parent records
              </Typography>
            ) : (
              ''
            )}
            <List
              dense={true}
              sx={{p: 0, maxHeight: '400px', overflowY: 'scroll'}}
            >
              {props.parentRecords.map((value, index) => (
                <ListItem key={'parent_record_link' + index}>
                  <ListItemText>
                    <NavLink to={value.route} component={Link}>
                      {value.title}
                    </NavLink>
                  </ListItemText>
                </ListItem>
              ))}
            </List>
          </TabPanel>
        ) : (
          ''
        )}
        {props.linkRecords !== null ? (
          <TabPanel value={value} index={2}>
            <DataGrid
              autoHeight
              components={{
                Footer: CustomToolbar,
              }}
              hideFooterSelectedRowCount
              initialState={{
                columns: {
                  columnVisibilityModel: {
                    // Hide column route, the other columns will remain visible
                    route: false,
                  },
                },
              }}
              getRowHeight={() => 'auto'}
              density={'compact'}
              rows={props.linkRecords}
              columns={columns}
              pageSize={5}
              rowsPerPageOptions={[5]}
              disableSelectionOnClick
              // sx={{cursor: 'pointer'}}
              sx={{borderRadius: '0'}}
            />
          </TabPanel>
        ) : (
          ''
        )}
      </Box>
    </Box>
  );
}
