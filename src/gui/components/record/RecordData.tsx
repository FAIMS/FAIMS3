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

import React from 'react';
import DraftSyncStatus from './sync_status';
import RelationshipsViewComponent from './relationships';
import {Accordion, AccordionSummary, AccordionDetails} from './accordion';
import RecordForm from './form';
import {ProjectID, RecordID, RevisionID} from 'faims3-datamodel';
import {ProjectUIModel} from 'faims3-datamodel';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {Box, Grid, Typography, Paper, Tab} from '@mui/material';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import {grey} from '@mui/material/colors';
import ListAltIcon from '@mui/icons-material/ListAlt';
import InheritedDataComponent from './inherited_data';
import {ParentLinkProps, RecordLinkProps} from './relationships/types';
import CircularProgress from '@mui/material/CircularProgress';
import {useNavigate} from 'react-router';
interface RecordDataTypes {
  project_id: ProjectID;
  record_id: RecordID;
  hrid?: string;
  record_type: string;
  revision_id: RevisionID;
  draft_id?: string;
  ui_specification: ProjectUIModel;
  conflictfields?: string[] | null;
  handleChangeTab: Function;
  metaSection?: any;
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
}

export default function RecordData(props: RecordDataTypes) {
  const [dataTab, setDataTab] = React.useState('1');
  const navigate = useNavigate();
  // const [revision_id, setRevision_id] = React.useState(props.revision_id);
  const [ViewName, setViewName] = React.useState(null);
  const handleDataTabChange = (
    event: React.SyntheticEvent,
    newValue: string
  ) => {
    setDataTab(newValue);
  };
  const theme = useTheme();
  const is_mobile = !useMediaQuery(theme.breakpoints.up('sm'));

  return (
    <Box bgcolor={grey[100]}>
      <TabContext value={dataTab}>
        <TabList onChange={handleDataTabChange}>
          <Tab label={'Data'} value={'1'} />
          <Tab label={'Review'} value={'2'} />
        </TabList>
        <TabPanel value={'1'} sx={{p: 0}}>
          {/* Show UnpublishWarning for unsaved revision ONLY  TODO: need to update when user click publish and continue*/}

          <DraftSyncStatus
            last_saved={props.draftLastSaved}
            is_saving={props.isDraftSaving}
            error={props.draftError}
          />
          {props.is_link_ready ? (
            <RelationshipsViewComponent
              record_to_field_links={props.record_to_field_links}
              record_id={props.record_id}
              record_hrid={props.hrid ?? props.record_id}
              record_type={props.record_type}
              handleSetSection={setViewName}
              handleUnlink={props.handleUnlink}
            />
          ) : (
            <CircularProgress size={24} />
          )}
          <Accordion defaultExpanded={true}>
            <AccordionSummary
              aria-controls="form-accordion-content"
              id="form-accordion"
            >
              <ListAltIcon sx={{mr: 1}} />
              <Typography>Form</Typography>
            </AccordionSummary>
            <AccordionDetails
              sx={{backgroundColor: grey[100], p: {xs: 0, sm: 1, md: 2}}}
            >
              <Grid
                container
                direction="row"
                justifyContent="flex-start"
                alignItems="stretch"
              >
                <Grid item lg={12}>
                  <Box
                    component={Paper}
                    elevation={0}
                    p={{xs: 1, sm: 1, md: 2, lg: 2}}
                    variant={is_mobile ? undefined : 'outlined'}
                  >
                    {props.is_link_ready ? (
                      <RecordForm
                        project_id={props.project_id}
                        record_id={props.record_id}
                        revision_id={props.revision_id}
                        ui_specification={props.ui_specification}
                        draft_id={props.draft_id}
                        metaSection={props.metaSection}
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
                      />
                    ) : (
                      <CircularProgress size={24} />
                    )}
                  </Box>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </TabPanel>
        <TabPanel value={'2'} sx={{p: 0}}>
          <InheritedDataComponent
            parentRecords={props.parentRecords}
            ui_specification={props.ui_specification}
          />
          <RelationshipsViewComponent
            record_to_field_links={props.record_to_field_links}
            record_id={props.record_id}
            record_hrid={props.hrid ?? props.record_id}
            record_type={props.record_type}
            handleSetSection={setViewName}
          />
          <Accordion defaultExpanded={true}>
            <AccordionSummary
              aria-controls="form-accordion-content"
              id="form-accordion"
            >
              <ListAltIcon sx={{mr: 1}} />
              <Typography>Form</Typography>
            </AccordionSummary>
            <AccordionDetails
              sx={{backgroundColor: grey[100], p: {xs: 0, sm: 1, md: 2}}}
            >
              <Grid
                container
                direction="row"
                justifyContent="flex-start"
                alignItems="stretch"
              >
                <Grid item lg={12}>
                  <Box
                    component={Paper}
                    elevation={0}
                    p={{xs: 1, sm: 1, md: 2, lg: 2}}
                    variant={is_mobile ? undefined : 'outlined'}
                  >
                    <RecordForm
                      project_id={props.project_id}
                      record_id={props.record_id}
                      revision_id={props.revision_id}
                      ui_specification={props.ui_specification}
                      draft_id={props.draft_id}
                      metaSection={props.metaSection}
                      disabled={true} // for view of the forms
                      handleSetIsDraftSaving={props.handleSetIsDraftSaving}
                      handleSetDraftLastSaved={props.handleSetDraftLastSaved}
                      handleSetDraftError={props.handleSetDraftError}
                      navigate={navigate}
                    />
                  </Box>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </TabPanel>
      </TabContext>
    </Box>
  );
}
