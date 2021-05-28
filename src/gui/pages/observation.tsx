/*
 * Copyright 2021 Macquarie University
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
 * Filename: observation.tsx
 * Description:
 *   TODO
 */

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
  Link,
} from '@material-ui/core';
import DeleteIcon from '@material-ui/icons/Delete';
import TabContext from '@material-ui/lab/TabContext';
import TabList from '@material-ui/lab/TabList';
import TabPanel from '@material-ui/lab/TabPanel';
import {Link as RouterLink, useHistory, useParams} from 'react-router-dom';
import * as ROUTES from '../../constants/routes';
import {ProjectID} from '../../datamodel';

import ObservationForm from '../components/observation/form';
import InProgress from '../components/ui/inProgress';
import BoxTab from '../components/ui/boxTab';
import {Alert} from '@material-ui/lab';
import {
  deleteFAIMSDataForID,
  listFAIMSProjectRevisions,
} from '../../dataStorage';
import {ActionType} from '../../actions';
import {store} from '../../store';
import {getProjectInfo} from '../../databaseAccess';
import grey from '@material-ui/core/colors/grey';
import ObservationMeta from '../components/observation/meta';

export default function Observation() {
  const {project_id, observation_id} = useParams<{
    project_id: ProjectID;
    observation_id: string;
  }>();
  const [value, setValue] = React.useState('1');
  const history = useHistory();
  const globalState = useContext(store);
  const {dispatch} = globalState;
  const project_info = getProjectInfo(project_id);
  const revisions = listFAIMSProjectRevisions(project_id);
  const handleChange = (event: React.ChangeEvent<{}>, newValue: string) => {
    setValue(newValue);
  };

  const handleDelete = () => {
    deleteFAIMSDataForID(project_id, observation_id)
      .then(() => {
        dispatch({
          type: ActionType.ADD_ALERT,
          payload: {
            message: 'Observation ' + observation_id + ' deleted',
            severity: 'success',
          },
        });
        history.push(ROUTES.PROJECT + project_id);
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
          <Link component={RouterLink} to={ROUTES.INDEX}>
            Index
          </Link>
          <Link component={RouterLink} to={ROUTES.PROJECT_LIST}>
            Projects
          </Link>
          <Link component={RouterLink} to={ROUTES.PROJECT + project_id}>
            {project_info !== null ? project_info.name : project_id}
          </Link>
          <Typography color="textPrimary">{observation_id}</Typography>
        </Breadcrumbs>
      </Box>
      <Box mb={2}>
        <Typography variant={'h2'} component={'h1'}>
          Update Observation
        </Typography>
        <Typography variant={'subtitle1'} gutterBottom>
          Edit data for this observation. If you need to, you can also revisit
          previous revisions.
        </Typography>
      </Box>
      <Paper square>
        <TabContext value={value}>
          <AppBar position="static" color={'primary'}>
            <TabList onChange={handleChange} aria-label="simple tabs example">
              <Tab label="Edit" value="1" />
              <Tab label="Revisions" value="2" />
              <Tab label="Meta" value="3" />
            </TabList>
          </AppBar>
          <TabPanel value="1">
            <ObservationForm
              project_id={project_id}
              observation_id={observation_id}
              is_fresh={observation_id === 'new-observation'}
            />
          </TabPanel>
          <TabPanel value="2">
            <InProgress />
            <Box p={2} />
            <BoxTab title={'Developer tool: observation revisions'} />
            <Box
              bgcolor={grey[200]}
              pl={2}
              pr={2}
              style={{overflowX: 'scroll'}}
            >
              <pre>{JSON.stringify(revisions, null, 2)}</pre>
            </Box>
          </TabPanel>
          <TabPanel value="3">
            <ObservationMeta
              project_id={project_id}
              observation_id={observation_id}
            />
            <Box mt={2}>
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
                  You cannot reverse this action! Be sure you wish to delete
                  this observation.
                </Alert>
              </Box>
            </Box>
          </TabPanel>
        </TabContext>
      </Paper>
    </Container>
  );
}
