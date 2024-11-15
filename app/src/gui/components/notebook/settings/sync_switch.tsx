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
import {useContext, useState} from 'react';
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
import {grey} from '@mui/material/colors';
import NotebookActivationSwitch from './activation-switch';
import {NOTEBOOK_NAME} from '../../../../buildconfig';
import {ProjectExtended} from '../../../../types/project';
import {ProjectsContext} from '../../../../context/projects-context';
import {theme} from '../../../themes';

type NotebookSyncSwitchProps = {
  project: ProjectExtended;
  showHelperText: boolean;
  setTabID?: Function;
};

export default function NotebookSyncSwitch({
  project,
  showHelperText,
  setTabID = () => {},
}: NotebookSyncSwitchProps) {
  const [open, setOpen] = useState(false);
  const {setProjectSync} = useContext(ProjectsContext);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  return ['published', 'archived'].includes(String(project.status)) ? (
    <Box>
      {!project.activated ? (
        <NotebookActivationSwitch
          project={project}
          project_status={project.status}
          setTabID={setTabID}
          isWorking={false}
        />
      ) : (
        <Box>
          <FormControlLabel
            sx={{mr: 0, md: 2}}
            control={
              <Switch
                checked={project.sync}
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
                {project.sync ? 'On' : 'Off'}
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
            <Alert severity={project.sync ? 'warning' : 'info'}>
              <AlertTitle>Are you sure?</AlertTitle>
              Do you want to {project.sync ? 'stop' : 'start'} syncing the{' '}
              {project.name} {NOTEBOOK_NAME} to your device?
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
                  setProjectSync(project._id, project.listing, !project.sync);
                  handleClose();
                }}
              >
                {project.sync ? 'Stop ' : 'Start'} sync
              </Button>
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
        Only published or archived ${NOTEBOOK_NAME}s can be synced.
      </Typography>
    </Box>
  );
}
