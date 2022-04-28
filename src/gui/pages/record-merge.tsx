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
} from '@mui/material';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import {ActionType} from '../../actions';

import * as ROUTES from '../../constants/routes';
import {getProjectInfo, listenProjectInfo} from '../../databaseAccess';
import {ProjectID, RecordID, RevisionID} from '../../datamodel/core';
import {
  ProjectUIModel,
  ProjectInformation,
  SectionMeta,
} from '../../datamodel/ui';
import {listFAIMSRecordRevisions} from '../../data_storage';
import {store} from '../../store';
import {getUiSpecForProject} from '../../uiSpecification';
import RecordForm from '../components/record/form';

import RecordMeta from '../components/record/meta';
import RecordDelete from '../components/record/delete';
import BoxTab from '../components/ui/boxTab';
import Breadcrumbs from '../components/ui/breadcrumbs';
import {useEventedPromise, constantArgsShared} from '../pouchHook';
import makeStyles from '@mui/styles/makeStyles';

import {getProjectMetadata} from '../../projectMetadata';

import {TokenContents} from '../../datamodel/core';
import {grey} from '@mui/material/colors';

const useStyles = makeStyles(theme => ({
  NoPaddding: {
    [theme.breakpoints.down('md')]: {
      paddingLeft: 0,
      paddingRight: 0,
    },
    padding: 2,
  },
  LeftPaddding: {
    [theme.breakpoints.down('md')]: {
      paddingLeft: 10,
    },
  },
}));

type RecordeProps = {
  token?: null | undefined | TokenContents;
};

export default function Record(props: RecordeProps) {
  const {project_id, record_id} = useParams<{
    project_id: ProjectID;
    record_id: RecordID;
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
  const [metaSection, setMetaSection] = useState(null as null | SectionMeta);

  const breadcrumbs = [
    {link: ROUTES.HOME, title: 'Home'},
    {link: ROUTES.PROJECT_LIST, title: 'Notebooks'},
    {
      link: ROUTES.PROJECT + project_id,
      title: project_info !== null ? project_info.name : project_id,
    },
    {title: record_id},
  ];

  useEffect(() => {
    getUiSpecForProject(project_id).then(setUISpec, setError);
    if (project_id !== null) {
      getProjectMetadata(project_id, 'sections').then(res =>
        setMetaSection(res)
      );
    }
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
      <Breadcrumbs data={breadcrumbs} token={props.token} />
      <p>Merge Required</p>
    </Container>
  );
}
