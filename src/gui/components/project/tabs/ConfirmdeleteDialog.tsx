/*
 * Copyright 2021 Macquarie University
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
 * Filename: ConfirmdeleteDialog.tsx
 */
import React from 'react';

import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button,
} from '@mui/material';

import {ProjectDelete} from './ProjectButton';

type ConfirmdeleteDialogProps = {
  id: string;
  deleteform: any;
  type: string;
};

export default function ConfirmdeleteDialog(props: ConfirmdeleteDialogProps) {
  const [open, setOpen] = React.useState(false);
  const {id, deleteform, type} = props;
  return (
    <>
      <br />
      <ProjectDelete
        id={'delete' + id}
        type="button"
        isSubmitting={false}
        text={'Delete  ' + type}
        onButtonClick={() => setOpen(true)}
      />
      <br />
      <br />
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">{'Confirm Delete'}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to delete this {type} ?
            {type === 'FORM' &&
              ' Delete form might affect others if there is connection, please make sure the field has been delelted. '}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={() => {
              setOpen(false);
              deleteform(id, type);
            }}
            color="primary"
            variant="contained"
            autoFocus
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
