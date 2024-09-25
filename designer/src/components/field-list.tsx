// Copyright 2023 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
  Button,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  TextField,
  DialogActions,
  MenuItem,
  Select,
} from '@mui/material';

import UnfoldMoreDoubleRoundedIcon from '@mui/icons-material/UnfoldMoreDoubleRounded';
import UnfoldLessDoubleRoundedIcon from '@mui/icons-material/UnfoldLessDoubleRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';

import {FieldEditor} from './field-editor';
import {useEffect, useState} from 'react';
import {useAppDispatch, useAppSelector} from '../state/hooks';
import {getFieldNames} from '../fields';

type Props = {
  viewSetId: string;
  viewId: string;
};

export const FieldList = ({viewSetId, viewId}: Props) => {
  console.log('FieldList', viewSetId, viewId);

  const fView = useAppSelector(
    state => state.notebook['ui-specification'].fviews[viewId]
  );
  const dispatch = useAppDispatch();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogState, setDialogState] = useState({
    name: 'New Text Field',
    type: 'TextField',
  });

  const allFieldNames = getFieldNames();

  const openDialog = () => {
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
  };

  const addField = () => {
    dispatch({
      type: 'ui-specification/fieldAdded',
      payload: {
        fieldName: dialogState.name,
        fieldType: dialogState.type,
        viewId: viewId,
        viewSetId: viewSetId,
      },
    });
    setDialogOpen(false);
  };

  const allClosed: {[key: string]: boolean} = {};
  const allOpen: {[key: string]: boolean} = {};

  const [isExpanded, setIsExpanded] = useState(allClosed);
  const [showCollapseButton, setShowCollapseButton] = useState(false);

  useEffect(() => {
    // if fView.label changes we are viewing a different
    // section, so reset all fields to be closed

    fView.fields.forEach((fieldName: string) => {
      allClosed[fieldName] = false;
    });

    fView.fields.forEach((fieldName: string) => {
      allOpen[fieldName] = true;
    });

    setIsExpanded(allClosed);
  }, [fView.label]);

  // can't do this with another useEffect because it might fire before
  // or after the other one, it then opens up random fields
  //
  // useEffect(() => {
  //   // if fViews.fields changes we check if there is a new
  //   // field (just added) and open it up
  //   fView.fields.forEach((fieldName: string) => {
  //     console.log('checking', fieldName, isExpanded[fieldName]);
  //     if (isExpanded[fieldName] === undefined) {
  //       setIsExpanded({
  //         ...isExpanded,
  //         [fieldName]: true,
  //       });
  //     }
  //   });
  // }, [fView.fields]);

  const handleExpandChange = (fieldName: string) => {
    return (_event: React.SyntheticEvent, expanded: boolean) => {
      setIsExpanded(prevState => ({
        ...prevState,
        [fieldName]: expanded,
      }));
    };
  };

  return (
    <>
      <Stack direction="row" spacing={1} mt={2}>
        <Button
          variant="outlined"
          size="small"
          onClick={openDialog}
          startIcon={<AddCircleOutlineRoundedIcon />}
        >
          Add a Field
        </Button>

        {showCollapseButton ? (
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setIsExpanded(allClosed);
              setShowCollapseButton(false);
            }}
            startIcon={<UnfoldLessDoubleRoundedIcon />}
          >
            Collapse All Fields
          </Button>
        ) : (
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setIsExpanded(allOpen);
              setShowCollapseButton(true);
            }}
            startIcon={<UnfoldMoreDoubleRoundedIcon />}
          >
            Expand All Fields
          </Button>
        )}
      </Stack>

      {fView.fields.map((fieldName: string) => {
        return (
          <FieldEditor
            key={fieldName}
            fieldName={fieldName}
            viewSetId={viewSetId}
            viewId={viewId}
            expanded={isExpanded[fieldName] ?? false}
            handleExpandChange={handleExpandChange(fieldName)}
          />
        );
      })}

      <Stack direction="row" spacing={1} mt={2}>
        <Button
          variant="outlined"
          size="small"
          onClick={openDialog}
          startIcon={<AddCircleOutlineRoundedIcon />}
        >
          Add a Field
        </Button>

        {showCollapseButton ? (
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setIsExpanded(allClosed);
              setShowCollapseButton(false);
            }}
            startIcon={<UnfoldLessDoubleRoundedIcon />}
          >
            Collapse All Fields
          </Button>
        ) : (
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setIsExpanded(allOpen);
              setShowCollapseButton(true);
            }}
            startIcon={<UnfoldMoreDoubleRoundedIcon />}
          >
            Expand All Fields
          </Button>
        )}
      </Stack>

      <Dialog open={dialogOpen} onClose={closeDialog}>
        <DialogTitle>New Field</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Create a new field in your form.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            id="name"
            label="Field Name"
            value={dialogState.name}
            fullWidth
            variant="standard"
            onChange={e => {
              setDialogState({
                ...dialogState,
                name: e.target.value,
              });
            }}
          />
          <Select
            name="type"
            label="Field Type"
            fullWidth
            value={dialogState.type}
            onChange={e => {
              setDialogState({
                ...dialogState,
                type: e.target.value,
              });
            }}
          >
            {allFieldNames.map((fieldName: string) => {
              return (
                <MenuItem key={fieldName} value={fieldName}>
                  {fieldName}
                </MenuItem>
              );
            })}
          </Select>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button onClick={addField}>Add Field</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
