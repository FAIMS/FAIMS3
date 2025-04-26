/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Description:
 *   Defines a dialog to confirm exit from editing a record offering to
 *   save or delete the current draft.
 */

import {Alert, AlertTitle, Button, Dialog, DialogActions} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router';

export const ConfirmExitDialog = ({backLink}: {backLink: string}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const [openDialog, setOpenDialog] = useState(false);

  const handleClose = () => {
    setOpenDialog(false);
  };

  const handleConfirm = () => {
    setOpenDialog(false);
    navigate(backLink, {
      replace: true,
    });
  };

  useEffect(() => {
    const handleBackEvent = (event: Event) => {
      event.preventDefault();
      setOpenDialog(true);
    };
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      setOpenDialog(true);
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBackEvent);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBackEvent);
    };
  }, []);

  return (
    <Dialog
      open={openDialog}
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      PaperProps={{
        sx: {padding: 2},
      }}
      disableScrollLock={true}
    >
      <Alert severity="info">
        <AlertTitle>
          {' '}
          Are you sure you want to return to the record list?
        </AlertTitle>
        Your response is saved on your device as a draft. You can return to it
        later to complete this record.{' '}
      </Alert>

      <DialogActions
        sx={{
          justifyContent: 'space-between',
          padding: theme.spacing(2),
        }}
      >
        <Button
          onClick={handleClose}
          sx={{
            backgroundColor: theme.palette.dialogButton.cancel,
            color: theme.palette.dialogButton.dialogText,
            fontSize: isMobile ? '0.875rem' : '1rem',
            padding: isMobile ? '6px 12px' : '10px 20px',
            '&:hover': {
              backgroundColor: theme.palette.text.primary,
            },
          }}
        >
          Continue working
        </Button>
        <Button
          onClick={handleConfirm}
          // variant={'contained'}
          sx={{
            backgroundColor: theme.palette.dialogButton.confirm,
            color: theme.palette.dialogButton.dialogText,
            fontSize: isMobile ? '0.875rem' : '1rem',
            padding: isMobile ? '6px 12px' : '10px 20px',
            '&:hover': {
              backgroundColor: theme.palette.text.primary,
            },
          }}
        >
          Return to record list
        </Button>
      </DialogActions>
    </Dialog>
  );
};
