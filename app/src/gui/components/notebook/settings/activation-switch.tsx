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
  DE_ACTIVATE_ACTIVE_VERB,
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
            <strong>"{ACTIVATE_ACTIVE_VERB_LABEL}"</strong> a {NOTEBOOK_NAME}{' '}
            ensures that you are safe to work offline at any point by
            downloading any existing records onto your device. Please do this
            with a stable internet connection.
          </Typography>
          <Typography variant="body2" paragraph>
            <strong>"{DE_ACTIVATE_ACTIVE_VERB}"</strong> a {NOTEBOOK_NAME}{' '}
            offloads records from your device, to{' '}
            {DE_ACTIVATE_VERB.toLowerCase()} a {NOTEBOOK_NAME}:
          </Typography>
          <Typography variant="body2" component="div">
            <ol style={{margin: '8px 0', paddingLeft: '20px'}}>
              <li>
                Select the {NOTEBOOK_NAME} you want to{' '}
                {DE_ACTIVATE_VERB.toLowerCase()}
              </li>
              <li>
                Ensure you are online, and all data in the {NOTEBOOK_NAME} has
                been synced to the cloud
              </li>
              <li>
                Click <strong>"Settings"</strong> tab (next to Map and Details
                tabs)
              </li>
              <li>
                Select the red{' '}
                <strong>
                  "{DE_ACTIVATE_VERB} {NOTEBOOK_NAME}"
                </strong>{' '}
                at the bottom
                <Box sx={{mt: 1, mb: 0.5}}>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    disableRipple
                    sx={{
                      pointerEvents: 'none',
                      textTransform: 'uppercase',
                      fontSize: '0.75rem',
                      py: 0.5,
                      px: 1,
                    }}
                  >
                    {DE_ACTIVATE_VERB} {NOTEBOOK_NAME_CAPITALIZED}
                  </Button>
                </Box>
              </li>
            </ol>
          </Typography>
        </Box>
      </FaimsDialog>
    </Box>
  );
}
