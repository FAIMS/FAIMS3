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
 * Filename: sync.tsx
 * Description:
 * This provides a react component to manage the syncing state of a specific
 * project via a toggle.
 */
import React, {useContext, useEffect, useState} from 'react';
import {
  Box,
  Switch,
  FormControlLabel,
  FormHelperText,
  Typography,
} from '@mui/material';

import {ProjectInformation} from '../../../../datamodel/ui';
import {
  isSyncingProject,
  setSyncingProject,
  listenSyncingProject,
} from '../../../../sync/sync-toggle';
import {store} from '../../../../context/store';
import {ActionType} from '../../../../context/actions';

type NotebookSyncSwitchProps = {
  project: ProjectInformation;
};

export default function NotebookSyncSwitch(props: NotebookSyncSwitchProps) {
  const {project} = props;
  const {dispatch} = useContext(store);
  const [isSyncing, setIsSyncing] = useState(
    isSyncingProject(project.project_id)
  );

  useEffect(() => {
    return listenSyncingProject(project.project_id, setIsSyncing);
  }, [project.project_id]);

  return (
    <Box p={1}>
      <FormControlLabel
        control={
          <Switch
            checked={isSyncing}
            onChange={async (event, checked) => {
              await setSyncingProject(project.project_id, checked);
              if (checked) {
                dispatch({
                  type: ActionType.ADD_ALERT,
                  payload: {
                    message: `Enabling data sync for notebook  ${project.name}`,
                    severity: 'success',
                  },
                });
              } else {
                dispatch({
                  type: ActionType.ADD_ALERT,
                  payload: {
                    message: `Disabling data sync for notebook ${project.name}`,
                    severity: 'warning',
                  },
                });
              }
            }}
          />
        }
        label={
          <Typography variant={'button'}>{isSyncing ? 'On' : 'Off'}</Typography>
        }
      />
      <FormHelperText>
        Toggle syncing this notebook to the server.
      </FormHelperText>
    </Box>
  );
}
