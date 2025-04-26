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
 * Filename: record-create.tsx
 * Description:
 *   TODO
 */

import {Alert, AlertTitle, Button, Dialog, DialogActions} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

export const CheckExitDialog = ({
  open,
  handleClose,
  handleConfirm,
}: {
  open: boolean;
  handleClose: () => void;
  handleConfirm: () => void;
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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
