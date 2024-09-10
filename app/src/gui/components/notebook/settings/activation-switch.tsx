import React, {useContext} from 'react';
import {Alert, Box, AlertTitle, Button} from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogActions from '@mui/material/DialogActions';

import Dialog from '@mui/material/Dialog';
import {NOTEBOOK_NAME} from '../../../../buildconfig';
import {ProjectWithActivation} from '../../../../types/project';
import {ProjectsContext} from '../../../../context/projects-context';

type NotebookActivationSwitchProps = {
  project: ProjectWithActivation;
  project_status: string | undefined;
  handleActivation: Function;
  isWorking: boolean;
  setTabID: Function;
};

export default function NotebookActivationSwitch({
  project,
  handleActivation,
  isWorking,
  setTabID,
}: NotebookActivationSwitchProps) {
  const [open, setOpen] = React.useState(false);
  const {setProjects} = useContext(ProjectsContext);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  return (
    <Box my={1}>
      <Button
        onClick={handleOpen}
        color={'primary'}
        size={'small'}
        variant={'outlined'}
        disableElevation={true}
      >
        Activate
      </Button>
      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <Alert severity={'info'}>
          <AlertTitle>Are you sure?</AlertTitle>
          Do you want to start syncing the {project.name} {NOTEBOOK_NAME} to
          your device?
        </Alert>
        <DialogActions style={{justifyContent: 'space-between'}}>
          <Button onClick={handleClose} autoFocus color={'primary'}>
            Cancel
          </Button>

          {isWorking ? (
            <LoadingButton loading variant="outlined" size={'small'}>
              Activating...
            </LoadingButton>
          ) : (
            <Button
              size={'small'}
              variant="contained"
              disableElevation
              color={'primary'}
              onClick={() => {
                setProjects(projects =>
                  projects.map(p =>
                    p._id === project._id ? {...p, activated: true} : p
                  )
                );
                handleActivation();
                setTabID('1');
                handleClose();
              }}
            >
              Activate
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
