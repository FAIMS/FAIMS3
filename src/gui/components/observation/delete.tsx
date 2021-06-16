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
 * Filename: meta.tsx
 * Description:
 *   TODO
 */

import React, {useContext} from 'react';
import {ProjectID} from '../../../datamodel';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@material-ui/core';
import DeleteIcon from '@material-ui/icons/Delete';
import {deleteFAIMSDataForID} from '../../../dataStorage';
import {ActionType} from '../../../actions';
import * as ROUTES from '../../../constants/routes';
import {useHistory} from 'react-router-dom';
import {store} from '../../../store';
import {Alert} from '@material-ui/lab';
type ObservationDeleteProps = {
  project_id: ProjectID;
  observation_id: string;
};

export default function ObservationDelete(props: ObservationDeleteProps) {
  const {project_id, observation_id} = props;
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

  const handleDelete = () => {
    deleteFAIMSDataForID(project_id, observation_id)
      .then(() => {
        dispatch({
          type: ActionType.ADD_ALERT,
          payload: {
            message: 'Observation ' + observation_id + ' deleted',
            severity: 'success',
          },
        });
        history.push(ROUTES.PROJECT + project_id);
      })
      .catch(err => {
        console.log('Could not delete observation: ' + observation_id, err);
        dispatch({
          type: ActionType.ADD_ALERT,
          payload: {
            message: 'Could not delete observation: ' + observation_id,
            severity: 'error',
          },
        });
      });
  };

  return (
    <div>
      <Button
        variant="outlined"
        color="secondary"
        onClick={handleClickOpen}
        startIcon={<DeleteIcon />}
      >
        Delete observation
      </Button>
      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {'Delete observation ' + observation_id}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description" component={'div'}>
            <Alert severity="warning">
              You cannot reverse this action! Be sure you wish to delete this
              observation.
            </Alert>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="primary">
            Cancel
          </Button>
          <Button onClick={handleDelete} color="primary" variant={'contained'}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
