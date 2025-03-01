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

import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Dialog,
  DialogActions,
  FormControlLabel,
  FormHelperText,
  Switch,
  Typography,
} from '@mui/material';
import {useState} from 'react';
import {NOTEBOOK_NAME} from '../../../../buildconfig';
import {
  Project,
  resumeSyncingProject,
  stopSyncingAttachments,
  stopSyncingProject,
} from '../../../../context/slices/projectSlice';
import {theme} from '../../../themes';
import NotebookActivationSwitch from './activation-switch';
import {useAppDispatch} from '../../../../context/store';

type NotebookSyncSwitchProps = {
  project: Project;
  showHelperText: boolean;
  setTabID?: Function;
};

export default function NotebookSyncSwitch({
  project,
  showHelperText,
  setTabID = () => {},
}: NotebookSyncSwitchProps) {
  const [open, setOpen] = useState(false);
  const dispatch = useAppDispatch();
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  const isSyncing = project.database?.isSyncing ?? false;

  return (
    <Box>
      {!project.isActivated ? (
        <NotebookActivationSwitch
          project={project}
          setTabID={setTabID}
          isWorking={false}
        />
      ) : (
        <Box>
          <FormControlLabel
            sx={{mr: 0, md: 2}}
            control={
              <Switch
                checked={isSyncing ?? false}
                disabled={false}
                onClick={handleOpen}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: theme.palette.icon.main,
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: theme.palette.icon.main,
                  },
                }}
              />
            }
            label={
              <Typography variant={'button'}>
                {isSyncing ? 'On' : 'Off'}
              </Typography>
            }
          />
          {showHelperText ? (
            <FormHelperText>
              Toggle syncing this {NOTEBOOK_NAME} to the server.
            </FormHelperText>
          ) : (
            ''
          )}
          <Dialog
            open={open}
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-description"
            PaperProps={{
              sx: {padding: 2},
            }}
          >
            <Alert severity={isSyncing ? 'warning' : 'info'}>
              <AlertTitle>Are you sure?</AlertTitle>
              Do you want to {isSyncing ? 'stop' : 'start'} syncing the{' '}
              {project.metadata.name} {NOTEBOOK_NAME} to your device?
            </Alert>
            <DialogActions style={{justifyContent: 'space-between'}}>
              <Button
                variant="contained"
                sx={{
                  backgroundColor: theme.palette.dialogButton.cancel,
                  color: theme.palette.dialogButton.dialogText,
                }}
                onClick={handleClose}
                autoFocus
              >
                Cancel
              </Button>
              <Button
                size={'small'}
                variant="contained"
                sx={{
                  backgroundColor: theme.palette.dialogButton?.confirm,
                  color: theme.palette.dialogButton.dialogText,
                }}
                disableElevation
                onClick={async () => {
                  if (isSyncing) {
                    // stop syncing
                    dispatch(
                      stopSyncingProject({
                        projectId: project.projectId,
                        serverId: project.serverId,
                      })
                    );
                  } else {
                    // start syncing
                    dispatch(
                      resumeSyncingProject({
                        projectId: project.projectId,
                        serverId: project.serverId,
                      })
                    );
                  }
                  handleClose();
                }}
              >
                {isSyncing ? 'Stop ' : 'Start'} sync
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}
    </Box>
  );
}
