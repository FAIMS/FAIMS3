import InfoIcon from '@mui/icons-material/Info';
import {Box, Button, Typography} from '@mui/material';
import React from 'react';
import {
  NOTEBOOK_NAME,
  NOTEBOOK_NAME_CAPITALIZED,
} from '../../../../buildconfig';
import {selectActiveUser} from '../../../../context/slices/authSlice';
import {
  activateProject,
  Project,
} from '../../../../context/slices/projectSlice';
import {useAppDispatch, useAppSelector} from '../../../../context/store';
import FaimsDialog from '../../ui/Faims_Dialog';
import {
  ACTIVATE_ACTIVE_VERB_LABEL,
  ACTIVATE_VERB_LABEL,
  ACTIVATED_LABEL,
  DE_ACTIVATE_VERB,
} from '../../workspace/notebooks';

type NotebookActivationSwitchProps = {
  project: Project;
  isWorking: boolean;
  setTabID: Function;
};

export default function NotebookActivationSwitch({
  project,
  isWorking,
  setTabID,
}: NotebookActivationSwitchProps) {
  const [open, setOpen] = React.useState(false);
  const activeUser = useAppSelector(selectActiveUser);
  const dispatch = useAppDispatch();

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  const handleActivationClick = () => {
    if (activeUser) {
      dispatch(
        activateProject({
          jwtToken: activeUser.token,
          projectId: project.projectId,
          serverId: activeUser.serverId,
        })
      );
      setTabID('1');
      handleClose();
    } else {
      console.warn('No active user but trying to activate a project.');
    }
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
        {ACTIVATE_VERB_LABEL}
      </Button>
      <FaimsDialog
        open={open}
        title={`${ACTIVATE_ACTIVE_VERB_LABEL} ${NOTEBOOK_NAME_CAPITALIZED}s`}
        icon={<InfoIcon style={{fontSize: 40, color: '#1976d2'}} />}
        onClose={handleClose}
        onPrimaryAction={handleActivationClick}
        primaryActionText={ACTIVATE_VERB_LABEL}
        primaryActionLoading={isWorking}
        primaryActionColor="primary"
        primaryActionVariant="contained"
        cancelButtonText="Cancel"
      >
        <Box mb={2}>
          <Typography variant="body2" paragraph>
            When a {NOTEBOOK_NAME_CAPITALIZED} is “{ACTIVATED_LABEL}” you are
            safe to work offline at any point because all the data you collect
            will be saved to your device. To {ACTIVATE_VERB_LABEL.toLowerCase()}{' '}
            your {NOTEBOOK_NAME_CAPITALIZED}, click the "{ACTIVATE_VERB_LABEL}"
            button below.
          </Typography>
          <Typography variant="body2" paragraph>
            <b>Warning</b>: {ACTIVATE_ACTIVE_VERB_LABEL.toLowerCase()} a{' '}
            {NOTEBOOK_NAME_CAPITALIZED} will start the downloading of existing
            records onto your device. We recommend you complete this procedure
            while you have a stable internet connection.
            <br />
            <br />
            Currently, you cannot {DE_ACTIVATE_VERB.toLowerCase()} a{' '}
            {NOTEBOOK_NAME}, this is something we will be adding soon. If you
            need to make space on your device you can clear the application
            storage or remove and reinstall the application.
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
