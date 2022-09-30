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

import {Box, Divider} from '@mui/material';
import Tab from '@mui/material/Tab';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';

import {RelationshipsComponentProps} from './types';

import ParentLinkComponent from './parent_links';
import RelatedLinksComponent from './related_links';
import ChildLinksComponent from './child_links';
import BoxTab from '../../ui/boxTab';
import {grey} from '@mui/material/colors';
import CreateLinkComponent from './create_links';
const relationship_types = [
  {link: 'is below', reciprocal: 'is above'},
  {link: 'is above', reciprocal: 'is below'},
  {link: 'is related to', reciprocal: 'is related to'},
  {link: 'is parent of', reciprocal: 'is child of'},
];

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
    <Box mb={2}>
      <ParentLinkComponent parent_links={props.parent_links} />
      <ChildLinksComponent
        child_links={props.child_links}
        show_title={true}
        show_link_type={true}
        show_section={true}
        show_field={true}
      />
      <RelatedLinksComponent
        related_links={props.related_links}
        show_title={true}
        show_link_type={true}
        show_section={true}
        show_field={true}
      />

      <BoxTab
        title={'Field-level links interface (to be moved)'}
        bgcolor={grey[100]}
      />
      <Box bgcolor={grey[100]} p={2} style={{overflowX: 'scroll'}}>
        <CreateLinkComponent relationship_types={relationship_types} />
        <TabContext value={value}>
          <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
            <TabList
              onChange={handleChange}
              aria-label="Field children related tab"
            >
              <Tab label="Children" value="1" />
              <Tab label="Related" value="2" />
            </TabList>
          </Box>
          <TabPanel value="1" sx={{p: 0}}>
            <ChildLinksComponent
              child_links={props.child_links}
              show_title={false}
              show_link_type={false}
              show_section={false}
              show_field={false}
            />
          </TabPanel>
          <TabPanel value="2" sx={{p: 0}}>
            <RelatedLinksComponent
              related_links={props.related_links}
              show_title={false}
              show_link_type={false}
              show_section={false}
              show_field={false}
            />
          </TabPanel>
        </TabContext>
      </Box>
    </Box>
  );
}
