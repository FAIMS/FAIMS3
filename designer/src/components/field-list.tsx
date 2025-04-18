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
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Select,
  Stack,
} from '@mui/material';

import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import UnfoldLessDoubleRoundedIcon from '@mui/icons-material/UnfoldLessDoubleRounded';
import UnfoldMoreDoubleRoundedIcon from '@mui/icons-material/UnfoldMoreDoubleRounded';

import Typography from '@mui/material/Typography';
import {useEffect, useState} from 'react';
import {getFieldNames} from '../fields';
import {useAppDispatch, useAppSelector} from '../state/hooks';
import DebouncedTextField from './debounced-text-field';
import {FieldEditor} from './field-editor';

type Props = {
  viewSetId: string;
  viewId: string;
  moveFieldCallback: (targetViewId: string) => void;
};

export const FieldList = ({viewSetId, viewId, moveFieldCallback}: Props) => {
  const fView = useAppSelector(
    state => state.notebook['ui-specification'].present.fviews[viewId]
  );

  const fields = useAppSelector(
    state => state.notebook['ui-specification'].present.fields
  );

  const dispatch = useAppDispatch();

  const [hiddenExpanded, setHiddenExpanded] = useState(true);

  // Updated to check 'component-parameters.hidden'
  const hiddenFields = fView.fields.filter(
    fieldName => fields[fieldName]?.['component-parameters']?.hidden
  );

  const visibleFields = fView.fields.filter(
    fieldName => !fields[fieldName]?.['component-parameters']?.hidden
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogState, setDialogState] = useState({
    name: 'New Text Field',
    type: 'TextField',
  });
  const [addAfterField, setAddAfterField] = useState('');

  const allFieldNames = getFieldNames();

  const openDialog = () => {
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
  };

  const addFieldAfterCallback = (fieldName: string) => {
    setAddAfterField(fieldName);
    setDialogOpen(true);
  };

  const addField = () => {
    dispatch({
      type: 'ui-specification/fieldAdded',
      payload: {
        fieldName: dialogState.name,
        fieldType: dialogState.type,
        viewId: viewId,
        viewSetId: viewSetId,
        addAfter: addAfterField,
      },
    });
    setDialogOpen(false);
  };

  const allClosed: {[key: string]: boolean} = {};
  const allOpen: {[key: string]: boolean} = {};

  const [isExpanded, setIsExpanded] = useState(allClosed);
  const [showCollapseButton, setShowCollapseButton] = useState(false);

  const updateAllToggles = () => {
    fView.fields.forEach((fieldName: string) => {
      allClosed[fieldName] = false;
      allOpen[fieldName] = true;
    });
  };

  updateAllToggles();

  useEffect(() => {
    // if fView.label changes we are viewing a different
    // section, so reset all fields to be closed
    setIsExpanded(allClosed);
  }, [fView.label]);

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

      <Stack spacing={0} mt={2} mb={2}>
        <Typography variant="h6">Visible Fields</Typography>
        <Typography variant="body2" color="textSecondary">
          Visible fields will appear in the survey.
        </Typography>
      </Stack>
      {visibleFields.map((fieldName: string) => (
        <FieldEditor
          key={fieldName}
          fieldName={fieldName}
          viewSetId={viewSetId}
          viewId={viewId}
          expanded={isExpanded[fieldName] ?? false}
          addFieldCallback={addFieldAfterCallback}
          handleExpandChange={handleExpandChange(fieldName)}
          moveFieldCallback={(targetViewId: string) =>
            moveFieldCallback(targetViewId)
          }
        />
      ))}

      <Typography variant="h6" mt={2}>
        Hidden Fields
      </Typography>
      {hiddenFields.length > 0 ? (
        <>
          <div style={{padding: '16px 0'}}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setHiddenExpanded(!hiddenExpanded)}
              startIcon={
                hiddenExpanded ? (
                  <UnfoldLessDoubleRoundedIcon />
                ) : (
                  <UnfoldMoreDoubleRoundedIcon />
                )
              }
            >
              {hiddenExpanded
                ? 'Collapse Hidden Fields'
                : 'Expand Hidden Fields'}
            </Button>
          </div>
          {hiddenExpanded &&
            hiddenFields.map((fieldName: string) => (
              <FieldEditor
                key={fieldName}
                fieldName={fieldName}
                viewSetId={viewSetId}
                viewId={viewId}
                expanded={isExpanded[fieldName] ?? false}
                addFieldCallback={addFieldAfterCallback}
                moveFieldCallback={moveFieldCallback}
                handleExpandChange={handleExpandChange(fieldName)}
              />
            ))}
        </>
      ) : (
        <Typography variant="body2" color="textSecondary">
          No hidden fields
        </Typography>
      )}

      <Dialog open={dialogOpen} onClose={closeDialog}>
        <DialogTitle>New Field</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Create a new field in your form.
          </DialogContentText>
          <DebouncedTextField
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
