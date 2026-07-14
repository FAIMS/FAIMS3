import InfoIcon from '@mui/icons-material/Info';
import {Box, Button, Typography} from '@mui/material';
import React from 'react';
import {config} from '../../../../buildconfig';
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
    <Box sx={{display: 'flex', alignItems: 'center', height: '100%'}}>
      <Button
        onClick={handleOpen}
        color="primary"
        size="small"
        variant="outlined"
        disableElevation
        data-testid="app-notebook-activate-button"
      >
        {ACTIVATE_VERB_LABEL}
      </Button>
      <FaimsDialog
        open={open}
        title={`${ACTIVATE_ACTIVE_VERB_LABEL} ${config.notebookNamePluralCapitalized}`}
        icon={<InfoIcon style={{fontSize: 40, color: '#1976d2'}} />}
        onClose={handleClose}
        onPrimaryAction={handleActivationClick}
        primaryActionText={ACTIVATE_VERB_LABEL}
        primaryActionLoading={isWorking}
        primaryActionColor="primary"
        primaryActionVariant="contained"
        cancelButtonText="Cancel"
        primaryActionTestId="app-notebook-activate-confirm"
        cancelTestId="app-notebook-activate-cancel"
      >
        <Box sx={{mb: 2}}>
          <Typography variant="body2" sx={{mb: 2}}>
            <strong>"{ACTIVATE_ACTIVE_VERB_LABEL}"</strong> a{' '}
            {config.notebookName} ensures that you are safe to work offline at
            any point by downloading any existing records onto your device.
            <br />
            <strong>Please do this with a stable internet connection.</strong>
          </Typography>
        </Box>
      </FaimsDialog>
    </Box>
  );
}
