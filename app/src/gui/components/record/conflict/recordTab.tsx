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
 * Filename: RecordTabBar.tsx
 * Description:
 *   Tabs for section of record form , show conflict number if in Conflicts Tab, used in record Edit, Conflicts Tab, View Tab
 *   Draft use Steppers instead of Tab
 */

import React from 'react';

import {ProjectUIModel} from 'faims3-datamodel';
import {Tab} from '@mui/material';
import TabList from '@mui/lab/TabList';
import Badge from '@mui/material/Badge';

type recordTabProps = {
  ui_specification: ProjectUIModel;
  handleChange: any;
  type: string;
  conflictfields: Array<string>;
};

function getConflictnumber(
  ui_specification: ProjectUIModel,
  view: string,
  conflictfields: Array<string>
) {
  if (conflictfields.length === 0) return 0;
  let num = 0;
  ui_specification['views'][view]['fields'].map(field =>
    conflictfields.includes(field) ? (num = num + 1) : num
  );

  return num;
}

export default function RecordTabBar(props: recordTabProps) {
  const {ui_specification, handleChange, type, conflictfields} = props;
  const num: {[key: string]: number} = {};
  ui_specification['viewsets'][type]['views'].map(
    view =>
      (num[view] = getConflictnumber(ui_specification, view, conflictfields))
  );

  return (
    <TabList
      onChange={handleChange}
      aria-label="Record Tab"
      variant="scrollable"
      style={{backgroundColor: 'white'}}
    >
      {ui_specification['viewsets'][type]['views'].map((tab, index) => (
        <Tab
          key={index + 'conflict_tab'}
          label={
            num[tab] === 0 ? (
              ui_specification['views'][tab]['label']
            ) : (
              <Badge badgeContent={num[tab]} color="error">
                {ui_specification['views'][tab]['label']}
                {'\xa0\xa0\xa0\xa0'}
              </Badge>
            )
          }
          value={index + ''}
        />
      ))}
    </TabList>
  );
}
