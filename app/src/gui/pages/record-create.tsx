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

import {generateFAIMSDataID, ProjectID, RecordID} from '@faims3/data-model';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  Grid,
  Paper,
} from '@mui/material';
import {grey} from '@mui/material/colors';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import React, {useEffect, useRef, useState} from 'react';
import {
  Location,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import {NOTEBOOK_NAME_CAPITALIZED} from '../../buildconfig';
import * as ROUTES from '../../constants/routes';
import {compiledSpecService} from '../../context/slices/helpers/compiledSpecService';
import {Project, selectProjectById} from '../../context/slices/projectSlice';
import {addAlert} from '../../context/slices/syncSlice';
import {useAppDispatch, useAppSelector} from '../../context/store';
import {newStagedData} from '../../sync/draft-storage';
import {getReturnedTypesForViewSet} from '../../uiSpecification';
import ProgressBar from '../components/progress-bar';
import RecordForm from '../components/record/form';
import InheritedDataComponent from '../components/record/inherited_data';
import {getParentPersistenceData} from '../components/record/relationships/RelatedInformation';
import {ParentLinkProps} from '../components/record/relationships/types';
import DraftSyncStatus from '../components/record/sync_status';
import BackButton from '../components/ui/BackButton';
import Breadcrumbs from '../components/ui/breadcrumbs';

interface DraftCreateActionProps {
  project_id: ProjectID;
  serverId: string;
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

function DraftCreateAction(props: DraftCreateActionProps) {
  const {project_id, type_name, record_id, serverId} = props;

  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [error, setError] = useState(null as null | {});
  const [draft_id, setDraft_id] = useState(null as null | string);

  const uiSpecId = useAppSelector(state =>
    selectProjectById(state, project_id)
  )?.uiSpecificationId;
  const uiSpec = uiSpecId ? compiledSpecService.getSpec(uiSpecId) : undefined;

  useEffect(() => {
    if (uiSpec) {
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
    dispatch(
      addAlert({
        message: 'Could not create a draft: ' + error.toString(),
        severity: 'warning',
      })
    );
    navigate(-1);
    return <React.Fragment />;
  } else if (draft_id === null) {
    // Creating new draft loading
    return <CircularProgress size={12} thickness={4} />;
  } else {
    return (
      <Navigate
        to={
          ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE +
          serverId +
          '/' +
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

interface DraftRecordEditProps {
  type_name: string;
  draft_id: string;
  project: Project;
  record_id: RecordID;
  serverId: string;
  state?: any;
  location?: Location;
  onBack: () => void;
}

function DraftRecordEdit(props: DraftRecordEditProps) {
  const {type_name, project, draft_id, record_id, serverId} = props;
  const project_id = project.projectId;
  const navigate = useNavigate();
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [draftLastSaved, setDraftLastSaved] = useState<Date | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const theme = useTheme();
  const is_mobile = !useMediaQuery(theme.breakpoints.up('sm'));
  const mq_above_md = useMediaQuery(theme.breakpoints.up('md'));
  const [parentLinks, setParentLinks] = useState<ParentLinkProps[]>([]);
  const [is_link_ready, setIs_link_ready] = useState(false);
  const [progress, setProgress] = useState(0);
  const buttonRef = useRef<HTMLDivElement | null>(null);

  const uiSpecId = useAppSelector(state =>
    selectProjectById(state, project_id)
  )?.uiSpecificationId;
  const uiSpec = uiSpecId ? compiledSpecService.getSpec(uiSpecId) : undefined;

  useEffect(() => {
    (async () => {
      if (
        !!uiSpec &&
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
        const newParent = await getParentPersistenceData({
          uiSpecification: uiSpec,
          projectId: project_id,
          parent,
          serverId,
        });
        setParentLinks(newParent);
        setIs_link_ready(true);
      } else {
        setIs_link_ready(true);
      }
    })();
  }, [project_id, record_id, uiSpec]);

  if (!uiSpec) return <CircularProgress size={12} thickness={4} />;

  return (
    <React.Fragment>
      <Grid container justifyContent={'space-between'} spacing={2}>
        <Grid item>
          <BackButton label="Back" onClick={props.onBack} />
        </Grid>
        <Grid item xs>
          <ProgressBar percentage={progress} />
        </Grid>
        <Grid item>
          <DraftSyncStatus
            last_saved={draftLastSaved}
            is_saving={isDraftSaving}
            error={draftError}
          />
        </Grid>
      </Grid>
      <Box>
        <Box sx={{backgroundColor: grey[100], p: {xs: 0, sm: 1, md: 2}}}>
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
              serverId={project.serverId}
              project_id={project_id}
              record_id={record_id}
              type={type_name}
              ui_specification={uiSpec}
              draft_id={draft_id}
              handleSetIsDraftSaving={setIsDraftSaving}
              handleSetDraftLastSaved={setDraftLastSaved}
              handleSetDraftError={setDraftError}
              draftLastSaved={draftLastSaved}
              mq_above_md={mq_above_md}
              navigate={navigate}
              location={props.location}
              setProgress={setProgress}
              buttonRef={buttonRef}
            />
          </Box>
        </Box>
      </Box>
    </React.Fragment>
  );
}

export default function RecordCreate() {
  const params = useParams<{
    serverId: string;
    projectId: ProjectID;
    typeName: string;
    draftId?: string;
    recordId?: string;
  }>();
  const {serverId, projectId, typeName, draftId, recordId} = params;
  const location = useLocation();
  const navigate = useNavigate();

  if (!serverId) return <></>;
  const project = useAppSelector(state =>
    projectId ? selectProjectById(state, projectId) : undefined
  );
  if (!project) return <></>;

  const [openDialog, setOpenDialog] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleConfirmNavigation = () => {
    setOpenDialog(false);
    navigate(ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE + serverId + '/' + projectId, {
      replace: true,
    });
  };

  let draft_record_id = generateFAIMSDataID();
  if (recordId !== undefined) draft_record_id = recordId;
  if (location.state && location.state.child_record_id !== undefined)
    draft_record_id = location.state.child_record_id; //pass record_id from parent

  let showBreadcrumbs = false;

  const breadcrumbs = [
    // {link: ROUTES.INDEX, title: 'Home'},
    {link: ROUTES.NOTEBOOK_LIST_ROUTE, title: `${NOTEBOOK_NAME_CAPITALIZED}s`},
    {
      link: ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE + serverId + '/' + projectId,
      title: project !== null ? project.metadata.name : projectId!,
    },
    {title: 'Draft'},
  ];

  // add parent link back for the parent or linked record
  if (location.state && location.state.parent_record_id !== recordId) {
    showBreadcrumbs = true;
    const type =
      location.state.type === 'Child'
        ? 'Parent'
        : location.state.relation_type_vocabPair[0];
    breadcrumbs.splice(-1, 0, {
      link: ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE + location.state.parent_link,
      title:
        type! +
        ':' +
        (location.state.parent_hrid! ?? location.state.parent_record_id!),
    });
  }

  // detect when user click's android back buttn
  useEffect(() => {
    const handleBackEvent = (event: Event) => {
      event.preventDefault();
      setOpenDialog(true);
    };
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      setOpenDialog(true);
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBackEvent);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBackEvent);
    };
  }, []);

  return (
    <React.Fragment>
      <Box>
        {
          // only show breadcrumbs if we have parent record
        }
        {showBreadcrumbs && <Breadcrumbs data={breadcrumbs} />}
        {draftId === undefined || recordId === undefined ? (
          <DraftCreateAction
            serverId={serverId}
            project_id={projectId!}
            type_name={typeName!}
            state={location.state}
            record_id={draft_record_id}
            location={location}
          />
        ) : (
          <DraftRecordEdit
            onBack={() => setOpenDialog(true)}
            serverId={serverId}
            project={project}
            type_name={typeName!}
            draft_id={draftId}
            record_id={recordId}
            state={location.state}
            location={location}
          />
        )}
      </Box>
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
        PaperProps={{
          sx: {padding: 2},
        }}
        disableScrollLock={true}
      >
        <Alert severity="info">
          <AlertTitle>
            {' '}
            Are you sure you want to return to the record list?
          </AlertTitle>
          Your response is saved on your device as a draft. You can return to it
          later to complete this record.{' '}
        </Alert>

        <DialogActions
          sx={{
            justifyContent: 'space-between',
            padding: theme.spacing(2),
          }}
        >
          <Button
            onClick={handleCloseDialog}
            sx={{
              backgroundColor: theme.palette.dialogButton.cancel,
              color: theme.palette.dialogButton.dialogText,
              fontSize: isMobile ? '0.875rem' : '1rem',
              padding: isMobile ? '6px 12px' : '10px 20px',
              '&:hover': {
                backgroundColor: theme.palette.text.primary,
              },
            }}
          >
            Continue working
          </Button>
          <Button
            onClick={handleConfirmNavigation}
            // variant={'contained'}
            sx={{
              backgroundColor: theme.palette.dialogButton.confirm,
              color: theme.palette.dialogButton.dialogText,
              fontSize: isMobile ? '0.875rem' : '1rem',
              padding: isMobile ? '6px 12px' : '10px 20px',
              '&:hover': {
                backgroundColor: theme.palette.text.primary,
              },
            }}
          >
            Return to record list
          </Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
}
