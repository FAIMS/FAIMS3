import React, {useContext} from 'react';
import {Box, Button, Typography} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import {ProjectExtended} from '../../../../types/project';
import {ProjectsContext} from '../../../../context/projects-context';
import FaimsDialog from '../../ui/Faims_Dialog';

type NotebookActivationSwitchProps = {
  project: ProjectExtended;
  project_status: string | undefined;
  isWorking: boolean;
  setTabID: Function;
};

export default function NotebookActivationSwitch({
  project: {_id, listing},
  isWorking,
  setTabID,
}: NotebookActivationSwitchProps) {
  const [open, setOpen] = React.useState(false);
  const {activateProject} = useContext(ProjectsContext);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  const handleActivationClick = () => {
    activateProject(_id, listing);
    setTabID('1');
    handleClose();
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
      <FaimsDialog
        open={open}
        title="Activating / Deactivating surveys"
        icon={<InfoIcon style={{fontSize: 40, color: '#1976d2'}} />}
        onClose={handleClose}
        onPrimaryAction={handleActivationClick}
        primaryActionText="Activate"
        primaryActionLoading={isWorking}
        primaryActionColor="primary"
        primaryActionVariant="contained"
        cancelButtonText="Cancel"
      >
        <Box mb={2}>
          <Typography variant="subtitle1" fontWeight="bold">
            Activating a survey:
          </Typography>
          <Typography variant="body2" paragraph>
            • When a survey is “Active” you are safe to work offline at any
            point because all the data is saved to your device.
          </Typography>
          <Typography variant="body2" paragraph>
            • Before going out in the field you must ‘Activate’ your survey by
            pressing the button “Activate" and selecting which survey(s) you
            want to be available while out in the field.
          </Typography>
          <Typography variant="subtitle1" fontWeight="bold">
            Deactivating a survey:
          </Typography>
          <Typography variant="body2">
            • This can be helpful when you need to free up space on your device
            and when you no longer need access to surveys or survey data
            offline.
          </Typography>
        </Box>
      </FaimsDialog>
    </Box>
  );
}
