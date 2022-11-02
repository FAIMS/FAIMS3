import React from 'react';
import {Alert, AlertTitle, Button} from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import {ProjectInformation} from '../../../../datamodel/ui';
import DialogActions from '@mui/material/DialogActions';

import ToggleOffIcon from '@mui/icons-material/ToggleOn';

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
    <React.Fragment>
      <Button
        onClick={handleOpen}
        color={'info'}
        size={'small'}
        variant={'contained'}
        disableElevation={true}
        startIcon={<ToggleOffIcon />}
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
          Do you want to start syncing notebook {props.project.name} to your
          device?
        </Alert>
        <DialogActions style={{justifyContent: 'space-between'}}>
          <Button onClick={handleClose} autoFocus color={'primary'}>
            Cancel
          </Button>

          {props.isWorking ? (
            <LoadingButton
              loading
              variant="outlined"
              size={'small'}
              color={'info'}
            >
              Activating...
            </LoadingButton>
          ) : (
            <Button
              size={'small'}
              variant="outlined"
              disableElevation
              color={'info'}
              onClick={() => {
                props.handleActivation();
              }}
              startIcon={<ToggleOffIcon />}
            >
              Activate
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
}
