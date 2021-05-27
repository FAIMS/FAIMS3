import React, {useContext} from 'react';
import {
  AppBar,
  Box,
  Breadcrumbs,
  Container,
  Typography,
  Paper,
  Tab,
  Button,
} from '@material-ui/core';
import DeleteIcon from '@material-ui/icons/Delete';
import TabContext from '@material-ui/lab/TabContext';
import TabList from '@material-ui/lab/TabList';
import TabPanel from '@material-ui/lab/TabPanel';
import {NavLink, useHistory, useParams} from 'react-router-dom';
import * as ROUTES from '../../constants/routes';
import {ObservationForm} from '../components/observationForm';
import InProgress from '../components/inProgress';
import {Alert} from '@material-ui/lab';
import {deleteFAIMSDataForID} from '../../dataStorage';
import {ActionType} from '../../actions';
import {store} from '../../store';
export default function Observation() {
  const {listing_id_project_id, observation_id} = useParams<{
    listing_id_project_id: string;
    observation_id: string;
  }>();
  const [value, setValue] = React.useState('1');
  const history = useHistory();
  const globalState = useContext(store);
  const {dispatch} = globalState;

  const handleChange = (event: React.ChangeEvent<{}>, newValue: string) => {
    setValue(newValue);
  };

  const handleDelete = () => {
    deleteFAIMSDataForID(listing_id_project_id, observation_id)
      .then(() => {
        dispatch({
          type: ActionType.ADD_ALERT,
          payload: {
            message: 'Observation ' + observation_id + ' deleted',
            severity: 'success',
          },
        });
        history.push(ROUTES.PROJECT + listing_id_project_id);
      })
      .catch(err => {
        console.log('Could not delete observation: ' + observation_id, err);
        dispatch({
          type: ActionType.ADD_ALERT,
          payload: {
            message: 'Could not delete observation: ' + observation_id,
            severity: 'error',
          },
        });
      });
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
              <Tab label="Settings" value="4" />
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
          <TabPanel value="4">
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<DeleteIcon />}
              onClick={handleDelete}
            >
              Delete Observation
            </Button>
            <Box mt={2}>
              <Alert severity="warning">
                You cannot reverse this action! Be sure you wish to delete this
                observation.
              </Alert>
            </Box>
          </TabPanel>
        </TabContext>
      </Paper>
    </Container>
  );
}
