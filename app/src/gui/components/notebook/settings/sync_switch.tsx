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
 * Filename: sync_switch.tsx
 * Description:
 * Sync mode selector for an activated notebook.
 */

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  MenuItem,
  Select,
  SelectChangeEvent,
  Typography,
} from '@mui/material';
import {useState} from 'react';
import {NOTEBOOK_NAME} from '../../../../buildconfig';
import {
  Project,
  setSyncMode,
  SyncMode,
} from '../../../../context/slices/projectSlice';
import {
  SYNC_MODE_LABELS,
  syncModeIncludesPull,
} from '../../../../sync/syncMode';
import {SyncModeHelpContent} from '../../../../sync/syncModeHelpContent';
import {theme} from '../../../themes';
import NotebookActivationSwitch from './activation-switch';
import {useAppDispatch} from '../../../../context/store';

type NotebookSyncSwitchProps = {
  project: Project;
  showHelperText: boolean;
  setTabID?: Function;
};

const SYNC_MODE_OPTIONS: SyncMode[] = ['none', 'push', 'both'];

export default function NotebookSyncSwitch({
  project,
  showHelperText,
  setTabID = () => {},
}: NotebookSyncSwitchProps) {
  const [open, setOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<SyncMode | null>(null);
  const dispatch = useAppDispatch();

  const currentMode = project.database?.syncMode ?? 'none';

  const handleModeSelect = (event: SelectChangeEvent<SyncMode>) => {
    const next = event.target.value as SyncMode;
    if (next === currentMode) {
      return;
    }
    setPendingMode(next);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setPendingMode(null);
  };

  const handleConfirm = () => {
    if (!pendingMode) {
      handleClose();
      return;
    }
    dispatch(
      setSyncMode({
        projectId: project.projectId,
        serverId: project.serverId,
        syncMode: pendingMode,
      })
    );
    handleClose();
  };

  const warning =
    pendingMode !== null ? (
      <SyncModeHelpContent
        mode={pendingMode}
        recordCount={project.recordCount}
      />
    ) : null;

  return (
    <Box sx={{display: 'flex', alignItems: 'center', height: '100%'}}>
      {!project.isActivated ? (
        <NotebookActivationSwitch
          project={project}
          setTabID={setTabID}
          isWorking={false}
        />
      ) : (
        <Box>
          <FormControl fullWidth size="small" sx={{minWidth: 220}}>
            <Select
              value={currentMode}
              onChange={handleModeSelect}
              renderValue={value => SYNC_MODE_LABELS[value as SyncMode]}
              aria-label="Sync mode"
            >
              {SYNC_MODE_OPTIONS.map(mode => (
                <MenuItem key={mode} value={mode}>
                  {SYNC_MODE_LABELS[mode]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {showHelperText ? (
            <FormHelperText>
              Choose how this {NOTEBOOK_NAME} syncs record data with the server.
              {!syncModeIncludesPull(currentMode)
                ? ' Attachment download requires two-way sync.'
                : ''}
            </FormHelperText>
          ) : null}
          <Dialog
            open={open}
            onClose={handleClose}
            aria-labelledby="sync-mode-dialog-title"
            maxWidth="sm"
            fullWidth
            slotProps={{
              paper: {
                sx: {p: 1},
              },
            }}
          >
            <DialogTitle id="sync-mode-dialog-title">
              Change sync mode?
            </DialogTitle>
            <DialogContent>
              {pendingMode !== null ? (
                <Typography variant="body2" sx={{mb: 1}}>
                  Switch to &ldquo;{SYNC_MODE_LABELS[pendingMode]}&rdquo;?
                </Typography>
              ) : null}
              {warning ? (
                <Typography variant="body2" component="div">
                  {warning}
                </Typography>
              ) : null}
            </DialogContent>
            <DialogActions className="dialog-actions-spread">
              <Button
                variant="contained"
                disableElevation
                sx={{
                  backgroundColor: theme.palette.dialogButton.cancel,
                  color: theme.palette.dialogButton.dialogText,
                  '&:hover': {
                    backgroundColor: theme.palette.text.primary,
                  },
                }}
                onClick={handleClose}
                autoFocus
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                disableElevation
                sx={{
                  backgroundColor: theme.palette.dialogButton.confirm,
                  color: theme.palette.dialogButton.dialogText,
                  '&:hover': {
                    backgroundColor: theme.palette.dialogButton.hoverBackground,
                  },
                }}
                onClick={handleConfirm}
              >
                Confirm
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}
    </Box>
  );
}
