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
 * Filename: settings.tsx
 * Description:
 *   TODO
 */

import React, {useContext, useEffect, useState} from 'react';
import {useParams, Navigate} from 'react-router-dom';

import {
  Box,
  Typography,
  Grid,
  Paper,
  CircularProgress,
  FormControlLabel,
  Switch,
} from '@mui/material';

import {getProjectInfo, listenProjectInfo} from '../../../../databaseAccess';
import {useEventedPromise, constantArgsShared} from '../../../pouchHook';
import {ProjectInformation} from 'faims3-datamodel';
import {ProjectID} from 'faims3-datamodel';
import {
  isSyncingProjectAttachments,
  listenSyncingProjectAttachments,
  setSyncingProjectAttachments,
} from '../../../../sync/sync-toggle';
import {ActionType} from '../../../../context/actions';
import {store} from '../../../../context/store';
import AutoIncrementerSettingsList from './auto_incrementers';
import NotebookSyncSwitch from './sync_switch';
import {ProjectUIModel} from 'faims3-datamodel';
import {logError} from '../../../../logging';

export default function NotebookSettings(props: {uiSpec: ProjectUIModel}) {
  const {project_id} = useParams<{project_id: ProjectID}>();

  const [isSyncing, setIsSyncing] = useState<null | boolean>(null);
  const {dispatch} = useContext(store);

  useEffect(() => {
    try {
      if (project_id !== null)
        setIsSyncing(isSyncingProjectAttachments(project_id!));
    } catch (error: any) {
      logError(error);
    }

    return listenSyncingProjectAttachments(project_id!, setIsSyncing);
  }, [project_id]);

  let project_info: ProjectInformation | null;
  try {
    project_info = useEventedPromise(
      'NotebookSettings component project info',
      getProjectInfo,
      constantArgsShared(listenProjectInfo, project_id!),
      false,
      [project_id],
      project_id!
    ).expect();
  } catch (err: any) {
    if (err.message === 'missing') {
      return <Navigate to="/404" />;
    } else {
      throw err;
    }
  }

  return project_info ? (
    <Box>
      <Grid
        container
        rowSpacing={{xs: 1, sm: 2, md: 3}}
        columnSpacing={{xs: 1, sm: 2, md: 3}}
        sx={{mb: {xs: 1, sm: 2, md: 3}}}
      >
        <Grid item xs={12} sm={12} md={6} lg={4}>
          <Box
            component={Paper}
            variant={'outlined'}
            elevation={0}
            p={2}
            mb={{xs: 1, sm: 2, md: 3}}
          >
            <Typography variant={'h6'} sx={{mb: 2}}>
              Sync Notebook
            </Typography>
            <NotebookSyncSwitch
              project={project_info}
              showHelperText={true}
              project_status={project_info?.status}
            />
          </Box>

          <Box component={Paper} variant={'outlined'} elevation={0} p={2}>
            <Typography variant={'h6'} sx={{mb: 2}}>
              Get attachments from other devices
            </Typography>
            {isSyncing !== null ? (
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={isSyncing}
                      onChange={async (event, checked) => {
                        await setSyncingProjectAttachments(
                          project_id!,
                          checked
                        );
                        if (checked)
                          dispatch({
                            type: ActionType.ADD_ALERT,
                            payload: {
                              message: 'Downloading attachments to device...',
                              severity: 'success',
                            },
                          });
                      }}
                    />
                  }
                  label={<Typography>{isSyncing ? 'On' : 'Off'}</Typography>}
                />
                <Typography variant={'body2'}>
                  This control is notebook and device specific. If this option
                  is enabled, Fieldmark™ will automatically download and show
                  images and attachments created by other devices. Be aware that
                  this may be resource intensive and use your mobile data plan.
                  Disable this setting to minimise network usage. This setting
                  will not affect uploading of your data from this device to the
                  central server. Attachments are always uploaded to the server
                  regardless of this setting.
                </Typography>
              </Box>
            ) : (
              ''
            )}
          </Box>
        </Grid>
        <Grid item xs={12} sm={12} md={6} lg={8}>
          <AutoIncrementerSettingsList
            project_info={project_info}
            uiSpec={props.uiSpec}
          />
        </Grid>
      </Grid>
    </Box>
  ) : (
    <CircularProgress />
  );
}
