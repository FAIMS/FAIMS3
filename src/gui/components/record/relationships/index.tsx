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
import LinkedRecords from './linked_records';
import ChildRecords from './child_records';
import ParentRecords from './parent_records';

export default function RelationshipsComponent(
  props: RelationshipsComponentProps
) {
  /**
   * Display the child records associated with a records in a MUI Data Grid.
   * Row click to go to child record
   * Data Grid is set to autoHeight (grid will size according to its content) up to 5 rows
   *
   *
   */
  // TODO these are defined... on the notebook?
  const relationship_types = [
    {link: 'is below', reciprocal: 'is above'},
    {link: 'is above', reciprocal: 'is below'},
    {link: 'is related to', reciprocal: 'is related to'},
  ];
  return (
    <Box mb={2}>
      <ChildRecords child_records={props.child_records} />
      <ParentRecords parent_records={props.parent_records} />
      <LinkedRecords
        linked_records={props.linked_records}
        relationships={relationship_types}
      />
    </Box>
  );
}
