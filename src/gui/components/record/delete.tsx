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
import {useHistory} from 'react-router-dom';

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
import {ProjectID, RecordID, RevisionID} from '../../../datamodel/core';
import {getCurrentUserId} from '../../../users';
import {setRecordAsDeleted} from '../../../data_storage';
import {deleteStagedData} from '../../../sync/draft-storage';

type RecordDeleteProps = {
  project_id: ProjectID;
  record_id: RecordID;
  revision_id: RevisionID | null;
  is_draft: boolean;
  show_label: boolean;
};

export default function RecordDelete(props: RecordDeleteProps) {
  const {project_id, record_id, revision_id} = props;
  const [open, setOpen] = React.useState(false);
  const history = useHistory();
  const globalState = useContext(store);
  const {dispatch} = globalState;
  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleDeletefunction = (userid: string) => {
    if (revision_id !== null)
      return setRecordAsDeleted(
        project_id,
        record_id,
        revision_id,
        userid
      ).then(() => {
        return record_id;
      });
    else
      return deleteStagedData(record_id, revision_id).then(() => {
        return record_id;
      });
  };

  const handleDelete = () => {
    getCurrentUserId(project_id)
      .then(userid => handleDeletefunction(userid))
      .then(() => {
        dispatch({
          type: ActionType.ADD_ALERT,
          payload: {
            message: 'Record ' + record_id + ' deleted',
            severity: 'success',
          },
        });
        history.push(ROUTES.NOTEBOOK + project_id);
      })
      .catch(err => {
        console.log('Could not delete record: ' + record_id, err);
        dispatch({
          type: ActionType.ADD_ALERT,
          payload: {
            message: 'Could not delete record: ' + record_id,
            severity: 'error',
          },
        });
      });
  };

  return (
    <div>
      {props.show_label ? (
        <Button
          variant="outlined"
          color="error"
          onClick={handleClickOpen}
          startIcon={<DeleteIcon />}
        >
          {!props.is_draft ? 'Delete Record' : 'Delete Draft'}
        </Button>
      ) : (
        <IconButton aria-label="delete" onClick={handleClickOpen}>
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
            Are you sure you want to delete{' '}
            {!props.is_draft ? 'record' : 'draft'} {record_id}?
          </AlertTitle>
          You cannot reverse this action! Be sure you wish to delete this{' '}
          {!props.is_draft ? 'record ' : 'draft. '}
          {!props.is_draft
            ? '(all associated drafts of this record will also be removed).'
            : ''}
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
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
RecordDelete.defaultProps = {
  show_label: true,
};
