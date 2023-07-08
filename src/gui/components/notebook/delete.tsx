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

import React, {useContext} from 'react';
import {useNavigate} from 'react-router-dom';

import {
  Button,
  IconButton,
  Dialog,
  DialogActions,
  AlertTitle,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import {Alert} from '@mui/material';

import {ActionType} from '../../../context/actions';
import * as ROUTES from '../../../constants/routes';
import {store} from '../../../context/store';
import {
  ProjectID,
  RecordID,
  RevisionID,
  setRecordAsDeleted,
} from 'faims3-datamodel';
import {getCurrentUserId} from '../../../users';
import {deleteStagedData} from '../../../sync/draft-storage';
import {deleteDraftsForRecord} from '../../../drafts';

type RecordDeleteProps = {
  project_id: ProjectID;
  record_id: RecordID;
  revision_id: RevisionID | null;
  draft_id: string | null;
  show_label: boolean;
  handleRefresh: () => Promise<any>;
};

async function deleteFromDB(
  project_id: ProjectID,
  record_id: RecordID,
  revision_id: RevisionID | null,
  draft_id: string | null,
  userid: string,
  callback: () => Promise<any>
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
  await callback();
}

export default function RecordDelete(props: RecordDeleteProps) {
  //console.debug('Delete props', props);
  const {project_id, record_id, revision_id, draft_id} = props;
  const [open, setOpen] = React.useState(false);
  const history = useNavigate();
  const globalState = useContext(store);
  const {dispatch} = globalState;
  const is_draft = draft_id !== null;
  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleDelete = () => {
    getCurrentUserId(project_id)
      .then(userid =>
        deleteFromDB(
          project_id,
          record_id,
          revision_id,
          draft_id,
          userid,
          props.handleRefresh
        )
      )
      .then(() => {
        const message = is_draft
          ? `Draft ${draft_id} for record ${record_id} discarded`
          : `Record ${record_id} deleted`;
        dispatch({
          type: ActionType.ADD_ALERT,
          payload: {
            message: message,
            severity: 'success',
          },
        });
        handleClose();
        history(ROUTES.NOTEBOOK + project_id);
      })
      .catch(err => {
        console.log('Failed to delete', record_id, draft_id, err);
        const message = is_draft
          ? `Draft ${draft_id} for record ${record_id} could not be discarded`
          : `Record ${record_id} could not be deleted`;
        dispatch({
          type: ActionType.ADD_ALERT,
          payload: {
            message: message,
            severity: 'error',
          },
        });
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
          startIcon={<DeleteIcon />}
        >
          {!is_draft ? 'Delete Record' : 'Discard Draft'}
        </Button>
      ) : (
        <IconButton
          data-testid="delete-btn"
          aria-label="delete"
          onClick={handleClickOpen}
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
