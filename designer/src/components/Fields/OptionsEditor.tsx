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
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import ArrowDropDownRoundedIcon from '@mui/icons-material/ArrowDropDownRounded';
import ArrowDropUpRoundedIcon from '@mui/icons-material/ArrowDropUpRounded';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
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
import {useEffect, useState} from 'react';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {FieldType} from '../../state/initial';
import {BaseFieldEditor} from './BaseFieldEditor';
import {findOptionReferences, updateConditionReferences} from '../condition';
import {
  fieldUpdated,
  sectionConditionChanged,
} from '../../state/uiSpec-reducer';

/**
 * OptionsEditor is a component for managing a list of options for radio buttons or multi-select fields.
 * It provides functionality to add, remove, reorder, and edit options, with additional features
 * for expanded checklist views and exclusive options in multi-select fields.
 *
 * Features:
 * - Drag and drop reordering of options using dnd-kit
 * - Arrow button controls for fine-grained reordering
 * - Add/remove/edit options
 * - Exclusive option selection for multi-select fields
 * - Expanded checklist view option
 * - Validation for duplicate and empty options
 *
 * Drag and drop implementation:
 * - DndContext: Provides drag-and-drop environment with sensors and collision detection
 * - SortableContext: Manages sortable items using vertical list strategy
 * - useSortable: Hook that provides drag attributes, listeners, and transform states
 *
 * Flow:
 * 1. DndContext wraps table with pointer/keyboard sensors
 * 2. SortableContext maps options to unique IDs
 * 3. SortableItem components use useSortable hook for drag functionality
 * 4. handleDragEnd reorders items on drop
 * 5. Visual feedback during drag
 */

/**
 * Props for the individual sortable item row component
 * used within the options table.
 */
interface SortableItemProps {
  id: string; // item ID
  option: {label: string; value: string}; // option information
  index: number; // index in the list
  showExclusiveOptions?: boolean; // should we show exclusive options control/column
  exclusiveOptions: string[]; // if so, which are the exclusive options
  onExclusiveToggle: (value: string) => void; // handler for toggling exclusive
  onEdit: (value: string, index: number) => void; // to change an option value
  onRemove: (option: {label: string; value: string}) => void; // when removed
  onMove: (index: number, direction: 'up' | 'down') => void; // when moved up/down
  totalItems: number; // how many items in total
}

/**
 * Individual sortable item row component for the options table
 * Handles drag-and-drop functionality and row actions
 *
 * @component
 * @param props - See SortableItemProps interface
 * */
const SortableItem = ({
  id,
  option,
  index,
  showExclusiveOptions,
  exclusiveOptions,
  onExclusiveToggle,
  onEdit,
  onRemove,
  onMove,
  totalItems,
}: SortableItemProps) => {
  // Initialize drag-and-drop functionality
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} =
    useSortable({id});

  return (
    <TableRow
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      {/* Drag handle column */}
      <TableCell sx={{width: '40px', py: 1}}>
        <IconButton
          size="small"
          sx={{cursor: 'grab', p: 0.5}}
          {...attributes}
          {...listeners}
        >
          <DragIndicatorIcon />
        </IconButton>
      </TableCell>

      {/* Option text column with tooltip */}
      <TableCell sx={{py: 1}}>
        <Tooltip title={option.label}>
          <Typography noWrap sx={{maxWidth: 400, fontSize: '0.875rem'}}>
            {option.label}
          </Typography>
        </Tooltip>
      </TableCell>

      {/* Optional exclusive checkbox column */}
      {showExclusiveOptions && (
        <TableCell align="center" sx={{py: 1}}>
          <Checkbox
            checked={exclusiveOptions.includes(option.value)}
            onChange={() => onExclusiveToggle(option.value)}
            size="small"
          />
        </TableCell>
      )}

      {/* Action buttons column */}
      <TableCell align="right" sx={{py: 1}}>
        <Tooltip title="Move up">
          <IconButton
            size="small"
            disabled={index === 0}
            onClick={() => onMove(index, 'up')}
            sx={{p: 0.5}}
          >
            <ArrowDropUpRoundedIcon fontSize="large" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Move down">
          <IconButton
            size="small"
            disabled={index === totalItems - 1}
            onClick={() => onMove(index, 'down')}
            sx={{p: 0.5}}
          >
            <ArrowDropDownRoundedIcon fontSize="large" />
          </IconButton>
        </Tooltip>

        <IconButton
          size="small"
          onClick={() => onEdit(option.label, index)}
          sx={{p: 0.5}}
        >
          <EditIcon fontSize="small" />
        </IconButton>

        <IconButton size="small" onClick={() => onRemove(option)} sx={{p: 0.5}}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </TableCell>
    </TableRow>
  );
};

export const OptionsEditor = ({
  fieldName,
  showExpandedChecklist,
  showExclusiveOptions,
}: {
  // Field name of this options editor
  fieldName: string;
  // optionally show the expanded checklist control
  showExpandedChecklist?: boolean;
  // optionally show the exclusive options control
  showExclusiveOptions?: boolean;
}) => {
  // Get field state from Redux store
  const field = useAppSelector(
    state => state.notebook['ui-specification'].fields[fieldName]
  );
  const allFields = useAppSelector(
    state => state.notebook['ui-specification'].fields
  );
  const allFviews = useAppSelector(
    state => state.notebook['ui-specification'].fviews
  );

  const dispatch = useAppDispatch();

  // Set up drag-and-drop sensors
  const sensors = useSensors(useSensor(PointerSensor));

  // Local component state
  const [newOption, setNewOption] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [editingOption, setEditingOption] = useState<{
    value: string;
    index: number;
  } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [lastEditedOption, setLastEditedOption] = useState<string | null>(null);

  // State for showing the alert inside the Edit Option dialog if the option is used in a condition
  const [renameDialogState, setRenameDialogState] = useState<{
    references: string[];
    updateConditions: boolean;
  } | null>(null);

  const options = field['component-parameters'].ElementProps?.options || [];
  const exclusiveOptions =
    field['component-parameters'].ElementProps?.exclusiveOptions || [];

  /**
   * Validate the user-entered text for a new or edited option
   */
  const validateOptionText = (
    text: string,
    currentIndex?: number
  ): string | null => {
    if (text.trim().length === 0) {
      return 'Option text cannot be empty';
    }

    const duplicateExists = options.some((element, idx: number) => {
      if (currentIndex !== undefined && idx === currentIndex) return false;
      return element.label.toLowerCase() === text.toLowerCase();
    });

    return duplicateExists ? 'This option already exists in the list' : null;
  };

  /**
   * Update the field in Redux with new or changed options
   */
  const updateField = (
    updatedOptions: Array<{label: string; value: string}>,
    updatedExclusiveOptions: string[]
  ) => {
    const newField = JSON.parse(JSON.stringify(field)) as FieldType;

    newField['component-parameters'].ElementProps = {
      ...newField['component-parameters'].ElementProps,
      options: updatedOptions.map((o, i) => {
        // For radio fields, attach a special ID
        if (fieldName.includes('radio')) {
          return {
            RadioProps: {id: 'radio-group-field-' + i},
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

  /**
   * If user chooses to auto-update references in conditions
   */
  const updateConditions = (oldValue: string, newValue: string) => {
    // Field-level conditions
    for (const fId in allFields) {
      const fieldDef = allFields[fId];
      if (!fieldDef.condition) continue;

      const updatedCondition = updateConditionReferences(
        fieldDef.condition,
        fieldName,
        oldValue,
        newValue
      );

      if (updatedCondition !== fieldDef.condition) {
        dispatch(
          fieldUpdated({
            fieldName: fId,
            newField: {...fieldDef, condition: updatedCondition},
          })
        );
      }
    }

    // Section-level conditions
    for (const vId in allFviews) {
      const sectionDef = allFviews[vId];
      if (!sectionDef.condition) continue;

      const updatedCondition = updateConditionReferences(
        sectionDef.condition,
        fieldName,
        oldValue,
        newValue
      );

      if (updatedCondition !== sectionDef.condition) {
        dispatch(
          sectionConditionChanged({viewId: vId, condition: updatedCondition})
        );
      }
    }
  };

  /**
   * handleDragEnd is triggered after a user finishes dragging an option
   */
  const handleDragEnd = (event: DragEndEvent) => {
    const {active, over} = event;
    if (over && active.id !== over.id) {
      const oldIndex = options.findIndex(item => item.value === active.id);
      const newIndex = options.findIndex(item => item.value === over.id);

      const newOptions = [...options];
      const [movedItem] = newOptions.splice(oldIndex, 1);
      newOptions.splice(newIndex, 0, movedItem);

      updateField(newOptions, exclusiveOptions);
    }
  };

  /**
   * Moves an option up or down in the list
   */
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

  /**
   * Add a new option via user form submission
   */
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

  /**
   * Toggle an option's "exclusive" flag (for multi-select)
   */
  const handleExclusiveToggle = (value: string) => {
    const newExclusiveOptions = exclusiveOptions.includes(value)
      ? exclusiveOptions.filter(o => o !== value)
      : [...exclusiveOptions, value];

    updateField(options, newExclusiveOptions);
  };

  /**
   * Removes an existing option from the list
   */
  const removeOption = (option: {label: string; value: string}) => {
    const newOptions = options.filter(o => o.value !== option.value);
    const newExclusiveOptions = exclusiveOptions.filter(
      eo => eo !== option.value
    );
    updateField(newOptions, newExclusiveOptions);
  };

  /**
   * Open the dialog to edit an existing option
   */
  const handleOpenEditDialog = (value: string, index: number) => {
    setEditingOption({value, index});
    setEditValue(value);
    setLastEditedOption(value);

    // Check if this option is referenced in conditions
    const references = findOptionReferences(
      allFields,
      allFviews,
      fieldName,
      value
    );
    if (references.length > 0) {
      setRenameDialogState({references, updateConditions: true});
    } else {
      setRenameDialogState(null);
    }
  };

  /**
   * Actually rename the option in the Redux store (does not alter conditions)
   */
  const doRenameOption = (newValue: string, index: number) => {
    const newOptions = [...options];
    newOptions[index] = {label: newValue, value: newValue};

    const newField: FieldType = {
      ...field,
      'component-parameters': {
        ...field['component-parameters'],
        ElementProps: {
          ...field['component-parameters'].ElementProps,
          options: newOptions,
        },
      },
    };

    dispatch(fieldUpdated({fieldName, newField}));
  };

  /**
   * Finalizes the edit, optionally updates conditions
   */
  const handleEditSubmit = () => {
    if (!editingOption) return;

    const newValue = editValue.trim();
    if (!newValue || editingOption.value === newValue) {
      setEditingOption(null);
      return;
    }

    // Validate before renaming
    const error = validateOptionText(newValue, editingOption.index);
    if (error) {
      setErrorMessage(error);
      return;
    }

    // Rename in Redux
    doRenameOption(newValue, editingOption.index);

    // If chosen, also update references in conditions
    if (renameDialogState?.updateConditions) {
      updateConditions(editingOption.value, newValue);
    }

    // Close dialog
    setEditingOption(null);
  };

  /**
   * Toggles whether multi-select is displayed as an expanded checklist
   */
  const toggleShowExpanded = () => {
    const newField = JSON.parse(JSON.stringify(field)) as FieldType;
    const newValue =
      !field['component-parameters'].ElementProps?.expandedChecklist;

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
                backgroundColor: 'rgb(229, 246, 253)',
                '& .MuiAlert-icon': {
                  color: 'rgb(1, 67, 97)',
                },
              }}
            >
              Add and remove options as needed. Drag items or use arrows to
              reorder them.
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

            {field['component-parameters'].ElementProps?.expandedChecklist !==
              undefined && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={
                      field['component-parameters'].ElementProps
                        ?.expandedChecklist
                    }
                    onChange={toggleShowExpanded}
                    size="small"
                  />
                }
                label={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <p>Display multi-select as an expanded checklist?</p>
                    <Tooltip title="This option changes the multi-select from a dropdown menu to a pre-expanded checklist of items. This takes up more space, but requires fewer clicks to interact with.">
                      <InfoIcon color="action" fontSize="small" />
                    </Tooltip>
                  </Stack>
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
                maxHeight: '1000px',
                overflow: 'auto',
              }}
            >
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        width: '40px',
                        backgroundColor: '#fafafa',
                        fontWeight: 500,
                        py: 1.5,
                      }}
                    />
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
                          <Tooltip title="Marking an option as 'exclusive' means it cannot be combined with other selections. For instance, choosing 'None' excludes all other choices.">
                            <InfoIcon color="action" fontSize="small" />
                          </Tooltip>
                        </Box>
                      </TableCell>
                    )}
                    <TableCell
                      align="right"
                      sx={{
                        width: 180,
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
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={options.map(o => o.value)}
                      strategy={verticalListSortingStrategy}
                    >
                      {options.map((option, index) => (
                        <SortableItem
                          key={option.value}
                          id={option.value}
                          option={option}
                          index={index}
                          showExclusiveOptions={showExclusiveOptions}
                          exclusiveOptions={exclusiveOptions}
                          onExclusiveToggle={handleExclusiveToggle}
                          onEdit={(val, idx) => handleOpenEditDialog(val, idx)}
                          onRemove={removeOption}
                          onMove={moveOption}
                          totalItems={options.length}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        </Grid>

        {/* Edit Option Dialog */}
        <Dialog
          open={!!editingOption}
          onClose={() => setEditingOption(null)}
          TransitionProps={{
            onExited: () => {
              setRenameDialogState(null);
              setLastEditedOption(null);
            },
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

            {renameDialogState && (
              <Alert severity="warning" sx={{mt: 2}}>
                <Typography variant="body2" sx={{mb: 1}}>
                  The option "<strong>{lastEditedOption}</strong>" is used in:
                </Typography>
                <ul>
                  {renameDialogState.references.map((r, idx) => (
                    <li key={idx}>{r}</li>
                  ))}
                </ul>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={renameDialogState.updateConditions}
                      onChange={e =>
                        setRenameDialogState(prev =>
                          prev
                            ? {...prev, updateConditions: e.target.checked}
                            : null
                        )
                      }
                    />
                  }
                  label="Automatically update conditions to use the new option name"
                  sx={{mt: 1}}
                />
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditingOption(null)}>Cancel</Button>
            <Button onClick={handleEditSubmit} color="primary">
              Save
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </BaseFieldEditor>
  );
};
