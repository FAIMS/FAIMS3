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
import {selectActiveUser} from '../../../context/slices/authSlice';
import {addAlert} from '../../../context/slices/syncSlice';
import {useAppDispatch, useAppSelector} from '../../../context/store';
import {
  deleteStagedData,
  deleteDraftsForRecord,
} from '../../../sync/draft-storage';
import {theme} from '../../themes';

type RecordDeleteProps = {
  project_id: ProjectID;
  serverId: string;
  record_id: RecordID;
  revision_id: RevisionID | null;
  draft_id: string | null;
  show_label: boolean;
  handleRefresh: () => void;
};

async function deleteFromDB(
  project_id: ProjectID,
  record_id: RecordID,
  revision_id: RevisionID | null,
  draft_id: string | null,
  userid: string,
  callback: () => void
) {
  if (draft_id !== null) {
    await deleteStagedData(draft_id, null);
  } else {
    await setRecordAsDeleted(
      project_id,
      record_id,
      revision_id as RevisionID,
      userid
    );
    await deleteDraftsForRecord(project_id, record_id);
  }
  callback();
}

export default function RecordDelete(props: RecordDeleteProps) {
  //console.debug('Delete props', props);
  const {project_id, serverId, record_id, revision_id, draft_id} = props;
  const [open, setOpen] = React.useState(false);
  const history = useNavigate();
  const dispatch = useAppDispatch();
  const is_draft = draft_id !== null;
  const handleClickOpen = () => {
    setOpen(true);
  };
  const activeUser = useAppSelector(selectActiveUser)!;

  const handleClose = () => {
    setOpen(false);
  };

  const handleDelete = () => {
    deleteFromDB(
      project_id,
      record_id,
      revision_id,
      draft_id,
      activeUser.username,
      props.handleRefresh
    )
      .then(() => {
        const message = is_draft
          ? `Draft ${draft_id} for record ${record_id} discarded`
          : `Record ${record_id} deleted`;
        dispatch(
          addAlert({
            message: message,
            severity: 'success',
          })
        );
        handleClose();
        history(ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE + serverId + '/' + project_id);
      })
      .catch(err => {
        console.error('Failed to delete', record_id, draft_id, err);
        const message = is_draft
          ? `Draft ${draft_id} for record ${record_id} could not be discarded`
          : `Record ${record_id} could not be deleted`;
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
      {props.show_label ? (
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
          {!is_draft ? 'Delete Record' : 'Discard Draft'}
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
            Are you sure you want to {is_draft ? 'discard draft' : 'record'}{' '}
            {is_draft ? draft_id : record_id}?
          </AlertTitle>
          You cannot reverse this action! Be sure you wish to proceed
          {!is_draft
            ? ' (all associated drafts of this record will also be removed).'
            : '.'}
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
            {is_draft ? 'Discard' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
RecordDelete.defaultProps = {
  show_label: true,
};
