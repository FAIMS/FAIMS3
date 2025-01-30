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
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import {useState} from 'react';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {FieldType} from '../../state/initial';
import {BaseFieldEditor} from './BaseFieldEditor';

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
 *
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
 *
 */

interface SortableItemProps {
  id: string;
  option: {label: string; value: string};
  index: number;
  showExclusiveOptions?: boolean;
  exclusiveOptions: string[];
  onExclusiveToggle: (value: string) => void;
  onEdit: (value: string, index: number) => void;
  onRemove: (option: {label: string; value: string}) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
  totalItems: number;
}

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
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} =
    useSortable({id});

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
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
            onChange={() => onExclusiveToggle(option.value)}
            size="small"
          />
        </TableCell>
      )}
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
  fieldName: string;
  showExpandedChecklist?: boolean;
  showExclusiveOptions?: boolean;
}) => {
  const field = useAppSelector(
    state => state.notebook['ui-specification'].fields[fieldName]
  );
  const dispatch = useAppDispatch();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
                maxHeight: '400px',
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
                          <Tooltip title="Checking this setting marks the option as 'exclusive'. Exclusive options cannot be combined with other selections. For example, choosing 'None' will exclude other selections.">
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
                          onEdit={(value, index) => {
                            setEditingOption({value, index});
                            setEditValue(value);
                            setErrorMessage('');
                          }}
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
