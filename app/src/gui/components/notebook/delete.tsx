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
 * Filename: meta.tsx
 * Description:
 *   TODO
 */

import {
  ProjectID,
  RecordID,
  RevisionID,
  setRecordAsDeleted,
} from '@faims3/data-model';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  Alert,
  AlertTitle,
  Button,
  Dialog,
  DialogActions,
  IconButton,
} from '@mui/material';
import React from 'react';
import {useNavigate} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';
import {addAlert} from '../../../context/slices/alertSlice';
import {selectActiveUser} from '../../../context/slices/authSlice';
import {useAppDispatch, useAppSelector} from '../../../context/store';
import {localGetDataDb} from '../../../utils/database';
import {theme} from '../../themes';

type RecordDeleteProps = {
  projectId: ProjectID;
  serverId: string;
  recordId: RecordID;
  revisionId: RevisionID | null;
  showLabel: boolean;
  handleRefresh: () => void;
};

async function deleteFromDB({
  projectId,
  recordId,
  revisionId,
  userId,
  callback,
}: {
  projectId: ProjectID;
  recordId: RecordID;
  revisionId: RevisionID | null;
  userId: string;
  callback: () => void;
}) {
  await setRecordAsDeleted({
    dataDb: localGetDataDb(projectId),
    recordId: recordId,
    baseRevisionId: revisionId as RevisionID,
    userId: userId,
  });
  callback();
}

export default function RecordDelete(props: RecordDeleteProps) {
  //console.debug('Delete props', props);
  const {projectId, serverId, recordId, revisionId} = props;
  const [open, setOpen] = React.useState(false);
  const history = useNavigate();
  const dispatch = useAppDispatch();
  const handleClickOpen = () => {
    setOpen(true);
  };
  const activeUser = useAppSelector(selectActiveUser)!;

  const handleClose = () => {
    setOpen(false);
  };

  const handleDelete = () => {
    deleteFromDB({
      projectId,
      recordId,
      revisionId,
      userId: activeUser.username,
      callback: props.handleRefresh,
    })
      .then(() => {
        const message = `Record ${recordId} deleted`;
        dispatch(
          addAlert({
            message: message,
            severity: 'success',
          })
        );
        handleClose();
        history(ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE + serverId + '/' + projectId);
      })
      .catch(err => {
        console.error('Failed to delete', recordId, err);
        const message = `Record ${recordId} could not be deleted`;
        dispatch(
          addAlert({
            message: message,
            severity: 'error',
          })
        );
        handleClose();
      });
  };

  return (
    <div>
      {props.showLabel ? (
        <Button
          data-testid="delete-btn"
          variant="outlined"
          color="error"
          onClick={handleClickOpen}
          startIcon={
            <DeleteIcon
              sx={{
                backgroundColor: theme.palette.background.lightBackground,
                color: theme.palette.highlightColor.main,
              }}
            />
          }
        >
          Delete Record
        </Button>
      ) : (
        <IconButton
          data-testid="delete-btn"
          aria-label="delete"
          onClick={handleClickOpen}
          sx={{
            backgroundColor: theme.palette.background.lightBackground,
            color: theme.palette.highlightColor.main,
          }}
        >
          <DeleteIcon />
        </IconButton>
      )}

      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <Alert severity="error">
          <AlertTitle>
            Are you sure you want to delete record {recordId}?
          </AlertTitle>
          You cannot reverse this action! Be sure you wish to proceed.
        </Alert>
        <DialogActions style={{justifyContent: 'space-between'}}>
          <Button onClick={handleClose} color="primary">
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            disableElevation
            variant={'contained'}
            data-testid="confirm-delete"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
