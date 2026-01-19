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
            {ACTIVATE_ACTIVE_VERB_LABEL} a {NOTEBOOK_NAME} downloads existing
            records onto your device. It is important you do this with a stable
            internet connection. Once it is {ACTIVATED_LABEL.toLowerCase()} you
            will be safe to work offline.
          </Typography>
          <Typography variant="body2" component="div">
            <strong>To {DE_ACTIVATE_VERB.toLowerCase()} a {NOTEBOOK_NAME}:</strong>
            <ol style={{margin: '8px 0', paddingLeft: '20px'}}>
              <li>Go to the {ACTIVATED_LABEL} list and open the {NOTEBOOK_NAME}</li>
              <li>
                Click <strong>"Settings"</strong> (next to Map and Details)
              </li>
              <li>
                Scroll down and click{' '}
                <strong>"{DE_ACTIVATE_VERB} {NOTEBOOK_NAME_CAPITALIZED}"</strong>
              </li>
            </ol>
          </Typography>
        </Box>
      </FaimsDialog>
    </Box>
  );
}
