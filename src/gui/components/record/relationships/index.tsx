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

import {Box} from '@mui/material';

import {RelationshipsComponentProps} from './types';

import RecordLinkComponent from './record_links';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import Tab from '@mui/material/Tab';
import TabPanel from '@mui/lab/TabPanel';

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
  const [value, setValue] = React.useState('1');

  const handleChange = (event: React.SyntheticEvent, newValue: string) => {
    setValue(newValue);
  };
  return (
    <Box>
      <TabContext value={value}>
        <Box>
          <TabList
            onChange={handleChange}
            aria-label={'Field children links tabs'}
          >
            <Tab label={'Links to record'} value={'1'} />
            <Tab label={'Links to fields within record'} value={'2'} />
          </TabList>
        </Box>
        <TabPanel value={'1'} sx={{p: 0}}>
          <RecordLinkComponent
            record_links={props.related_records}
            is_field={false}
          />
        </TabPanel>
        <TabPanel value={'2'} sx={{p: 0}}>
          <RecordLinkComponent
            record_links={props.related_links_from_fields}
            is_field={true}
          />
        </TabPanel>
      </TabContext>
    </Box>
  );
}
