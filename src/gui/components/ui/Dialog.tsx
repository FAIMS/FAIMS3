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
 *   TODO
 */

import React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import * as ROUTES from '../../../constants/routes';
import {Link as RouterLink} from 'react-router-dom';

type DiagProps = {
    open?:boolean;
    project_id: string;
    setopen:any;
};
export default function FaimsDialog(props:DiagProps) {
//   const [open, setOpen] = React.useState(props.open??false);
  const {open,setopen,project_id}=props
  

  return (
      <Dialog
        open={open??false}
        onClose={setopen}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {"Download attachment and Photoes"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            To Download attachments and photoes, go to settings page <br/>
            To enable auto sync attachments, go to settings
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button 
          color="primary"
          size="large"
          onClick={setopen}>Close</Button>
          <Button
          color="primary"
          size="large"
          component={RouterLink}
          to={ROUTES.PROJECT + props.project_id + ROUTES.PROJECT_ATTACHMENT}
        >
          Go to download
        </Button>
        </DialogActions>
      </Dialog>
  );
}
