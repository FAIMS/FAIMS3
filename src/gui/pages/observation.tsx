import React from 'react';
import {
  AppBar,
  Box,
  Breadcrumbs,
  Container,
  Typography,
  Paper,
  Tabs,
  Tab,
} from '@material-ui/core';
import TabContext from '@material-ui/lab/TabContext';
import TabList from '@material-ui/lab/TabList';
import TabPanel from '@material-ui/lab/TabPanel';
import {NavLink, useParams} from 'react-router-dom';
import * as ROUTES from '../../constants/routes';
import grey from '@material-ui/core/colors/grey';
import {FAIMSForm} from '../form';

export default function Observation() {
  const {project_id, observation_id} = useParams<{
    project_id: string;
    observation_id: string;
  }>();
  const [value, setValue] = React.useState('1');

  const handleChange = (event: React.ChangeEvent<{}>, newValue: string) => {
    setValue(newValue);
  };

  return (
    <Container maxWidth="lg">
      <Box display="flex" flexDirection="row-reverse" p={1} m={1}>
        <Breadcrumbs aria-label="breadcrumb">
          <NavLink to={ROUTES.INDEX}>Index</NavLink>
          <NavLink to={ROUTES.PROJECT_LIST}>Projects</NavLink>
          <NavLink to={ROUTES.PROJECT + project_id}>
            Project {project_id}
          </NavLink>
          <Typography color="textPrimary">
            Observation {observation_id}
          </Typography>
        </Breadcrumbs>
      </Box>
      <Paper square>
        <TabContext value={value}>
          <AppBar position="static" color={'transparent'}>
            <TabList onChange={handleChange} aria-label="simple tabs example">
              <Tab label="View" value="1" />
              <Tab label="Edit" value="2" />
              <Tab label="Revisions" value="3" />
              <Tab label="Meta" value="4" />
            </TabList>
          </AppBar>
          <TabPanel value="1">View</TabPanel>
          <TabPanel value="2">Edit</TabPanel>
          <TabPanel value="3">Revisions</TabPanel>
          <TabPanel value="4">Meta</TabPanel>
        </TabContext>
      </Paper>
    </Container>
  );
}
