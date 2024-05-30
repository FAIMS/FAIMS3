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
import {
  Navigate,
  useNavigate,
  useParams,
  useLocation,
  Location,
} from 'react-router-dom';

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
import {generateFAIMSDataID} from 'faims3-datamodel';
import {getProjectInfo, listenProjectInfo} from '../../databaseAccess';
import {ProjectID, RecordID} from 'faims3-datamodel';
import {
  ProjectUIModel,
  ProjectInformation,
  SectionMeta,
} from 'faims3-datamodel';
import {
  getUiSpecForProject,
  getReturnedTypesForViewSet,
} from '../../uiSpecification';
import RecordDelete from '../components/notebook/delete';
import {newStagedData} from '../../sync/draft-storage';
import Breadcrumbs from '../components/ui/breadcrumbs';
import RecordForm from '../components/record/form';
import {useEventedPromise, constantArgsShared} from '../pouchHook';
import {getProjectMetadata} from '../../projectMetadata';
import UnpublishedWarning from '../components/record/unpublished_warning';
import DraftSyncStatus from '../components/record/sync_status';
import {grey} from '@mui/material/colors';
import useMediaQuery from '@mui/material/useMediaQuery';
import {useTheme} from '@mui/material/styles';
import {ParentLinkProps} from '../components/record/relationships/types';
import {getParentPersistenceData} from '../components/record/relationships/RelatedInformation';
import InheritedDataComponent from '../components/record/inherited_data';

interface DraftCreateProps {
  project_id: ProjectID;
  type_name: string;
  state?: any;
  record_id: string;
  location?: Location;
}

// There is a problem here due to the side-effect of creating a new
// draft (newStagedData) in the useEffect below. This is supposed to be
// a UI rendering action but is side-effecting to the database
// when it is run in strict mode, two drafts are created because of the
// double render.  One is left behind after later cleanup fails to see the
// duplicate.

// Really this operation of creating a draft record should not be part of
// a UI component lifecycle.   The draft should be made by some action and
// then the UI created for that (DraftEdit).

function DraftCreate(props: DraftCreateProps) {
  const {project_id, type_name, record_id} = props;

  const {dispatch} = useContext(store);
  const navigate = useNavigate();

  const [error, setError] = useState(null as null | {});
  const [draft_id, setDraft_id] = useState(null as null | string);
  const [uiSpec, setUISpec] = useState(null as null | ProjectUIModel);

  useEffect(() => {
    getUiSpecForProject(project_id).then(setUISpec, setError);
  }, [project_id]);

  useEffect(() => {
    if (uiSpec !== null) {
      // don't make a new draft if we already have one
      if (draft_id === null) {
        const field_types = getReturnedTypesForViewSet(uiSpec, type_name);
        newStagedData(project_id, null, type_name, field_types, record_id).then(
          setDraft_id,
          setError
        );
      }
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
    navigate(-1);
    return <React.Fragment />;
  } else if (draft_id === null) {
    // Creating new draft loading
    return <CircularProgress size={12} thickness={4} />;
  } else {
    return (
      <Navigate
        to={
          ROUTES.NOTEBOOK +
          project_id +
          ROUTES.RECORD_CREATE +
          type_name +
          ROUTES.RECORD_DRAFT +
          draft_id +
          ROUTES.RECORD_RECORD +
          record_id
        }
        state={props.state}
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
  location?: Location;
}

function DraftEdit(props: DraftEditProps) {
  const {project_id, type_name, draft_id, project_info, record_id} = props;
  const {dispatch} = useContext(store);
  const navigate = useNavigate();
  const [uiSpec, setUISpec] = useState(null as null | ProjectUIModel);
  const [error, setError] = useState(null as null | {});

  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [draftLastSaved, setDraftLastSaved] = useState(null as Date | null);
  const [draftError, setDraftError] = useState(null as string | null);

  const [metaSection, setMetaSection] = useState(null as null | SectionMeta);
  const [value, setValue] = React.useState('1');
  const theme = useTheme();
  const is_mobile = !useMediaQuery(theme.breakpoints.up('sm'));
  const mq_above_md = useMediaQuery(theme.breakpoints.up('md'));
  const [parentLinks, setParentLinks] = useState([] as ParentLinkProps[]);
  const [is_link_ready, setIs_link_ready] = useState(false);

  useEffect(() => {
    getUiSpecForProject(project_id).then(setUISpec, setError);
    if (project_id !== null) {
      getProjectMetadata(project_id, 'sections').then(res =>
        setMetaSection(res)
      );
    }
  }, [project_id]);

  useEffect(() => {
    (async () => {
      if (
        uiSpec !== null &&
        props.state &&
        props.state.parent_record_id &&
        props.state.parent_record_id !== record_id &&
        props.state.type !== undefined &&
        props.state.type === 'Child'
      ) {
        setIs_link_ready(false);
        const parent = {
          parent: {
            record_id: props.state.parent_record_id,
            field_id: props.state.field_id,
            relation_type_vocabPair: props.state.relation_type_vocabPair,
          },
        };
        const newParent = await getParentPersistenceData(
          uiSpec,
          project_id,
          parent,
          record_id
        );
        setParentLinks(newParent);
        setIs_link_ready(true);
      } else {
        setIs_link_ready(true);
      }
    })();
  }, [project_id, record_id, uiSpec]);

  const handleChange = (event: React.ChangeEvent<{}>, newValue: string) => {
    setValue(newValue);
  };

  const handleRefresh = () => {
    /**
     * Handler for Refreshing project (go back to notebook)
     */
    return new Promise(resolve => {
      resolve(() => {
        navigate({
          pathname: ROUTES.NOTEBOOK + project_id,
        });
      });
    });
  };

  if (error !== null) {
    dispatch({
      type: ActionType.ADD_ALERT,
      payload: {
        message: 'Could not edit draft: ' + error.toString(),
        severity: 'warning',
      },
    });
    navigate(-1);
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
            <TabPanel value="1" sx={{p: 0}}>
              <Box>
                <UnpublishedWarning />
                <DraftSyncStatus
                  last_saved={draftLastSaved}
                  is_saving={isDraftSaving}
                  error={draftError}
                />
                <Box
                  sx={{backgroundColor: grey[100], p: {xs: 0, sm: 1, md: 2}}}
                >
                  <Box
                    component={Paper}
                    elevation={0}
                    p={{xs: 1, sm: 1, md: 2, lg: 2}}
                    variant={is_mobile ? undefined : 'outlined'}
                  >
                    {is_link_ready ? (
                      <InheritedDataComponent
                        parentRecords={parentLinks}
                        ui_specification={uiSpec}
                      />
                    ) : (
                      <CircularProgress size={24} />
                    )}
                    <RecordForm
                      project_id={project_id}
                      record_id={record_id}
                      type={type_name}
                      ui_specification={uiSpec}
                      draft_id={draft_id}
                      metaSection={metaSection}
                      handleSetIsDraftSaving={setIsDraftSaving}
                      handleSetDraftLastSaved={setDraftLastSaved}
                      handleSetDraftError={setDraftError}
                      draftLastSaved={draftLastSaved}
                      mq_above_md={mq_above_md}
                      navigate={navigate}
                      location={props.location}
                    />
                  </Box>
                </Box>
              </Box>
            </TabPanel>
            <TabPanel value="2">
              <Box mt={2}>
                <Typography variant={'h5'} gutterBottom>
                  Discard Draft
                </Typography>
                <RecordDelete
                  project_id={project_id}
                  record_id={record_id}
                  revision_id={null}
                  draft_id={draft_id}
                  show_label={true}
                  handleRefresh={handleRefresh}
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
  if (location.state && location.state.child_record_id !== undefined)
    draft_record_id = location.state.child_record_id; //pass record_id from parent
  let project_info: ProjectInformation | null;

  try {
    project_info = useEventedPromise(
      'RecordCreate page',
      getProjectInfo,
      constantArgsShared(listenProjectInfo, project_id!),
      false,
      [project_id],
      project_id!
    ).expect();
  } catch (err: any) {
    if (err.message !== 'missing') {
      throw err;
    } else {
      return <Navigate to="/404" />;
    }
  }
  let breadcrumbs = [
    // {link: ROUTES.INDEX, title: 'Home'},
    {link: ROUTES.NOTEBOOK_LIST, title: 'Notebooks'},
    {
      link: ROUTES.NOTEBOOK + project_id,
      title: project_info !== null ? project_info.name! : project_id!,
    },
    {title: 'Draft'},
  ];

  // add parent link back for the parent or linked record
  if (location.state && location.state.parent_record_id !== record_id) {
    const type =
      location.state.type === 'Child'
        ? 'Parent'
        : location.state.relation_type_vocabPair[0];
    breadcrumbs = [
      // {link: ROUTES.INDEX, title: 'Home'},
      {link: ROUTES.NOTEBOOK_LIST, title: 'Notebooks'},
      {
        link: ROUTES.NOTEBOOK + project_id,
        title: project_info !== null ? project_info.name! : project_id!,
      },
      {
        link: ROUTES.NOTEBOOK + location.state.parent_link,
        title:
          type! + ':' + location.state.parent_hrid! ??
          location.state.parent_record_id!,
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
            project_id={project_id!}
            type_name={type_name!}
            state={location.state}
            record_id={draft_record_id}
            location={location}
          />
        ) : (
          <DraftEdit
            project_info={project_info}
            project_id={project_id!}
            type_name={type_name!}
            draft_id={draft_id}
            record_id={record_id}
            state={location.state}
            location={location}
          />
        )}
      </Box>
    </React.Fragment>
  );
}
