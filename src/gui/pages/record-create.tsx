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
 * Filename: record-create.tsx
 * Description:
 *   TODO
 */

import React, {useContext, useState} from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  CircularProgress,
} from '@material-ui/core';
import {Redirect, useHistory, useParams} from 'react-router-dom';
import * as ROUTES from '../../constants/routes';
import Breadcrumbs from '../components/ui/breadcrumbs';
import RecordForm from '../components/record/form';
import {getProjectInfo} from '../../databaseAccess';
import {ProjectID} from '../../datamodel/core';
import {ProjectInformation, ProjectUIModel} from '../../datamodel/ui';
import {useEffect} from 'react';
import {getUiSpecForProject} from '../../uiSpecification';
import {ActionType} from '../../actions';
import {store} from '../../store';
import {newStagedData} from '../../sync/draft-storage';

interface DraftCreateProps {
  project_id: ProjectID;
  type_name: string;
}

function DraftCreate(props: DraftCreateProps) {
  const {project_id, type_name} = props;

  const {dispatch} = useContext(store);
  const history = useHistory();

  const [error, setError] = useState(null as null | {});
  const [draft_id, setDraft_id] = useState(null as null | string);

  useEffect(() => {
    newStagedData(project_id, null, type_name).then(setDraft_id, setError);
  }, [project_id]);

  if (error !== null) {
    dispatch({
      type: ActionType.ADD_ALERT,
      payload: {
        message: 'Could not create a draft: ' + error.toString(),
        severity: 'warning',
      },
    });
    history.goBack();
    return <React.Fragment />;
  } else if (draft_id === null) {
    // Creating new draft loading
    return <CircularProgress size={12} thickness={4} />;
  } else {
    return (
      <Redirect
        to={
          ROUTES.PROJECT +
          project_id +
          ROUTES.RECORD_CREATE +
          type_name +
          ROUTES.RECORD_DRAFT +
          draft_id
        }
      />
    );
  }
}

interface DraftEditProps {
  project_id: ProjectID;
  type_name: string;
  draft_id: string;
  project_info: ProjectInformation | null;
}

function DraftEdit(props: DraftEditProps) {
  const {project_id, type_name, draft_id, project_info} = props;
  const {dispatch} = useContext(store);
  const history = useHistory();

  const [uiSpec, setUISpec] = useState(null as null | ProjectUIModel);
  const [error, setError] = useState(null as null | {});

  useEffect(() => {
    getUiSpecForProject(project_id).then(setUISpec, setError);
  }, [project_id]);

  if (error !== null) {
    dispatch({
      type: ActionType.ADD_ALERT,
      payload: {
        message: 'Could not edit draft: ' + error.toString(),
        severity: 'warning',
      },
    });
    history.goBack();
    return <React.Fragment />;
  } else if (uiSpec === null) {
    // Loading
    return <CircularProgress size={12} thickness={4} />;
  } else {
    // Loaded, variant picked, show form:
    return (
      <React.Fragment>
        <Box mb={2}>
          <Typography variant={'h2'} component={'h1'}>
            Record Record
          </Typography>
          <Typography variant={'subtitle1'} gutterBottom>
            Add an record for the{' '}
            {project_info !== null ? project_info.name : project_id} project.
          </Typography>
        </Box>
        <Paper square>
          <Box p={3}>
            <RecordForm
              project_id={project_id}
              draft_id={draft_id}
              type={type_name}
              ui_specification={uiSpec}
            />
          </Box>
        </Paper>
      </React.Fragment>
    );
  }
}

export default function RecordCreate() {
  const {project_id, type_name, draft_id} = useParams<{
    project_id: ProjectID;
    type_name: string;
    draft_id?: string;
  }>();

  const project_info = getProjectInfo(project_id);
  const breadcrumbs = [
    {link: ROUTES.INDEX, title: 'Index'},
    {link: ROUTES.PROJECT_LIST, title: 'Projects'},
    {
      link: ROUTES.PROJECT + project_id,
      title: project_info !== null ? project_info.name : project_id,
    },
    {title: 'Edit Draft'},
  ];

  return (
    <React.Fragment>
      <Container maxWidth="lg">
        <Breadcrumbs data={breadcrumbs} />
        {draft_id === undefined ? (
          <DraftCreate project_id={project_id} type_name={type_name} />
        ) : (
          <DraftEdit
            project_info={project_info}
            project_id={project_id}
            type_name={type_name}
            draft_id={draft_id}
          />
        )}
      </Container>
    </React.Fragment>
  );
}
