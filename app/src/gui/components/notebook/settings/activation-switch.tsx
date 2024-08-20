import React, { useState } from 'react';
import { Button, Box, Typography } from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import InfoIcon from '@mui/icons-material/Info';
import { ProjectInformation } from '@faims3/data-model';
import { NOTEBOOK_NAME } from '../../../../buildconfig';
import ReusableDialog from '../../ui/Reusable_Dialog';

type NotebookActivationSwitchProps = {
  project: ProjectInformation;
  project_status: string | undefined;
  handleActivation: () => void;
  isWorking: boolean;
};

export default function NotebookActivationSwitch({
  project,
  handleActivation,
  isWorking,
}: NotebookActivationSwitchProps) {
  const [open, setOpen] = useState(false);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const handleActivationClick = () => {
    handleActivation(); // Trigger the activation process
    handleClose();      // Close the dialog
  };

  return (
    <Box my={1}>
      <Button
        onClick={handleOpen}
        color="primary"
        size="small"
        variant="outlined"
        disableElevation
      >
        Activate
      </Button>
      <ReusableDialog
        open={open}
        title="Are you sure?"
        icon={<InfoIcon style={{ fontSize: 40, color: '#1976d2' }} />}
        onClose={handleClose}
        onPrimaryAction={handleActivationClick}
        primaryActionText="Activate"
        primaryActionLoading={isWorking}
        cancelButtonText="Cancel"
      >
        <Box mb={2}>
          <Typography variant="body2">
            Do you want to start syncing the {project.name} {NOTEBOOK_NAME} to your device?
          </Typography>
        </Box>
      </ReusableDialog>
    </Box>
  );
}
