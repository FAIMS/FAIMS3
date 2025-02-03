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

import AddCircleIcon from '@mui/icons-material/AddCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import EditIcon from '@mui/icons-material/Edit';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  FormControlLabel,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {useState} from 'react';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {FieldType} from '../../state/initial';
import {BaseFieldEditor} from './BaseFieldEditor';

/**
 * OptionsEditor is a component for managing a list of options for radio buttons or multi-select fields.
 * Provides functionality to add, remove, reorder, edit, and display options, with an additional feature
 * to toggle between compact and expanded checklist views for multi-select fields.
 *
 * @param {string} fieldName - The name of the field being edited
 * @param {boolean} [showExpandedChecklist] - Whether to show the expanded checklist toggle control
 */
export const OptionsEditor = ({
  fieldName,
  showExpandedChecklist,
}: {
  fieldName: string;
  showExpandedChecklist?: boolean;
}) => {
  const field = useAppSelector(
    state => state.notebook['ui-specification'].fields[fieldName]
  );
  const dispatch = useAppDispatch();

  const isShowExpandedList =
    field['component-parameters'].ElementProps?.expandedChecklist ?? false;
  const showExpandedCheckListControl = showExpandedChecklist ?? false;

  const [newOption, setNewOption] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [editingOption, setEditingOption] = useState<{
    value: string;
    index: number;
  } | null>(null);
  const [editValue, setEditValue] = useState('');

  /**
   * Retrieves and normalizes the current list of options from the field configuration
   */
  const getOptions = () => {
    let options;
    if (field['component-parameters'].ElementProps) {
      options = field['component-parameters'].ElementProps.options;
      if (options) options = options.map(pair => pair.label.trim());
    } else {
      field['component-parameters'].ElementProps = {options: []};
    }
    return options || [];
  };

  const options = getOptions();

  /**
   * Validates option text for emptiness and duplicates
   * @param {string} text - The option text to validate
   * @param {number} [currentIndex] - Index of option being edited (to exclude from duplicate check)
   * @return Null if okay, string if error
   */
  const validateOptionText = (
    text: string,
    currentIndex?: number
  ): string | null => {
    if (text.trim().length === 0) {
      return 'Option text cannot be empty';
    }

    const duplicateExists = options.some((element: string, index: number) => {
      if (currentIndex !== undefined && index === currentIndex) return false;
      return element.toLowerCase() === text.toLowerCase();
    });

    if (duplicateExists) {
      return 'This option already exists in the list';
    }

    return null;
  };

  /**
   * Updates the options list in the Redux store
   * @param {string[]} updatedOptions - The new list of options
   */
  const updateOptions = (updatedOptions: string[]) => {
    const newField = JSON.parse(JSON.stringify(field)) as FieldType;
    newField['component-parameters'].ElementProps = {
      ...newField['component-parameters'].ElementProps,
      options: updatedOptions.map((o, index) => {
        if (fieldName.includes('radio')) {
          return {
            RadioProps: {
              id: 'radio-group-field-' + index,
            },
            label: o,
            value: o,
          };
        } else {
          return {
            label: o,
            value: o,
          };
        }
      }),
    };

    dispatch({
      type: 'ui-specification/fieldUpdated',
      payload: {fieldName, newField},
    });
  };

  /**
   * Toggles the expanded checklist view state
   */
  const toggleShowExpanded = () => {
    const newField = JSON.parse(JSON.stringify(field)) as FieldType;
    const existing =
      newField['component-parameters'].ElementProps?.expandedChecklist ?? false;
    const newValue = !existing;
    newField['component-parameters'].ElementProps = {
      ...(newField['component-parameters'].ElementProps ?? {}),
      expandedChecklist: newValue,
    };
    dispatch({
      type: 'ui-specification/fieldUpdated',
      payload: {fieldName, newField},
    });
  };

  /**
   * Handles adding a new option
   */
  const addOption = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const error = validateOptionText(newOption);

    if (error) {
      setErrorMessage(error);
    } else {
      const newOptions = [...options, newOption];
      updateOptions(newOptions);
      setErrorMessage('');
      setNewOption('');
    }
  };

  /**
   * Handles option deletion
   */
  const removeOption = (option: string) => {
    const newOptions = options.filter((o: string) => o !== option);
    updateOptions(newOptions);
  };

  /**
   * Handles option reordering
   */
  const moveOption = (index: number, direction: 'up' | 'down') => {
    const newOptions = [...options];
    const newIndex = direction === 'up' ? index - 1 : index + 1;

    if (newIndex >= 0 && newIndex < options.length) {
      [newOptions[index], newOptions[newIndex]] = [
        newOptions[newIndex],
        newOptions[index],
      ];
      updateOptions(newOptions);
    }
  };

  /**
   * Initiates option editing
   */
  const startEditing = (option: string, index: number) => {
    setEditingOption({value: option, index});
    setEditValue(option);
    setErrorMessage('');
  };

  /**
   * Handles edit submission
   */
  const handleEditSubmit = () => {
    if (!editingOption) return;

    const error = validateOptionText(editValue, editingOption.index);
    if (error) {
      setErrorMessage(error);
      return;
    }

    const newOptions = [...options];
    newOptions[editingOption.index] = editValue;
    updateOptions(newOptions);
    setEditingOption(null);
    setErrorMessage('');
  };

  return (
    <BaseFieldEditor fieldName={fieldName}>
      <Grid item xs={12}>
        <Card variant="outlined">
          <Grid container p={2} spacing={2}>
            <Grid item xs={12} sm={6}>
              <Alert severity="info">Add and remove options as needed.</Alert>
              <form onSubmit={addOption}>
                <Grid item alignItems="stretch" style={{display: 'flex'}}>
                  <TextField
                    label="Add Option"
                    value={newOption}
                    onChange={e => setNewOption(e.target.value)}
                    sx={{my: 1.5}}
                  />
                  <Button
                    color="primary"
                    startIcon={<AddCircleIcon />}
                    variant="outlined"
                    type="submit"
                    sx={{my: 1.5}}
                  >
                    ADD
                  </Button>
                </Grid>
              </form>
              {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
            </Grid>
            <Grid item xs={12} sm={6}>
              <List>
                {options.map((option: string, index: number) => (
                  <ListItem
                    key={option}
                    secondaryAction={
                      <Stack direction="row" spacing={1}>
                        <IconButton
                          size="small"
                          disabled={index === 0}
                          onClick={() => moveOption(index, 'up')}
                          aria-label="move option up"
                        >
                          <ArrowUpwardIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          disabled={index === options.length - 1}
                          onClick={() => moveOption(index, 'down')}
                          aria-label="move option down"
                        >
                          <ArrowDownwardIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => startEditing(option, index)}
                          aria-label="edit option"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          edge="end"
                          aria-label="delete option"
                          onClick={() => removeOption(option)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Stack>
                    }
                  >
                    <ListItemText primary={option} />
                  </ListItem>
                ))}
              </List>
            </Grid>
            {showExpandedCheckListControl && (
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={isShowExpandedList}
                      onChange={toggleShowExpanded}
                    />
                  }
                  label="Display multi-select as an expanded checklist?"
                />
              </Grid>
            )}
          </Grid>
        </Card>
      </Grid>

      <Dialog
        open={!!editingOption}
        onClose={() => {
          setEditingOption(null);
          setErrorMessage('');
        }}
      >
        <DialogTitle>Edit Option</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Option Text"
            fullWidth
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
          />
          {errorMessage && (
            <Alert severity="error" sx={{mt: 2}}>
              {errorMessage}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEditingOption(null);
              setErrorMessage('');
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleEditSubmit} color="primary">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </BaseFieldEditor>
  );
};
