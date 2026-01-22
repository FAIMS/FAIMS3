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

import {ProjectID, ProjectUIModel} from '@faims3/data-model';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Grid,
  Paper,
  Switch,
  Typography,
} from '@mui/material';
import {useNavigate, useParams} from 'react-router-dom';
import {NOTEBOOK_NAME_CAPITALIZED} from '../../../../buildconfig';
import {
  selectProjectById,
  startSyncingAttachments,
  stopSyncingAttachments,
  deactivateProject,
} from '../../../../context/slices/projectSlice';
import {addAlert} from '../../../../context/slices/alertSlice';
import {useAppDispatch, useAppSelector} from '../../../../context/store';
import {theme} from '../../../themes';
import AutoIncrementerSettingsList from './auto_incrementers';
import NotebookSyncSwitch from './sync_switch';
import React from 'react';
import {NOTEBOOK_LIST_ROUTE} from '../../../../constants/routes';

export default function NotebookSettings(props: {uiSpec: ProjectUIModel}) {
  const nav = useNavigate();
  const {projectId} = useParams<{projectId: ProjectID}>();
  if (!projectId) return <></>;
  const dispatch = useAppDispatch();
  const project = useAppSelector(state => selectProjectById(state, projectId));
  if (!project) return <></>;

  const isSyncingAttachments = project.database?.isSyncingAttachments ?? false;
  const [openDeactivateDialog, setOpenDeactivateDialog] = React.useState(false);

  const handleDeactivateClick = () => {
    setOpenDeactivateDialog(true);
  };

  const handleDeactivateConfirm = () => {
    dispatch(
      deactivateProject({
        projectId: projectId,
        serverId: project.serverId,
      })
    );
    setOpenDeactivateDialog(false);
    nav(NOTEBOOK_LIST_ROUTE);
  };

  const handleDeactivateCancel = () => {
    setOpenDeactivateDialog(false);
  };

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

          <Box
            component={Paper}
            variant={'outlined'}
            elevation={0}
            p={2}
            mb={{xs: 1, sm: 2, md: 3}}
          >
            <Typography variant={'h6'} sx={{mb: 2}}>
              Get attachments from other devices
            </Typography>

            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={isSyncingAttachments}
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
                            projectId: projectId!,
                            serverId: project.serverId,
                          })
                        );
                      } else {
                        dispatch(
                          stopSyncingAttachments({
                            projectId: projectId!,
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
                label={
                  <Typography>{isSyncingAttachments ? 'On' : 'Off'}</Typography>
                }
              />
              <Typography variant={'body2'}>
                This control is app and device specific. If this option is
                enabled, Fieldmark™ will automatically download and show images
                and attachments created by other devices. Be aware that this may
                be resource intensive and use your mobile data plan. Disable
                this setting to minimise network usage. This setting will not
                affect uploading of your data from this device to the central
                server. Attachments are always uploaded to the server regardless
                of this setting.
              </Typography>
            </Box>
          </Box>

          <Box component={Paper} variant={'outlined'} elevation={0} p={2}>
            <Typography variant={'h6'} sx={{mb: 2}}>
              Deactivate {NOTEBOOK_NAME_CAPITALIZED}
            </Typography>
            <Box>
              <Typography variant={'body2'} sx={{mb: 2}}>
                Deactivating this {NOTEBOOK_NAME_CAPITALIZED} will remove it
                from your active notebooks list. Make sure all your data has
                been synced to the server before deactivating.
              </Typography>
              <Button
                variant={'outlined'}
                color={'error'}
                onClick={handleDeactivateClick}
              >
                Deactivate {NOTEBOOK_NAME_CAPITALIZED}
              </Button>
            </Box>
          </Box>
        </Grid>
        <Grid item xs={12} sm={12} md={6} lg={8}>
          <AutoIncrementerSettingsList
            project={project}
            uiSpec={props.uiSpec}
          />
        </Grid>
      </Grid>

      {/* Deactivation Confirmation Dialog */}
      {/* <Dialog open={openDeactivateDialog} onClose={handleDeactivateCancel}>
        <DialogTitle>Deactivate {NOTEBOOK_NAME_CAPITALIZED}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to deactivate this {NOTEBOOK_NAME_CAPITALIZED}
            ? Deactivation may result in unintended data loss if your records
            have not been uploaded to the server.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeactivateCancel}>Cancel</Button>
          <Button onClick={handleDeactivateConfirm} color="error">
            Deactivate
          </Button>
        </DialogActions>
      </Dialog> */}
    </Box>
  );
}
