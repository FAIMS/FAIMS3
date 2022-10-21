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
 * Filename: record-create.tsx
 * Description:
 *   TODO
 */

import React, {useContext, useState, useEffect} from 'react';
import {Redirect, useHistory, useParams, useLocation} from 'react-router-dom';

import {
  AppBar,
  Tab,
  Box,
  Typography,
  Paper,
  CircularProgress,
} from '@mui/material';

import {ActionType} from '../../context/actions';
import * as ROUTES from '../../constants/routes';
import {store} from '../../context/store';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import {generateFAIMSDataID} from '../../data_storage';
import {getProjectInfo, listenProjectInfo} from '../../databaseAccess';
import {ProjectID, RecordID} from '../../datamodel/core';
import {
  ProjectUIModel,
  ProjectInformation,
  SectionMeta,
} from '../../datamodel/ui';
import {
  getUiSpecForProject,
  getReturnedTypesForViewSet,
} from '../../uiSpecification';
import {newStagedData} from '../../sync/draft-storage';
import Breadcrumbs from '../components/ui/breadcrumbs';
import RecordForm from '../components/record/form';
import {useEventedPromise, constantArgsShared} from '../pouchHook';
import {getProjectMetadata} from '../../projectMetadata';
// import {TokenContents} from '../../datamodel/core';
import RecordDelete from '../components/record/delete';
import useMediaQuery from '@mui/material/useMediaQuery';
import {useTheme} from '@mui/material/styles';
import UnpublishedWarning from '../components/record/unpublished_warning';
interface DraftCreateProps {
  project_id: ProjectID;
  type_name: string;
  state?: any;
  record_id: string;
}

function DraftCreate(props: DraftCreateProps) {
  const {project_id, type_name, record_id} = props;

  const {dispatch} = useContext(store);
  const history = useHistory();

  const [error, setError] = useState(null as null | {});
  const [draft_id, setDraft_id] = useState(null as null | string);
  const [uiSpec, setUISpec] = useState(null as null | ProjectUIModel);

  useEffect(() => {
    getUiSpecForProject(project_id).then(setUISpec, setError);
  }, [project_id]);

  useEffect(() => {
    if (uiSpec !== null) {
      const field_types = getReturnedTypesForViewSet(uiSpec, type_name);
      newStagedData(project_id, null, type_name, field_types, record_id).then(
        setDraft_id,
        setError
      );
    } else {
      setDraft_id(null);
    }
  }, [project_id, uiSpec]);

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
        to={{
          pathname:
            ROUTES.NOTEBOOK +
            project_id +
            ROUTES.RECORD_CREATE +
            type_name +
            ROUTES.RECORD_DRAFT +
            draft_id +
            ROUTES.RECORD_RECORD +
            record_id, // update for get record_id persistence for the draft
          state: props.state,
        }}
      />
    );
  }
}

interface DraftEditProps {
  project_id: ProjectID;
  type_name: string;
  draft_id: string;
  project_info: ProjectInformation | null;
  record_id: RecordID;
  state?: any;
}

function DraftEdit(props: DraftEditProps) {
  const {project_id, type_name, draft_id, project_info, record_id} = props;
  const {dispatch} = useContext(store);
  const history = useHistory();

  const [uiSpec, setUISpec] = useState(null as null | ProjectUIModel);
  const [error, setError] = useState(null as null | {});

  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [draftLastSaved, setDraftLastSaved] = useState(null as Date | null);
  const [draftError, setDraftError] = useState(null as string | null);

  const [metaSection, setMetaSection] = useState(null as null | SectionMeta);
  const [value, setValue] = React.useState('1');
  const theme = useTheme();
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));

  useEffect(() => {
    getUiSpecForProject(project_id).then(setUISpec, setError);
    if (project_id !== null) {
      getProjectMetadata(project_id, 'sections').then(res =>
        setMetaSection(res)
      );
      console.debug(draftLastSaved);
      console.debug(draftError);
    }
  }, [project_id]);

  const handleChange = (event: React.ChangeEvent<{}>, newValue: string) => {
    setValue(newValue);
  };

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
            {uiSpec['viewsets'][type_name]['label'] ?? type_name} Record
          </Typography>
          <Typography variant={'subtitle1'} gutterBottom>
            Add a record for the{' '}
            {project_info !== null ? project_info.name : project_id} project.
          </Typography>
        </Box>
        <Paper square>
          <Box p={3}></Box>
          <TabContext value={value}>
            <AppBar position="static" color="primary">
              <TabList
                onChange={handleChange}
                aria-label="simple tabs example"
                indicatorColor={'secondary'}
                textColor="secondary"
              >
                <Tab label="Create" value="1" sx={{color: '#c2c2c2'}} />
                <Tab label="Meta" value="2" sx={{color: '#c2c2c2'}} />
              </TabList>
            </AppBar>
            <TabPanel value="1">
              <Box px={not_xs ? 2 : 0}>
                <UnpublishedWarning />
                <RecordForm
                  project_id={project_id}
                  record_id={record_id}
                  type={type_name}
                  ui_specification={uiSpec}
                  draft_id={draft_id}
                  metaSection={metaSection}
                  isDraftSaving={isDraftSaving}
                  handleSetIsDraftSaving={setIsDraftSaving}
                  handleSetDraftLastSaved={setDraftLastSaved}
                  handleSetDraftError={setDraftError}
                />
              </Box>
            </TabPanel>
            <TabPanel value="2">
              <Box mt={2}>
                <RecordDelete
                  project_id={project_id}
                  record_id={draft_id}
                  revision_id={null}
                />
              </Box>
            </TabPanel>
          </TabContext>
        </Paper>
      </React.Fragment>
    );
  }
}

// type RecordCreateProps = {
//   token?: null | undefined | TokenContents;
// };

export default function RecordCreate() {
  const {project_id, type_name, draft_id, record_id} = useParams<{
    project_id: ProjectID;
    type_name: string;
    draft_id?: string;
    record_id?: string;
  }>();
  const location: any = useLocation();
  let draft_record_id = generateFAIMSDataID();
  if (record_id !== undefined) draft_record_id = record_id;
  if (
    location.state !== undefined &&
    location.state.child_record_id !== undefined
  )
    draft_record_id = location.state.child_record_id; //pass record_id from parent
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
  let breadcrumbs = [
    {link: ROUTES.INDEX, title: 'Home'},
    {link: ROUTES.NOTEBOOK_LIST, title: 'Notebooks'},
    {
      link: ROUTES.NOTEBOOK + project_id,
      title: project_info !== null ? project_info.name : project_id,
    },
    {title: 'Draft'},
  ];

  // add parent link back for the parent or linked record
  if (
    location.state !== undefined &&
    location.state.parent_record_id !== record_id
  ) {
    const type =
      location.state.type === 'Child'
        ? 'Parent'
        : location.state.relation_type_vocabPair[0];
    breadcrumbs = [
      {link: ROUTES.INDEX, title: 'Home'},
      {link: ROUTES.NOTEBOOK_LIST, title: 'Notebooks'},
      {
        link: ROUTES.NOTEBOOK + project_id,
        title: project_info !== null ? project_info.name : project_id,
      },
      {
        link: ROUTES.NOTEBOOK + location.state.parent_link,
        title: type + ':' + location.state.parent_record_id,
      },
      {title: 'Draft'},
    ];
  }

  return (
    <React.Fragment>
      <Box>
        <Breadcrumbs data={breadcrumbs} />
        {draft_id === undefined || record_id === undefined ? (
          <DraftCreate
            project_id={project_id}
            type_name={type_name}
            state={location.state}
            record_id={draft_record_id}
          />
        ) : (
          <DraftEdit
            project_info={project_info}
            project_id={project_id}
            type_name={type_name}
            draft_id={draft_id}
            record_id={record_id}
            state={location.state}
          />
        )}
      </Box>
    </React.Fragment>
  );
}
