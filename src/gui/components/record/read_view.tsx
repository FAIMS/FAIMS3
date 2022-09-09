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
 * Filename: read_view.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {Box, Typography} from '@mui/material';
import RecordForm from './form';
import {ProjectID, RecordID, RevisionID} from '../../../datamodel/core';
import {ProjectUIModel} from '../../../datamodel/ui';
interface RecordReadViewProps {
  project_id: ProjectID;
  record_id: RecordID;
  // Might be given in the URL:
  revision_id: RevisionID;
  ui_specification: ProjectUIModel;
  conflictfields?: string[] | null;
  handleChangeTab?: any;
  metaSection?: any;
  draft_id?: string;
  handleSetIsDraftSaving: Function;
  handleSetDraftLastSaved: Function;
  handleSetDraftError: Function;
}
export default function RecordReadView(props: RecordReadViewProps) {
  /**
   * Record read-only view.
   * TODO Kate - this is just a placeholder.
   * RecordForm is overkill here (as we're in a read-only state and don't need all the functionality that RecordForm provides).
   * A quick read-only view of the form data is needed (no draft, state and submitting logic)
   */
  return (
    <Box style={{border: 'solid 1px red'}} mb={2}>
      <Typography variant={'overline'} component={'div'}>
        Record data
      </Typography>
      <RecordForm
        project_id={props.project_id}
        record_id={props.record_id}
        revision_id={props.revision_id}
        ui_specification={props.ui_specification}
        draft_id={props.draft_id}
        metaSection={props.metaSection}
        disabled={true}
        handleSetIsDraftSaving={props.handleSetIsDraftSaving}
        handleSetDraftLastSaved={props.handleSetDraftLastSaved}
        handleSetDraftError={props.handleSetDraftError}
      />
    </Box>
  );
}
