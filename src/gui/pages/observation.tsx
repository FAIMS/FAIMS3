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

import React, {useEffect} from 'react';
import {
  AppBar,
  Box,
  Container,
  Typography,
  Paper,
  Tab,
} from '@material-ui/core';
import TabContext from '@material-ui/lab/TabContext';
import TabList from '@material-ui/lab/TabList';
import TabPanel from '@material-ui/lab/TabPanel';
import {useParams} from 'react-router-dom';
import * as ROUTES from '../../constants/routes';
import {ProjectID} from '../../datamodel';
import Breadcrumbs from '../components/ui/breadcrumbs';
import ObservationForm from '../components/observation/form';
import InProgress from '../components/ui/inProgress';
import BoxTab from '../components/ui/boxTab';
import {listFAIMSObservationRevisions} from '../../data_storage';
import {getProjectInfo} from '../../databaseAccess';
import grey from '@material-ui/core/colors/grey';
import ObservationMeta from '../components/observation/meta';
import ObservationDelete from '../components/observation/delete';

export default function Observation() {
  const {project_id, observation_id} = useParams<{
    project_id: ProjectID;
    observation_id: string;
  }>();
  const [value, setValue] = React.useState('1');

  const project_info = getProjectInfo(project_id);
  const breadcrumbs = [
    {link: ROUTES.INDEX, title: 'Index'},
    {link: ROUTES.PROJECT_LIST, title: 'Projects'},
    {
      link: ROUTES.PROJECT + project_id,
      title: project_info !== null ? project_info.name : project_id,
    },
    {title: observation_id},
  ];
  const [revisions, setRevisions] = React.useState([] as string[]);
  useEffect(() => {
    setRevisions([]);
    listFAIMSObservationRevisions(project_id, observation_id)
      .then(all_revisions => {
        setRevisions(all_revisions);
      })
      .catch(console.error /*TODO*/);
  }, [project_id, observation_id]);
  const handleChange = (event: React.ChangeEvent<{}>, newValue: string) => {
    setValue(newValue);
  };

  return (
    <Container maxWidth="lg">
      <Breadcrumbs data={breadcrumbs} />
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
              <ObservationDelete
                project_id={project_id}
                observation_id={observation_id}
              />
            </Box>
          </TabPanel>
        </TabContext>
      </Paper>
    </Container>
  );
}
