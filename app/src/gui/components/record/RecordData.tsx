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
 * Filename: view.tsx
 * Description:
 *   TODO
 *   20220620 BBS Adjusted sm to 11 from 8 to get rid of the awful margin reported in FAIMS3-328
 */

import {
  ProjectID,
  ProjectUIModel,
  RecordID,
  RevisionID,
} from '@faims3/data-model';
import {Box} from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import {grey} from '@mui/material/colors';
import React from 'react';
import {useNavigate} from 'react-router-dom';
import RecordForm from './form';
import RelationshipsViewComponent from './relationships';
import {ParentLinkProps, RecordLinkProps} from './relationships/types';
import DraftSyncStatus from './sync_status';
interface RecordDataTypes {
  project_id: ProjectID;
  serverId: string;
  record_id: RecordID;
  hrid?: string;
  record_type: string;
  revision_id: RevisionID;
  draft_id?: string;
  ui_specification: ProjectUIModel;
  conflictfields?: string[] | null;
  handleChangeTab: Function;
  isSyncing?: string;
  disabled?: boolean;
  isDraftSaving: boolean;
  draftLastSaved: Date | null;
  draftError: string | null;
  handleSetIsDraftSaving: Function;
  handleSetDraftLastSaved: Function;
  handleSetDraftError: Function;
  parentRecords: Array<ParentLinkProps> | null;
  record_to_field_links: RecordLinkProps[];
  is_link_ready: boolean;
  handleUnlink: Function;
  setRevision_id?: Function;
  mq_above_md: boolean;
  setProgress: React.Dispatch<React.SetStateAction<number>>;
  buttonRef: React.RefObject<HTMLDivElement>;
}

export default function RecordData(props: RecordDataTypes) {
  const navigate = useNavigate();
  // const [revision_id, setRevision_id] = React.useState(props.revision_id);
  const [ViewName, setViewName] = React.useState(null);

  return (
    <Box bgcolor={grey[100]}>
      <DraftSyncStatus
        last_saved={props.draftLastSaved}
        is_saving={props.isDraftSaving}
        error={props.draftError}
      />
      {props.is_link_ready ? (
        props.record_to_field_links.length > 0 && (
          <RelationshipsViewComponent
            record_to_field_links={props.record_to_field_links}
            record_id={props.record_id}
            record_hrid={props.hrid ?? props.record_id}
            record_type={props.record_type}
            handleSetSection={setViewName}
            handleUnlink={props.handleUnlink}
          />
        )
      ) : (
        <CircularProgress size={24} />
      )}
      <RecordForm
        serverId={props.serverId}
        project_id={props.project_id}
        record_id={props.record_id}
        revision_id={props.revision_id}
        ui_specification={props.ui_specification}
        draft_id={props.draft_id}
        handleChangeTab={props.handleChangeTab}
        conflictfields={props.conflictfields}
        isSyncing={props.isSyncing}
        handleSetIsDraftSaving={props.handleSetIsDraftSaving}
        handleSetDraftLastSaved={props.handleSetDraftLastSaved}
        handleSetDraftError={props.handleSetDraftError}
        setRevision_id={props.setRevision_id}
        ViewName={ViewName}
        draftLastSaved={props.draftLastSaved}
        mq_above_md={props.mq_above_md}
        navigate={navigate}
        setProgress={props.setProgress}
        buttonRef={props.buttonRef}
      />
    </Box>
  );
}
