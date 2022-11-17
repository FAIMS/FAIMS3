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
 * Filename: ProjectBehaviour.tsx
 * Description:This is the file about Notebook behaviour, there is nothing in beta yet
 *   TODO:
 */

import {Grid, Typography} from '@mui/material';
import {FAIMShandlerType, BehaviourProperties} from '../../../../datamodel/ui';
/* eslint-disable @typescript-eslint/no-unused-vars */
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
type ProjectBehaviourProps = any;

export default function ProjectBehaviourTab(props: ProjectBehaviourProps) {
  const handleChange = () => {};

  const behaviours = [
    {
      label: 'Automatic Updates',
      helpText:
        'Automatically save changes the user makes as they occur.Automatically retrieve changes made by other users every 30s (if online)',
    },
    {
      label: 'Offline Use',
      helpText:
        'Allow users to add observations even when there is no internet connection. Changes will not be synced until the user is online again)',
    },
    {
      label: 'Store Content Offline',
      helpText: 'Make all images and files available offline',
    },
  ];

  const element = (
    behaviour: BehaviourProperties,
    handleChange: FAIMShandlerType
  ) => {
    return (
      <Grid container key={behaviour.label}>
        <Grid item sm={5} xs={10}>
          <Typography variant={'h6'} component={'h6'}>
            {behaviour.label}
          </Typography>
          <Typography>{behaviour.helpText}</Typography>
        </Grid>
        <Grid item sm={1} xs={1}>
          <br />
        </Grid>
        <Grid item sm={4} xs={1}>
          <CheckCircleIcon color="primary" />
          {/* <Switch
            disabled
            edge="end"
            onChange={handleChange}
            checked={true}
            inputProps={{
              'aria-labelledby': 'switch-',
            }}
          />*/}
        </Grid>
        <br />
        <br />
        <br />
        <br />
        <br />
      </Grid>
    );
  };

  return (
    <>
      {behaviours.map((behaviour: BehaviourProperties) =>
        element(behaviour, handleChange)
      )}
    </>
  );
}
