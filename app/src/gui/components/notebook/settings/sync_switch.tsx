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
import React, {useContext, useState} from 'react';
import {
  Box,
  Switch,
  FormControlLabel,
  FormHelperText,
  Typography,
  Paper,
  DialogActions,
  Dialog,
  Alert,
  AlertTitle,
  Button,
} from '@mui/material';

import {ProjectInformation} from 'faims3-datamodel';
import {
  isSyncingProject,
  setSyncingProject,
  listenSyncingProject,
} from '../../../../sync/sync-toggle';
import {activate_project} from '../../../../sync/process-initialization';
import {store} from '../../../../context/store';
import {ActionType} from '../../../../context/actions';
import {grey} from '@mui/material/colors';
import NotebookActivationSwitch from './activation-switch';
import LoadingButton from '@mui/lab/LoadingButton';
import {ProjectID} from 'faims3-datamodel';

type NotebookSyncSwitchProps = {
  project: ProjectInformation;
  showHelperText: boolean;
  project_status: string | undefined;
  handleTabChange?: Function;
};

async function listenSync(
  active_id: ProjectID,
  callback: (syncing: boolean) => unknown
): Promise<any> {
  return listenSyncingProject(active_id, callback); // the callback here will set isSyncing
}
export default function NotebookSyncSwitch(props: NotebookSyncSwitchProps) {
  const {project} = props;
  const {dispatch} = useContext(store);
  const [open, setOpen] = React.useState(false);
  const handleOpen = () => {
    setOpen(true);
  };
  const handleClose = () => {
    setOpen(false);
  };
  const [isSyncing, setIsSyncing] = useState(
    project.is_activated ? isSyncingProject(project.project_id) : false
  );
  const [isWorking, setIsWorking] = useState(false);

  const handleStartSync = async () => {
    /**
     * Wrapped listenSyncingProject in promise to ensure the setSync
     * callback has completed before component unmount (whether via the
     * tab switch, or react re-rendering the entire datagrid because
     * the project metadata has changed (project.is_activated))
     */

    return await listenSync(project.project_id, setIsSyncing).then(() => {
      dispatch({
        type: ActionType.ADD_ALERT,
        payload: {
          message: `Successfully activated ${project.name}.`,
          severity: 'success',
        },
      });
    });
  };
  const handleActivation = async () => {
    setIsWorking(true); // block the UI
    await activate_project(project.listing_id, project.non_unique_project_id)
      .then(async () => {
        await handleStartSync();
        setIsWorking(false); // unblock the UI
        props.handleTabChange !== undefined && props.handleTabChange('1'); // switch to "Activated" tab
      })
      .catch(e => {
        dispatch({
          type: ActionType.ADD_ALERT,
          payload: {
            message: e.message,
            severity: 'error',
          },
        });
      })
      .finally(() => location.reload());
  };

  return ['published', 'archived'].includes(String(props.project_status)) ? (
    <Box>
      {!project.is_activated ? (
        <NotebookActivationSwitch
          project={props.project}
          project_status={props.project_status}
          handleActivation={handleActivation}
          isWorking={isWorking}
        />
      ) : (
        <Box>
          <FormControlLabel
            sx={{mr: 0}}
            control={
              <Switch
                checked={isSyncing}
                disabled={isWorking}
                onClick={handleOpen}
              />
            }
            label={
              <Typography variant={'button'}>
                {isSyncing ? 'On' : 'Off'}
              </Typography>
            }
          />
          {isWorking ? <FormHelperText>Working...</FormHelperText> : ''}
          {props.showHelperText ? (
            <FormHelperText>
              Toggle syncing this notebook to the server.
            </FormHelperText>
          ) : (
            ''
          )}
          <Dialog
            open={open}
            onClose={handleClose}
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-description"
          >
            <Alert severity={isSyncing ? 'warning' : 'info'}>
              <AlertTitle>Are you sure?</AlertTitle>
              Do you want to {isSyncing ? 'stop' : 'start'} syncing the{' '}
              {props.project.name} notebook to your device?
            </Alert>
            <DialogActions style={{justifyContent: 'space-between'}}>
              <Button onClick={handleClose} autoFocus>
                Cancel
              </Button>

              {isWorking ? (
                <LoadingButton loading variant="outlined" size={'small'}>
                  {isSyncing ? 'Stopping' : 'Starting'} sync
                </LoadingButton>
              ) : (
                <Button
                  size={'small'}
                  variant="contained"
                  disableElevation
                  onClick={async () => {
                    setIsWorking(true);
                    await setSyncingProject(project.project_id, !isSyncing)
                      .then(() => {
                        dispatch({
                          type: ActionType.ADD_ALERT,
                          payload: {
                            message: `${
                              !isSyncing ? 'Enabling ' : 'Disabling '
                            } data sync for notebook  ${project.name}`,
                            severity: 'success',
                          },
                        });
                        setIsSyncing(!isSyncing);
                        setIsWorking(false);
                        handleClose();
                      })
                      .catch(e => {
                        dispatch({
                          type: ActionType.ADD_ALERT,
                          payload: {
                            message: e.message,
                            severity: 'error',
                          },
                        });
                      });
                  }}
                >
                  {isSyncing ? 'Stop ' : 'Start'} sync
                </Button>
              )}
            </DialogActions>
          </Dialog>
        </Box>
      )}
    </Box>
  ) : (
    <Box
      sx={{
        backgroundColor: grey[100],
        borderRadius: '4px',
        px: '4px',
        py: '2px',
        borderLeft: 'solid 3px ' + grey[300],
      }}
      component={Paper}
      // variant={'outlined'}
      my={1}
      elevation={0}
    >
      <Typography
        sx={{
          backgroundColor: grey[100],
          borderRadius: '4px',
          px: '4px',
          py: '2px',
        }}
        component={Paper}
        variant={'caption'}
        elevation={0}
      >
        Only published or archived notebooks can be synced.
      </Typography>
    </Box>
  );
}
