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
 * Filename: Diaglog.tsx
 * Description:
 *   TODO: download single file
 */

import React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import {IconButton} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import * as ROUTES from '../../../constants/routes';
import {Link as RouterLink} from 'react-router-dom';

type DiagProps = {
  open?: boolean;
  project_id: string;
  setopen: any;
  filedId?: string;
  path?: string | null;
};
export default function FaimsDialog(props: DiagProps) {
  //   const [open, setOpen] = React.useState(props.open??false);
  const {open, setopen, project_id, path} = props;

  return (
    <Dialog
      open={open ?? false}
      onClose={setopen}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">
        {path !== null ? '' : 'Download attachments and photos'}
        <IconButton
          aria-label="close"
          onClick={setopen}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {path !== null ? (
          <img style={{objectFit: 'none'}} src={path} />
        ) : (
          <DialogContentText id="alert-dialog-description">
            To download attachments and photos, please go to Settings, and
            enable auto sync for attachments
          </DialogContentText>
        )}
      </DialogContent>
      {path !== null ? (
        ''
      ) : (
        <DialogActions>
          <Button color="primary" size="large" onClick={setopen}>
            Close
          </Button>
          {/* <Button color="primary" size="large" onClick={()=>console.log('function to download'+ props.filedId)}>
          Download
        </Button> */}

          <Button
            color="primary"
            size="large"
            component={RouterLink}
            to={ROUTES.PROJECT + project_id + ROUTES.PROJECT_ATTACHMENT}
          >
            CHANGE SETTINGS
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
