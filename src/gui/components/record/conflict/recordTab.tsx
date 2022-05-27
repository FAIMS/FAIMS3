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

type recordTabProps = {
  ui_specification: ProjectUIModel;
  handleChange: any;
  type: string;
};

export default function RecordTabBar(props: recordTabProps) {
  const {ui_specification, handleChange, type} = props;
  return (
    <TabList onChange={handleChange} aria-label="Record Tab">
      {ui_specification['viewsets'][type]['views'].map((tab, index) => (
        <Tab
          key={index + 'conflict_tab'}
          label={ui_specification['views'][tab]['label']}
          value={index + ''}
        />
      ))}
    </TabList>
  );
}
