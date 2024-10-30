import React, {useContext} from 'react';
import {Box, Button, Typography} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import {ProjectExtended} from '../../../../types/project';
import {ProjectsContext} from '../../../../context/projects-context';
import FaimsDialog from '../../ui/Faims_Dialog';
import {
  NOTEBOOK_NAME,
  NOTEBOOK_NAME_CAPITALIZED,
} from '../../../../buildconfig';

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
        title={`Activating ${NOTEBOOK_NAME_CAPITALIZED}s`}
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
          <Typography variant="body2" paragraph>
            When a {NOTEBOOK_NAME_CAPITALIZED} is “Active” you are safe to work
            offline at any point because all the data you collect will be saved
            to your device. To activate your {NOTEBOOK_NAME_CAPITALIZED}, click
            the "Activate" button below.
          </Typography>
          <Typography variant="body2" paragraph>
            <b>Warning</b>: activating a {NOTEBOOK_NAME_CAPITALIZED} will start
            the downloading of existing records onto your device. We recommend
            you complete this procedure while you have a stable internet
            connection.
            <br />
            <br />
            Currently, you cannot de-activate a survey, this is something we
            will be adding soon. If you need to make space on your device you
            can clear the application storage or remove and reinstall the
            application.
          </Typography>
          {/*
          <Typography variant="subtitle1" fontWeight="bold">
            Deactivating a survey:
          </Typography>
          <Typography variant="body2">
            • This can be helpful when you need to free up space on your device
            and when you no longer need access to surveys or survey data
            offline.
          </Typography>
            */}
        </Box>
      </FaimsDialog>
    </Box>
  );
}
