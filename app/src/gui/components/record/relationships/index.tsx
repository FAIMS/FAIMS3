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
 * Filename: relationships/index.tsx
 * Description:
 *   TODO
 */

import React from 'react';

import {RelationshipsComponentProps} from './types';

import RecordLinkComponent from './record_links';
import Typography from '@mui/material/Typography';
import {Accordion, AccordionSummary, AccordionDetails} from '../accordion';
import LinkIcon from '@mui/icons-material/Link';

import {grey} from '@mui/material/colors';

export default function RelationshipsViewComponent(
  props: RelationshipsComponentProps
) {
  /**
   * Display the parent, child and related records associated with the current record
   * Row click to go to child record
   * Data Grid is set to autoHeight (grid will size according to its content) up to 5 rows
   *
   *
   */

  return (
    <Accordion>
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
        <RecordLinkComponent
          record_links={props.record_to_field_links}
          record_id={props.record_id}
          handleSetSection={props.handleSetSection}
          handleUnlink={props.handleUnlink}
        />
      </AccordionDetails>
    </Accordion>
  );
}
