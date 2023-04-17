import React from 'react';
import {Alert, Box, AlertTitle, Button} from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import {ProjectInformation} from 'faims3-datamodel';
import DialogActions from '@mui/material/DialogActions';

import Dialog from '@mui/material/Dialog';

type NotebookActivationSwitchProps = {
  project: ProjectInformation;
  project_status: string | undefined;
  handleActivation: Function;
  isWorking: boolean;
};

export default function NotebookActivationSwitch(
  props: NotebookActivationSwitchProps
) {
  const [open, setOpen] = React.useState(false);
  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };
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
          Do you want to start syncing the {props.project.name} notebook to your
          device?
        </Alert>
        <DialogActions style={{justifyContent: 'space-between'}}>
          <Button onClick={handleClose} autoFocus color={'primary'}>
            Cancel
          </Button>

          {props.isWorking ? (
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
                props.handleActivation();
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
