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
 *   The settings component for a notebook presents user changeable options
 */

import {
  ProjectID,
  ProjectInformation,
  ProjectUIModel,
} from '@faims3/data-model';
import {
  Box,
  CircularProgress,
  FormControlLabel,
  Grid,
  Paper,
  Switch,
  Typography,
} from '@mui/material';
import {useEffect, useState} from 'react';
import {useParams} from 'react-router-dom';
import {NOTEBOOK_NAME_CAPITALIZED} from '../../../../buildconfig';
import {
  selectProjectById,
  startSyncingAttachments,
  stopSyncingAttachments,
} from '../../../../context/slices/projectSlice';
import {addAlert} from '../../../../context/slices/syncSlice';
import {useAppDispatch, useAppSelector} from '../../../../context/store';
import {logError} from '../../../../logging';
import {theme} from '../../../themes';
import AutoIncrementerSettingsList from './auto_incrementers';
import NotebookSyncSwitch from './sync_switch';

export default function NotebookSettings(props: {uiSpec: ProjectUIModel}) {
  const {project_id} = useParams<{project_id: ProjectID}>();
  if (!project_id) return <></>;
  const dispatch = useAppDispatch();
  const project = useAppSelector(state => selectProjectById(state, project_id));
  if (!project) return <></>;

  // TODO this is currently not real
  const isSyncing = project.database?.isSyncing ?? false;
  const isSyncingAttachments = project.database?.isSyncingAttachments ?? false;

  return (
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
              Sync {NOTEBOOK_NAME_CAPITALIZED}
            </Typography>
            <NotebookSyncSwitch project={project} showHelperText={true} />
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
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: theme.palette.icon.main,
                        },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track':
                          {
                            backgroundColor: theme.palette.icon.main,
                          },
                      }}
                      onChange={async (event, checked) => {
                        if (checked) {
                          dispatch(
                            startSyncingAttachments({
                              projectId: project_id!,
                              serverId: project.serverId,
                            })
                          );
                        } else {
                          dispatch(
                            stopSyncingAttachments({
                              projectId: project_id!,
                              serverId: project.serverId,
                            })
                          );
                        }
                        if (checked) {
                          dispatch(
                            addAlert({
                              message: 'Downloading attachments to device...',
                              severity: 'success',
                            })
                          );
                        }
                      }}
                    />
                  }
                  label={<Typography>{isSyncing ? 'On' : 'Off'}</Typography>}
                />
                <Typography variant={'body2'}>
                  This control is app and device specific. If this option is
                  enabled, Fieldmark™ will automatically download and show
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
            project={project}
            uiSpec={props.uiSpec}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
