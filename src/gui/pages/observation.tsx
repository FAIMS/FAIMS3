import React from 'react';
import {
  AppBar,
  Box,
  Breadcrumbs,
  Container,
  Typography,
  Paper,
  Tab,
} from '@material-ui/core';
import TabContext from '@material-ui/lab/TabContext';
import TabList from '@material-ui/lab/TabList';
import TabPanel from '@material-ui/lab/TabPanel';
import {NavLink, useParams} from 'react-router-dom';
import * as ROUTES from '../../constants/routes';
import {ObservationForm} from '../components/observationForm';
import InProgress from '../components/inProgress';
export default function Observation() {
  const {listing_id_project_id, observation_id} = useParams<{
    listing_id_project_id: string;
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
          <NavLink to={ROUTES.PROJECT + listing_id_project_id}>
            {listing_id_project_id}
          </NavLink>
          <Typography color="textPrimary">{observation_id}</Typography>
        </Breadcrumbs>
      </Box>
      <Paper square>
        <TabContext value={value}>
          <AppBar position="static" color={'transparent'}>
            <TabList onChange={handleChange} aria-label="simple tabs example">
              <Tab label="Edit" value="1" />
              <Tab label="Revisions" value="2" />
              <Tab label="Meta" value="3" />
            </TabList>
          </AppBar>
          <TabPanel value="1">
            <ObservationForm
              listing_id_project_id={listing_id_project_id}
              observation_id={observation_id}
              is_fresh={observation_id === 'new-observation'}
            />
          </TabPanel>
          <TabPanel value="2">
            <InProgress />
          </TabPanel>
          <TabPanel value="3">
            <InProgress />
          </TabPanel>
        </TabContext>
      </Paper>
    </Container>
  );
}
