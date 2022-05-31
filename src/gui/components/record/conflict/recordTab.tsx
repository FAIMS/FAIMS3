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
 *   TODO
 */

import React from 'react';

import {ProjectUIModel} from '../../../../datamodel/ui';
import {Tab} from '@mui/material';
import TabList from '@mui/lab/TabList';
import Badge from '@mui/material/Badge';

type recordTabProps = {
  ui_specification: ProjectUIModel;
  handleChange: any;
  type: string;
  conflictfields: Array<string>;
};
// /{
//   <Badge badgeContent={2} color="error">
//     {'Conflicts  '}
//     {'\xa0\xa0'}
//   </Badge>
// }

function getConflictnumber(
  ui_specification: ProjectUIModel,
  view: string,
  conflictfields: Array<string>
) {
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
  //num[tab]===0?ui_specification['views'][tab]['label']:
  // <Badge badgeContent={num[tab]} color="error">
  // {ui_specification['views'][tab]['label']}
  // {'\xa0\xa0'}
  // </Badge>
  return (
    <TabList onChange={handleChange} aria-label="Record Tab">
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
