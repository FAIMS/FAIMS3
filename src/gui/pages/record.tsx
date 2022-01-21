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
 * Filename: record.tsx
 * Description:
 *   TODO
 */

import React, {useContext, useEffect, useState} from 'react';
import {useHistory, useParams, Redirect} from 'react-router-dom';

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

import {ActionType} from '../../actions';
import * as ROUTES from '../../constants/routes';
import {getProjectInfo, listenProjectInfo} from '../../databaseAccess';
import {ProjectID, RecordID, RevisionID} from '../../datamodel/core';
import {ProjectUIModel, ProjectInformation} from '../../datamodel/ui';
import {listFAIMSRecordRevisions} from '../../data_storage';
import {store} from '../../store';
import {getUiSpecForProject} from '../../uiSpecification';

import RecordForm from '../components/record/form';
import RecordMeta from '../components/record/meta';
import RecordDelete from '../components/record/delete';
import BoxTab from '../components/ui/boxTab';
import Breadcrumbs from '../components/ui/breadcrumbs';
import {useEventedPromise, constantArgsShared} from '../pouchHook';

import {makeStyles} from '@material-ui/core/styles';

const useStyles = makeStyles(theme => ({
  NoPaddding: {
    [theme.breakpoints.down('sm')]: {
      paddingLeft: 0,
      paddingRight: 0,
    },
  },
  LeftPaddding: {
    [theme.breakpoints.down('sm')]: {
      paddingLeft: 10,
    },
  },
}));

export default function Record() {
  const {project_id, record_id, revision_id, draft_id} = useParams<{
    project_id: ProjectID;
    record_id: RecordID;
    revision_id: RevisionID;
    draft_id?: string;
  }>();
  const {dispatch} = useContext(store);
  const history = useHistory();

  const [value, setValue] = React.useState('1');

  let project_info: ProjectInformation | null;
  try {
    project_info = useEventedPromise(
      getProjectInfo,
      constantArgsShared(listenProjectInfo, project_id),
      false,
      [project_id],
      project_id
    ).expect();
  } catch (err: any) {
    if (err.message !== 'missing') {
      throw err;
    } else {
      return <Redirect to="/404" />;
    }
  }

  const [uiSpec, setUISpec] = useState(null as null | ProjectUIModel);
  const [revisions, setRevisions] = React.useState([] as string[]);
  const [error, setError] = useState(null as null | {});
  const classes = useStyles();

  const breadcrumbs = [
    {link: ROUTES.HOME, title: 'Home'},
    {link: ROUTES.PROJECT_LIST, title: 'Notebooks'},
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
    <Container maxWidth="lg" className={classes.NoPaddding}>
      <Breadcrumbs data={breadcrumbs} />
      <Box mb={2} className={classes.LeftPaddding}>
        <Typography variant={'h2'} component={'h1'}>
          Update{' '}
          {uiSpec !== null && uiSpec['visible_types'][0] !== ''
            ? uiSpec['viewsets'][uiSpec['visible_types'][0]]['label']
            : ''}{' '}
          Record
        </Typography>
        <Typography variant={'subtitle1'} gutterBottom>
          Edit data for this record. If you need to, you can also revisit
          previous revisions.
        </Typography>
      </Box>
      <Paper square className={classes.NoPaddding}>
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
                    ui_specification={uiSpec}
                    draft_id={draft_id}
                  />
                );
              }
            })()}
          </TabPanel>
          <TabPanel value="2">
            <Box p={2} />
            <BoxTab title={'record revisions'} />
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
