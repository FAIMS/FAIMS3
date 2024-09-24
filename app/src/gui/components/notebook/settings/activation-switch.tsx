import React, {useContext} from 'react';
import {Alert, Box, AlertTitle, Button} from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogActions from '@mui/material/DialogActions';

import Dialog from '@mui/material/Dialog';
import {NOTEBOOK_NAME} from '../../../../buildconfig';
import {ProjectExtended} from '../../../../types/project';
import {ProjectsContext} from '../../../../context/projects-context';

type NotebookActivationSwitchProps = {
  project: ProjectExtended;
  project_status: string | undefined;
  isWorking: boolean;
  setTabID: Function;
};

export default function NotebookActivationSwitch({
  project: {_id, name, listing},
  isWorking,
  setTabID,
}: NotebookActivationSwitchProps) {
  const [open, setOpen] = React.useState(false);
  const {activateProject} = useContext(ProjectsContext);

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
          Do you want to start syncing the {name} {NOTEBOOK_NAME} to your
          device?
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
                activateProject(_id, listing);
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
