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

import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import InfoIcon from '@mui/icons-material/Info';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {useState} from 'react';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {FieldType} from '../../state/initial';
import {BaseFieldEditor} from './BaseFieldEditor';

/**
 * OptionsEditor is a component for managing a list of options for radio buttons or multi-select fields.
 * It provides functionality to add, remove, reorder, and edit options, with additional features
 * for expanded checklist views and exclusive options in multi-select fields.
 */
export const OptionsEditor = ({
  fieldName,
  showExpandedChecklist,
  showExclusiveOptions,
}: {
  fieldName: string;
  showExpandedChecklist?: boolean;
  showExclusiveOptions?: boolean;
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

  const options = field['component-parameters'].ElementProps?.options || [];
  const exclusiveOptions =
    field['component-parameters'].ElementProps?.exclusiveOptions || [];

  const validateOptionText = (
    text: string,
    currentIndex?: number
  ): string | null => {
    if (text.trim().length === 0) {
      return 'Option text cannot be empty';
    }

    const duplicateExists = options.some((element, index: number) => {
      if (currentIndex !== undefined && index === currentIndex) return false;
      return element.label.toLowerCase() === text.toLowerCase();
    });

    if (duplicateExists) {
      return 'This option already exists in the list';
    }

    return null;
  };

  const updateField = (
    updatedOptions: Array<{label: string; value: string}>,
    updatedExclusiveOptions: string[]
  ) => {
    const newField = JSON.parse(JSON.stringify(field)) as FieldType;

    newField['component-parameters'].ElementProps = {
      ...newField['component-parameters'].ElementProps,
      options: updatedOptions.map((o, index) => {
        if (fieldName.includes('radio')) {
          return {
            RadioProps: {id: 'radio-group-field-' + index},
            ...o,
          };
        }
        return o;
      }),
      exclusiveOptions: updatedExclusiveOptions,
    };

    dispatch({
      type: 'ui-specification/fieldUpdated',
      payload: {fieldName, newField},
    });
  };

  const addOption = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const error = validateOptionText(newOption);

    if (error) {
      setErrorMessage(error);
    } else {
      const newOptionObj = {label: newOption, value: newOption};
      updateField([...options, newOptionObj], exclusiveOptions);
      setErrorMessage('');
      setNewOption('');
    }
  };

  const handleExclusiveToggle = (value: string) => {
    const newExclusiveOptions = exclusiveOptions.includes(value)
      ? exclusiveOptions.filter(o => o !== value)
      : [...exclusiveOptions, value];
    updateField(options, newExclusiveOptions);
  };

  const moveOption = (index: number, direction: 'up' | 'down') => {
    const newOptions = [...options];
    const newIndex = direction === 'up' ? index - 1 : index + 1;

    if (newIndex >= 0 && newIndex < options.length) {
      [newOptions[index], newOptions[newIndex]] = [
        newOptions[newIndex],
        newOptions[index],
      ];
      updateField(newOptions, exclusiveOptions);
    }
  };

  const removeOption = (option: {label: string; value: string}) => {
    const newOptions = options.filter(o => o.value !== option.value);
    const newExclusiveOptions = exclusiveOptions.filter(
      eo => eo !== option.value
    );
    updateField(newOptions, newExclusiveOptions);
  };

  const handleEditSubmit = () => {
    if (!editingOption) return;

    const error = validateOptionText(editValue, editingOption.index);
    if (error) {
      setErrorMessage(error);
      return;
    }

    const oldValue = options[editingOption.index].value;
    const newOptions = [...options];
    newOptions[editingOption.index] = {label: editValue, value: editValue};

    const updatedExclusiveOptions = exclusiveOptions.map(eo =>
      eo === oldValue ? editValue : eo
    );

    updateField(newOptions, updatedExclusiveOptions);
    setEditingOption(null);
    setErrorMessage('');
  };

  const toggleShowExpanded = () => {
    const newField = JSON.parse(JSON.stringify(field)) as FieldType;
    const newValue = !isShowExpandedList;
    newField['component-parameters'].ElementProps = {
      ...(newField['component-parameters'].ElementProps ?? {}),
      expandedChecklist: newValue,
    };
    dispatch({
      type: 'ui-specification/fieldUpdated',
      payload: {fieldName, newField},
    });
  };

  return (
    <BaseFieldEditor fieldName={fieldName}>
      <Paper sx={{width: '100%', ml: 2, mt: 2, p: 3}}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Alert
              severity="info"
              sx={{
                mb: 2,
                backgroundColor: 'rgb(229, 246, 253)', // Lighter blue background
                '& .MuiAlert-icon': {
                  color: 'rgb(1, 67, 97)', // Darker blue icon
                },
              }}
            >
              Add and remove options as needed.
            </Alert>

            <Box sx={{mb: 2}}>
              <form onSubmit={addOption}>
                <Grid container spacing={1} alignItems="center">
                  <Grid item xs>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Add Option"
                      value={newOption}
                      onChange={e => setNewOption(e.target.value)}
                    />
                  </Grid>
                  <Grid item>
                    <Button
                      color="primary"
                      variant="outlined"
                      size="small"
                      type="submit"
                      sx={{
                        height: '40px',
                        backgroundColor: '#fff',
                        textTransform: 'none',
                        '&:hover': {
                          backgroundColor: '#f5f5f5',
                        },
                      }}
                    >
                      Add
                    </Button>
                  </Grid>
                </Grid>
              </form>
            </Box>

            {errorMessage && (
              <Alert severity="error" sx={{mt: 2, mb: 2}}>
                {errorMessage}
              </Alert>
            )}

            {showExpandedCheckListControl && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isShowExpandedList}
                    onChange={toggleShowExpanded}
                    size="small"
                  />
                }
                label={
                  <>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <p>Display multi-select as an expanded checklist?</p>
                      <Tooltip title="This option changes the multi-select from a dropdown menu, to a pre-expanded checklist of items. This takes up more space on the user's screen, but requires less clicks to interact with.">
                        <InfoIcon color="action" fontSize="small" />
                      </Tooltip>
                    </Stack>
                  </>
                }
                sx={{mb: 2}}
              />
            )}
          </Grid>

          <Grid item xs={12}>
            <TableContainer
              component={Paper}
              variant="outlined"
              sx={{
                border: '1px solid rgba(0, 0, 0, 0.12)',
                boxShadow: 'none',
                borderRadius: 1,
              }}
            >
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        backgroundColor: '#fafafa',
                        fontWeight: 500,
                        py: 1.5,
                      }}
                    >
                      Option Text
                    </TableCell>
                    {showExclusiveOptions && (
                      <TableCell
                        align="center"
                        sx={{
                          width: 140,
                          backgroundColor: '#fafafa',
                          fontWeight: 500,
                          py: 1.5,
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 0.5,
                          }}
                        >
                          Exclusive
                          <Tooltip title="When selected, this option cannot be combined with other options">
                            <InfoIcon color="action" fontSize="small" />
                          </Tooltip>
                        </Box>
                      </TableCell>
                    )}
                    <TableCell
                      align="right"
                      sx={{
                        width: 160,
                        backgroundColor: '#fafafa',
                        fontWeight: 500,
                        py: 1.5,
                      }}
                    >
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {options.map((option, index) => (
                    <TableRow key={option.value}>
                      <TableCell sx={{py: 1}}>
                        <Tooltip title={option.label}>
                          <Typography
                            noWrap
                            sx={{
                              maxWidth: 400,
                              fontSize: '0.875rem',
                            }}
                          >
                            {option.label}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      {showExclusiveOptions && (
                        <TableCell align="center" sx={{py: 1}}>
                          <Checkbox
                            checked={exclusiveOptions.includes(option.value)}
                            onChange={() => handleExclusiveToggle(option.value)}
                            size="small"
                          />
                        </TableCell>
                      )}
                      <TableCell align="right" sx={{py: 1}}>
                        <IconButton
                          size="small"
                          disabled={index === 0}
                          onClick={() => moveOption(index, 'up')}
                          sx={{p: 0.5}}
                        >
                          <ArrowUpwardIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          disabled={index === options.length - 1}
                          onClick={() => moveOption(index, 'down')}
                          sx={{p: 0.5}}
                        >
                          <ArrowDownwardIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditingOption({value: option.label, index});
                            setEditValue(option.label);
                            setErrorMessage('');
                          }}
                          sx={{p: 0.5}}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => removeOption(option)}
                          sx={{p: 0.5}}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
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
      </Paper>
    </BaseFieldEditor>
  );
};
