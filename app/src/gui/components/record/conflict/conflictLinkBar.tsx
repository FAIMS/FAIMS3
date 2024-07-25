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
 * Filename: conflicttoolbar.tsx
 * Description:
 *   File contains tools in Conflict Tab
 *    - includes Droplist bar, InfoDialog, Help Dialog
 */
import * as React from 'react';
import {Grid, Typography, Box, Alert} from '@mui/material';
import RecordLinkComponent from '../relationships/record_links';
import {RecordLinkProps} from '../relationships/types';
import {Accordion, AccordionSummary, AccordionDetails} from '../accordion';
import LinkIcon from '@mui/icons-material/Link';
import {grey} from '@mui/material/colors';
import getLocalDate from '../../../fields/LocalDate';
type conflictLinkBarProps = {
  conflictA: any;
  conflictB: any;
  choosenconflict: any;
  linksA: RecordLinkProps[] | null;
  linksB: RecordLinkProps[] | null;
  mergedLinks: RecordLinkProps[] | null;
  record_id: string;
};

const cardgridstyle = {
  backgroundColor: 'white',
  paddingTop: '20px',
};

function get_updated_by(conflict: any) {
  let updated_by = '';

  if (conflict.updated !== undefined) {
    updated_by = getLocalDate(conflict.updated).replace('T', ' ');
  }
  return updated_by;
}
export default function ConflictLinkBar(props: conflictLinkBarProps) {
  const isdisplay =
    (props.linksA !== null && props.linksA.length > 0) ||
    (props.linksB !== null && props.linksB.length > 0) ||
    (props.mergedLinks !== null && props.mergedLinks.length > 0)
      ? true
      : false;
  return isdisplay ? (
    <Accordion defaultExpanded={true}>
      <AccordionSummary
        aria-controls="links-accordion-content"
        id="links-accordion"
      >
        <LinkIcon sx={{mr: 1}} />
        <Typography>Links</Typography>
      </AccordionSummary>
      <AccordionDetails
        sx={{backgroundColor: grey[100], p: {xs: 0, sm: 1, md: 2}}}
      >
        <ConflictLinkComponent
          conflictA={props.conflictA}
          conflictB={props.conflictB}
          linksA={props.linksA}
          linksB={props.linksB}
          record_id={props.record_id}
          mergedLinks={props.mergedLinks}
          choosenconflict={props.choosenconflict}
        />
      </AccordionDetails>
    </Accordion>
  ) : (
    <></>
  );
}
function ConflictLinkComponent(props: conflictLinkBarProps) {
  return (
    <Box pt={2}>
      <Alert severity={'info'}>
        Links to this record. It will be auto merged when conflict resolution
        been saved.
      </Alert>
      <br />
      <Grid
        container
        style={{
          minHeight: '200px',
          minWidth: '960px',
          overflowX: 'auto',
        }}
        columns={14}
      >
        <ConflictGridComponent
          links={props.linksA}
          conflict={props.conflictA}
          record_id={props.record_id}
        />
        <Grid item sm={1} xs={1} md={1}></Grid>
        <ConflictGridComponent
          links={props.mergedLinks}
          conflict={props.choosenconflict}
          record_id={props.record_id}
        />
        <Grid item sm={1} xs={1} md={1}></Grid>
        <ConflictGridComponent
          links={props.linksB}
          conflict={props.conflictB}
          record_id={props.record_id}
        />
      </Grid>
      <br />
      <Alert severity={'info'}>
        Please resolve links from fields in this record in fields.
      </Alert>
    </Box>
  );
}
type ConflictGridComponentProps = {
  links: RecordLinkProps[] | null;
  record_id: string;
  conflict: any;
};
function ConflictGridComponent(props: ConflictGridComponentProps) {
  return (
    <Grid item sm={4} xs={4} md={4} style={cardgridstyle}>
      <Grid style={{minHeight: 200}}>
        {
          <RecordLinkComponent
            record_links={props.links ?? []}
            record_id={props.record_id}
            handleSetSection={() => console.log('click')}
            isconflict={true}
          />
        }
      </Grid>
      <Grid
        style={{padding: '5px 10px'}}
        container
        justifyContent="flex-end"
        alignItems="flex-end"
      >
        <Typography variant="caption" color="text.secondary">
          Last updated by: {props.conflict.updated_by}
        </Typography>
        <br />
      </Grid>
      <Grid
        style={{padding: '5px 10px'}}
        container
        justifyContent="flex-end"
        alignItems="flex-end"
      >
        <Typography variant="caption" color="text.secondary">
          {get_updated_by(props.conflict)}
        </Typography>
      </Grid>
    </Grid>
  );
}
