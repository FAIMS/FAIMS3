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
 * Filename: Dialog.tsx
 * Description:
 *   TODO: download single file
 */

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
import CircularProgress from '@mui/material/CircularProgress';
import {NOTEBOOK_NAME_CAPITALIZED} from '../../../buildconfig';

type DiagProps = {
  open?: boolean;
  project_id: string;
  setopen: any;
  filedId?: string;
  path?: string | null;
  isSyncing?: string;
  serverId: string;
};
export default function FaimsAttachmentManagerDialog(props: DiagProps) {
  const {open, setopen, project_id, path, isSyncing} = props;

  return (
    <Dialog
      open={open ?? false}
      onClose={setopen}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title" style={{minWidth: '300px'}}>
        {path !== null ? '' : 'Download attachments and photos'}
        <IconButton
          aria-label="close"
          onClick={setopen}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            '&:hover': {
              bgcolor: 'rgba(0, 0, 0, 0.7)',
              transform: 'scale(1.1)',
            },
            transition: 'all 0.2s ease-in-out',
          }}
        >
          <CloseIcon
            sx={{
              color: 'white',
              fontSize: 24,
            }}
          />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {path !== null ? (
          <img
            data-testid="dialog-img"
            style={{
              maxWidth: '100%',
              maxHeight: '90vh',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              display: 'block',
              margin: '0 auto',
            }}
            src={path}
          />
        ) : isSyncing === 'true' ? (
          <DialogContentText id="alert-dialog-description">
            Photo/File is Syncing
            <CircularProgress
              size={24}
              data-testid="dialog-progress"
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                marginTop: -12,
                marginLeft: -12,
              }}
            />
          </DialogContentText>
        ) : (
          <DialogContentText id="alert-dialog-description">
            To download existing photos, please go to the{' '}
            {NOTEBOOK_NAME_CAPITALIZED} Settings Tab and enable attachment
            download.
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
          <Button
            color="primary"
            size="large"
            component={RouterLink}
            to={
              ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE +
              props.serverId +
              '/' +
              project_id +
              `?${ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE_TAB_Q}=settings`
            }
          >
            Go to settings
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
