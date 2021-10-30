/*
 * Copyright 2021 Macquarie University
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
 * Description:This is the file about Notebook Behavoiur
 *   TODO:
 */

import {
  Grid,
  Typography,
  Switch,
} from '@material-ui/core';
import {
  ProjevtValueList,
  FAIMShandlerType,
  BehaviourProperties,
  } from '../../../../datamodel/ui'


type ProjectBehaviourProps = any;

export default function ProjectBehaviourTab(props: ProjectBehaviourProps) {
  const {project_id, setProjectValue, projectvalue, ...others} = props;

  const handleChange = () => {};

  const handleSubmit = () => {};

  const behaviours = [
    {
      label: 'Automatic Updates',
      helpText:
        'Automatically save changes the user makes as they occur.Automatically retrive changes made by other users every 30s (if online)',
    },
    {
      label: 'Offline Use',
      helpText:
        'Allow users to add observations even when there is no internet connection. Changes will not be synced until the user is online again)',
    },
    {
      label: 'Store Contenet Offline',
      helpText: 'Make all images and fiels avaliable offline',
    }];


  const belement = (behaviour: BehaviourProperties , handleChange: FAIMShandlerType) => {
    return (
      <Grid container>
        <Grid item sm={4} xs={1}>
          <Typography variant={'h6'} component={'h6'}>
            {behaviour.label}
          </Typography>
          <Typography>{behaviour.helpText}</Typography>
        </Grid>
        <Grid item sm={4} xs={1}>
          <Switch
            disabled
            edge="end"
            onChange={handleChange}
            checked={true}
            inputProps={{
              'aria-labelledby': 'switch-',
            }}
          />
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
        belement(behaviour, handleChange)
      )}
    </>
  );
}
