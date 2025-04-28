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
import {useEffect} from 'react';
import {useNavigate} from 'react-router';
import {CloseOptionType} from './formButton';
import {useAppSelector} from '../../../context/store';

export const ConfirmExitDialog = ({
  backLink,
  backIsParent = false,
  open = false,
  setOpen,
}: {
  backLink: string;
  backIsParent: boolean;
  open: boolean;
  setOpen: (state: boolean) => void;
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();

  const handleClose = () => {
    console.log('handleClose');
    setOpen(false);
  };

  const handleConfirm = () => {
    setOpen(false);
    navigate(backLink, {
      replace: true,
    });
  };

  useEffect(() => {
    const handleBackEvent = (event: Event) => {
      event.preventDefault();
      setOpen(true);
    };
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      setOpen(true);
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
      open={open}
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
          Return to {backIsParent ? 'parent record' : 'record list'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const ConfirmCancelDialog = ({
  open,
  setOpen,
  confirmAction,
}: {
  open: boolean;
  setOpen: (state: boolean) => void;
  confirmAction: (close: CloseOptionType) => void;
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleClose = () => {
    setOpen(false);
  };

  const handleConfirm = () => {
    setOpen(false);
    console.log('cancel confirmed');
    confirmAction('cancel');
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      PaperProps={{
        sx: {padding: 2},
      }}
      disableScrollLock={true}
    >
      <Alert severity="info">
        <AlertTitle> Are you sure you want to cancel?</AlertTitle>
        This action will delete any changes you have made to this form and
        cannot be undone.
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
          Confirm cancel.
        </Button>
      </DialogActions>
    </Dialog>
  );
};
