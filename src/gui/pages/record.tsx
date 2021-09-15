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
 * Filename: record.tsx
 * Description:
 *   TODO
 */

import React, {useContext, useEffect, useState} from 'react';
import {useHistory, useParams} from 'react-router-dom';

import {
  AppBar,
  Box,
  Container,
  Typography,
  Paper,
  Tab,
  CircularProgress,
} from '@material-ui/core';
import TabContext from '@material-ui/lab/TabContext';
import TabList from '@material-ui/lab/TabList';
import TabPanel from '@material-ui/lab/TabPanel';
import grey from '@material-ui/core/colors/grey';

import * as ROUTES from '../../constants/routes';
import {ProjectID, RecordID, RevisionID} from '../../datamodel/core';
import {getProjectInfo} from '../../databaseAccess';
import {listFAIMSRecordRevisions} from '../../data_storage';

import Breadcrumbs from '../components/ui/breadcrumbs';
import RecordForm from '../components/record/form';
import InProgress from '../components/ui/inProgress';
import BoxTab from '../components/ui/boxTab';
import RecordMeta from '../components/record/meta';
import RecordDelete from '../components/record/delete';
import {ProjectUIModel} from '../../datamodel/ui';
import {ActionType} from '../../actions';
import {store} from '../../store';
import {getUiSpecForProject} from '../../uiSpecification';

export default function Record() {
  const {project_id, record_id, revision_id} = useParams<{
    project_id: ProjectID;
    record_id: RecordID;
    revision_id: RevisionID;
  }>();
  const {dispatch} = useContext(store);
  const history = useHistory();

  const [value, setValue] = React.useState('1');

  const project_info = getProjectInfo(project_id);
  const [uiSpec, setUISpec] = useState(null as null | ProjectUIModel);
  const [revisions, setRevisions] = React.useState([] as string[]);
  const [error, setError] = useState(null as null | {});

  const breadcrumbs = [
    {link: ROUTES.INDEX, title: 'Index'},
    {link: ROUTES.PROJECT_LIST, title: 'Projects'},
    {
      link: ROUTES.PROJECT + project_id,
      title: project_info !== null ? project_info.name : project_id,
    },
    {title: record_id},
    {title: revision_id},
  ];

  useEffect(() => {
    getUiSpecForProject(project_id).then(setUISpec, setError);
  }, [project_id]);

  useEffect(() => {
    setRevisions([]);
    listFAIMSRecordRevisions(project_id, record_id)
      .then(all_revisions => {
        setRevisions(all_revisions);
      })
      .catch(console.error /*TODO*/);
  }, [project_id, record_id]);

  const handleChange = (event: React.ChangeEvent<{}>, newValue: string) => {
    setValue(newValue);
  };

  return (
    <Container maxWidth="lg">
      <Breadcrumbs data={breadcrumbs} />
      <Box mb={2}>
        <Typography variant={'h2'} component={'h1'}>
          Update Record
        </Typography>
        <Typography variant={'subtitle1'} gutterBottom>
          Edit data for this record. If you need to, you can also revisit
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
            {(() => {
              if (error !== null) {
                dispatch({
                  type: ActionType.ADD_ALERT,
                  payload: {
                    message: 'Could not load form: ' + error.toString(),
                    severity: 'warning',
                  },
                });
                history.goBack();
                return <React.Fragment />;
              } else if (uiSpec === null) {
                // Loading
                return <CircularProgress size={12} thickness={4} />;
              } else {
                return (
                  <RecordForm
                    project_id={project_id}
                    record_id={record_id}
                    revision_id={revision_id}
                    uiSpec={uiSpec}
                  />
                );
              }
            })()}
          </TabPanel>
          <TabPanel value="2">
            <InProgress />
            <Box p={2} />
            <BoxTab title={'Developer tool: record revisions'} />
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
            <RecordMeta
              project_id={project_id}
              record_id={record_id}
              revision_id={revision_id}
            />
            <Box mt={2}>
              <RecordDelete
                project_id={project_id}
                record_id={record_id}
                revision_id={revision_id}
              />
            </Box>
          </TabPanel>
        </TabContext>
      </Paper>
    </Container>
  );
}
