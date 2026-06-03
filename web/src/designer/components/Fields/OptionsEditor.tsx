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
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import ArrowDropDownRoundedIcon from '@mui/icons-material/ArrowDropDownRounded';
import ArrowDropUpRoundedIcon from '@mui/icons-material/ArrowDropUpRounded';
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
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  IconButton,
  Radio,
  RadioGroup,
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
import {alpha} from '@mui/material/styles';
import {useMemo, useState} from 'react';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {FieldType} from '../../state/initial';
import {BaseFieldEditor} from './BaseFieldEditor';
import {SimpleFieldWrapper} from './SimpleFieldWrapper';
import {fieldUpdated, sectionConditionChanged} from '../../store/slices/uiSpec';
import {
  designerCancelButtonSx,
  designerCheckboxSx,
  designerDialogContentSx,
  designerDialogTitleSx,
  designerInfoIconSx,
} from '../designer-style';
import {DragHandle} from '../drag-handle';
import {
  findOptionReferences,
  updateConditionReferences,
} from '../../domain/conditions/conditionReferences';

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
  // item ID
  id: string;
  // option information
  option: {label: string; value: string};
  // index in the list
  index: number;
  // should we show exclusive options control/column
  showExclusiveOptions?: boolean;
  // if so, which are the exclusive options
  exclusiveOptions: string[];
  // handler for toggling exclusive
  onExclusiveToggle: (value: string) => void;
  // to change an option value
  onEdit: (value: string, index: number) => void;
  // when removed
  onRemove: (option: {label: string; value: string}) => void;
  // when moved up/down
  onMove: (index: number, direction: 'up' | 'down') => void;
  // how many items in total?
  totalItems: number;
}

const OTHER_OPTION_ID = '__other__';

interface OtherOptionRowProps {
  id: string;
  showExclusiveOptions?: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

/**
 * "Other" option row — drags via shared drag handle and also offers up/down
 * arrows to nudge its position, exactly like normal option rows. Not pinned.
 */
const SortableOtherOptionRow = ({
  id,
  showExclusiveOptions,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onRemove,
}: OtherOptionRowProps) => {
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
      sx={optionRowSx}
    >
      <TableCell sx={{width: {xs: 32, sm: 40}, py: 1}}>
        <DragHandle
          compact
          label="Drag Other option to reorder"
          dragAttributes={attributes}
          dragListeners={listeners}
        />
      </TableCell>

      <TableCell sx={{py: 1, minWidth: 0}}>
        <Tooltip title="Allows custom text input">
          <Typography
            sx={{
              maxWidth: '100%',
              fontSize: '0.875rem',
              whiteSpace: 'normal',
              overflowWrap: 'anywhere',
            }}
          >
            Other{' '}
            <Typography
              component="span"
              sx={{
                fontSize: '0.75rem',
                color: 'rgba(0, 0, 0, 0.6)',
              }}
            >
              (allows custom text input)
            </Typography>
          </Typography>
        </Tooltip>
      </TableCell>

      {/* Empty exclusive checkbox column for alignment */}
      {showExclusiveOptions && (
        <TableCell align="center" sx={{py: 1, width: {xs: 96, sm: 140}}} />
      )}

      <TableCell align="right" sx={{py: 1, width: {xs: 120, sm: 180}}}>
        <Tooltip title="Move up">
          <span>
            <IconButton
              size="small"
              disabled={isFirst}
              onClick={onMoveUp}
              sx={{p: {xs: 0.25, sm: 0.5}, color: 'text.secondary'}}
            >
              <ArrowDropUpRoundedIcon
                sx={{fontSize: '1.9rem', fontWeight: 700}}
              />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Move down">
          <span>
            <IconButton
              size="small"
              disabled={isLast}
              onClick={onMoveDown}
              sx={{p: {xs: 0.25, sm: 0.5}, color: 'text.secondary'}}
            >
              <ArrowDropDownRoundedIcon
                sx={{fontSize: '1.9rem', fontWeight: 700}}
              />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Remove 'Other' option">
          <IconButton
            size="small"
            onClick={onRemove}
            sx={{p: {xs: 0.25, sm: 0.5}, color: 'error.main'}}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
};

/** Shared row styling: subtle background + clear hover state + row divider. */
const optionRowSx = {
  backgroundColor: alpha('#000', 0.015),
  borderBottom: '1px solid',
  borderColor: alpha('#000', 0.08),
  transition: 'background-color 140ms ease',
  '&:last-of-type': {borderBottom: 'none'},
  '&:hover': {
    backgroundColor: alpha('#1976d2', 0.06),
  },
} as const;

/**
 * Individual sortable item row component for the options table
 * Handles drag-and-drop functionality and row actions
 *
 * @component
 * @param props - See SortableItemProps interface
 */
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
      sx={optionRowSx}
    >
      {/* Drag handle column */}
      <TableCell sx={{width: {xs: 32, sm: 40}, py: 1}}>
        <DragHandle
          compact
          label="Drag option to reorder"
          dragAttributes={attributes}
          dragListeners={listeners}
        />
      </TableCell>

      {/* Option text column with tooltip */}
      <TableCell sx={{py: 1, minWidth: 0}}>
        <Tooltip title={option.label}>
          <Typography
            sx={{
              maxWidth: '100%',
              fontSize: '0.875rem',
              whiteSpace: 'normal',
              overflowWrap: 'anywhere',
            }}
          >
            {option.label}
          </Typography>
        </Tooltip>
      </TableCell>

      {/* Optional exclusive checkbox column */}
      {showExclusiveOptions && (
        <TableCell align="center" sx={{py: 1, width: {xs: 96, sm: 140}}}>
          <Checkbox
            checked={exclusiveOptions.includes(option.value)}
            onChange={() => onExclusiveToggle(option.value)}
            size="small"
            sx={designerCheckboxSx}
          />
        </TableCell>
      )}

      {/* Action buttons column */}
      <TableCell align="right" sx={{py: 1, width: {xs: 120, sm: 180}}}>
        <Tooltip title="Move up">
          <span>
            <IconButton
              size="small"
              disabled={index === 0}
              onClick={() => onMove(index, 'up')}
              sx={{p: {xs: 0.25, sm: 0.5}, color: 'text.secondary'}}
            >
              <ArrowDropUpRoundedIcon
                sx={{fontSize: '1.9rem', fontWeight: 700}}
              />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Move down">
          <span>
            <IconButton
              size="small"
              disabled={index === totalItems - 1}
              onClick={() => onMove(index, 'down')}
              sx={{p: {xs: 0.25, sm: 0.5}, color: 'text.secondary'}}
            >
              <ArrowDropDownRoundedIcon
                sx={{fontSize: '1.9rem', fontWeight: 700}}
              />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Edit option">
          <IconButton
            size="small"
            onClick={() => onEdit(option.label, index)}
            sx={{p: {xs: 0.25, sm: 0.5}, color: 'success.main'}}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete option">
          <IconButton
            size="small"
            onClick={() => onRemove(option)}
            sx={{p: {xs: 0.25, sm: 0.5}, color: 'error.main'}}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
};

type CombinedRow =
  | {id: string; type: 'option'; option: {label: string; value: string}}
  | {id: string; type: 'other'};

/**
 * Select / MultiSelect / Radio options table: reorder (dnd), edit, exclusive sets, condition ref updates.
 */
export const OptionsEditor = ({
  fieldName,
  showExpandedChecklist,
  showExclusiveOptions,
}: {
  // Field name of this options editor
  fieldName: string;
  // should we show the expanded checklist control?
  showExpandedChecklist?: boolean;
  // should we show the exclusive options controls?
  showExclusiveOptions?: boolean;
}) => {
  // Get field state from Redux store
  const field = useAppSelector(
    state => state.notebook.uiSpec.present.fields[fieldName]
  );
  const allFields = useAppSelector(
    state => state.notebook.uiSpec.present.fields
  );
  const allFviews = useAppSelector(
    state => state.notebook.uiSpec.present.views
  );

  const dispatch = useAppDispatch();

  // Configure drag-and-drop sensors - just pointer sensor is fine
  const sensors = useSensors(useSensor(PointerSensor));

  // Component state
  const isShowExpandedList =
    field['component-parameters'].ElementProps?.expandedChecklist ?? true;
  const isDropdownMode = !isShowExpandedList;
  const showExpandedCheckListControl = showExpandedChecklist ?? false;
  const fieldComponent = field['component-name'];
  const isMultiSelectField = fieldComponent === 'MultiSelect';
  const [newOption, setNewOption] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [deleteDialogRefs, setDeleteDialogRefs] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<{
    value: string;
    index: number;
  } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [lastEditedOption, setLastEditedOption] = useState<string | null>(null);
  const addOptionHasError = Boolean(errorMessage) && !editingOption;

  // State for showing the alert inside the Edit Option dialog if the option is used in a condition
  const [renameDialogState, setRenameDialogState] = useState<{
    references: string[];
    updateConditions: boolean;
  } | null>(null);

  const options: Array<{label: string; value: string}> =
    field['component-parameters'].ElementProps?.options || [];
  const exclusiveOptions: string[] =
    field['component-parameters'].ElementProps?.exclusiveOptions || [];
  const enableOther: boolean =
    field['component-parameters'].ElementProps?.enableOtherOption ?? false;
  const otherOptionPosition: number =
    field['component-parameters'].ElementProps?.otherOptionPosition ??
    options.length;

  /**
   * made a combined list (options + other) in visual order.
   * This combined list is thee source of truth for sortable order.
   */
  const combinedRows: CombinedRow[] = useMemo(() => {
    const rows: CombinedRow[] = [];
    let insertedOther = false;

    if (!enableOther) {
      return options.map(o => ({id: o.value, type: 'option', option: o}));
    }

    const safeOtherPos = Math.max(
      0,
      Math.min(otherOptionPosition, options.length)
    );

    for (let i = 0; i <= options.length; i++) {
      if (i === safeOtherPos && !insertedOther) {
        rows.push({id: OTHER_OPTION_ID, type: 'other'});
        insertedOther = true;
      }
      if (i < options.length) {
        rows.push({id: options[i].value, type: 'option', option: options[i]});
      }
    }

    if (!insertedOther) {
      rows.push({id: OTHER_OPTION_ID, type: 'other'});
    }

    return rows;
  }, [enableOther, options, otherOptionPosition]);

  /**
   * Validates option text for duplicates and empty values
   * @param text - Option text to validate
   * @param currentIndex - Index of option being edited (for duplicate check)
   * @returns Error message string or null if valid
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
   * Updates field state in Redux store
   * @param updatedOptions - New options array
   * @param updatedExclusiveOptions - New exclusive options array
   */
  const updateField = (
    updatedOptions: Array<{label: string; value: string}>,
    updatedExclusiveOptions: string[],
    updatedOtherOptionPosition?: number
  ) => {
    const newField = JSON.parse(JSON.stringify(field)) as FieldType;

    // Update field with new options and handle radio button IDs
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
      ...(enableOther
        ? {
            otherOptionPosition:
              updatedOtherOptionPosition !== undefined
                ? updatedOtherOptionPosition
                : otherOptionPosition,
          }
        : updatedOtherOptionPosition !== undefined
          ? {otherOptionPosition: updatedOtherOptionPosition}
          : {}),
    };

    dispatch(fieldUpdated({fieldName, newField}));
  };

  /**
   * Used when user chooses to auto-update references in conditions
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
   * Handles drag-and-drop reordering for regular options only.
   * "Other" option uses arrow buttons for positioning (not drag-and-drop).
   */
  const handleDragEnd = (event: DragEndEvent) => {
    const {active, over} = event;

    if (!over) return;

    if (active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Only handle drag if we have a valid drop target and it's different from source
    // if (!over || active.id === over.id) return;

    const oldIndex = combinedRows.findIndex(r => r.id === activeId);
    const newIndex = combinedRows.findIndex(r => r.id === overId);

    if (oldIndex === -1 || newIndex === -1) return;

    const newCombined = arrayMove(combinedRows, oldIndex, newIndex);

    // Rebuild options array from the combined order (excluding Other)
    const optionMap = new Map(options.map(o => [o.value, o]));
    const newOptions = newCombined
      .filter(r => r.type === 'option')
      .map(r => optionMap.get(r.id))
      .filter(Boolean) as Array<{label: string; value: string}>;

    // Safety: if mapping failed, do nothing
    if (newOptions.length !== options.length) return;

    const newOtherOptionPosition = enableOther
      ? newCombined.findIndex(r => r.type === 'other')
      : undefined;

    updateField(newOptions, exclusiveOptions, newOtherOptionPosition);
  };

  /**
   * Moves option up or down using arrow buttons
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
   * Nudges the "Other" row up/down in the combined list. Other is never pinned —
   * its position is tracked independently via otherOptionPosition.
   */
  const moveOtherOption = (direction: 'up' | 'down') => {
    if (!enableOther) return;
    const current = Math.max(0, Math.min(otherOptionPosition, options.length));
    const next =
      direction === 'up'
        ? Math.max(0, current - 1)
        : Math.min(options.length, current + 1);
    if (next === current) return;
    updateField(options, exclusiveOptions, next);
  };

  /**
   * Handles adding new option submission
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
   * Toggles exclusive status of an option
   */
  const handleExclusiveToggle = (value: string) => {
    const newExclusiveOptions = exclusiveOptions.includes(value)
      ? exclusiveOptions.filter(o => o !== value)
      : [...exclusiveOptions, value];
    updateField(options, newExclusiveOptions);
  };

  /**
   * Removes an option from the list.
   * If the option is used in any condition, show a warning dialog instead.
   */
  const removeOption = (option: {label: string; value: string}) => {
    // Check if this option is referenced in any condition.
    const references = findOptionReferences(
      allFields,
      allFviews,
      fieldName,
      option.value
    );

    if (references.length > 0) {
      // Option is in use: open the warning dialog.
      setDeleteDialogRefs(references);
      setIsDeleteDialogOpen(true);
    } else {
      // Option is not used: proceed with deletion.
      const newOptions = options.filter(o => o.value !== option.value);
      const newExclusiveOptions = exclusiveOptions.filter(
        eo => eo !== option.value
      );
      updateField(newOptions, newExclusiveOptions);
    }
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
   * Switches between expanded checklist and dropdown display modes.
   */
  const setDisplayMode = (
    event: React.ChangeEvent<HTMLInputElement>,
    _value: string
  ) => {
    const selectedMode = event.target.value;
    const newField = JSON.parse(JSON.stringify(field)) as FieldType;
    newField['component-parameters'].ElementProps = {
      ...(newField['component-parameters'].ElementProps ?? {}),
      expandedChecklist: selectedMode === 'expanded',
    };
    dispatch(fieldUpdated({fieldName, newField}));
  };

  /**
   * "Other" option feature
   */
  const toggleEnableOtherOption = () => {
    const newField = JSON.parse(JSON.stringify(field)) as FieldType;
    const newValue =
      !field['component-parameters'].ElementProps?.enableOtherOption;

    newField['component-parameters'].ElementProps = {
      ...(newField['component-parameters'].ElementProps ?? {}),
      enableOtherOption: newValue,
      otherOptionPosition: undefined,
    };

    dispatch(fieldUpdated({fieldName, newField}));
  };

  return (
    <BaseFieldEditor fieldName={fieldName}>
      <Box sx={{width: '100%', mt: 1.5}}>
        <Typography
          component="h4"
          sx={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'text.primary',
            lineHeight: 1.25,
            letterSpacing: '0.012em',
            mb: 0.75,
          }}
        >
          Options
        </Typography>
        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1.25,
            p: {xs: 1.25, sm: 1.75},
            backgroundColor: '#fff',
          }}
        >
          <Grid container spacing={1.5}>
            {/* Options table */}
            <Grid size={12}>
              {options.length === 0 && !enableOther ? (
                <Typography
                  variant="body2"
                  sx={{color: 'text.secondary', py: 1.25, px: 0.5}}
                >
                  No options yet — add one below to get started.
                </Typography>
              ) : (
                <TableContainer
                  component={Box}
                  sx={{
                    border: 'none',
                    boxShadow: 'none',
                    borderRadius: 0,
                    maxHeight: '1000px',
                    overflow: 'auto',
                  }}
                >
                  <Table
                    size="small"
                    sx={{tableLayout: 'fixed', width: '100%'}}
                  >
                    <TableHead>
                      <TableRow
                        sx={{
                          backgroundColor: alpha('#000', 0.025),
                          '& .MuiTableCell-root': {
                            borderBottom: '1px solid',
                            borderColor: alpha('#000', 0.12),
                            fontWeight: 700,
                            fontSize: '0.78rem',
                            color: 'text.secondary',
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em',
                            py: 0.9,
                          },
                        }}
                      >
                        {/* drag-handle column — empty header */}
                        <TableCell sx={{width: {xs: 32, sm: 40}}} />
                        <TableCell>Option text</TableCell>
                        {showExclusiveOptions && (
                          <TableCell
                            align="center"
                            sx={{width: {xs: 96, sm: 140}}}
                          >
                            <Box
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.4,
                              }}
                            >
                              Exclusive
                              <Tooltip title="Marks the option as exclusive — selecting it clears any other selections in this field. Useful for choices like 'None of the above'.">
                                <InfoIcon
                                  sx={{
                                    ...designerInfoIconSx,
                                    fontSize: '1.1rem',
                                  }}
                                />
                              </Tooltip>
                            </Box>
                          </TableCell>
                        )}
                        <TableCell
                          align="right"
                          sx={{width: {xs: 120, sm: 180}}}
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
                          items={combinedRows.map(r => r.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {combinedRows.map((row, rowIdx) => {
                            if (row.type === 'other') {
                              return (
                                <SortableOtherOptionRow
                                  key={OTHER_OPTION_ID}
                                  id={OTHER_OPTION_ID}
                                  showExclusiveOptions={showExclusiveOptions}
                                  isFirst={rowIdx === 0}
                                  isLast={rowIdx === combinedRows.length - 1}
                                  onMoveUp={() => moveOtherOption('up')}
                                  onMoveDown={() => moveOtherOption('down')}
                                  onRemove={toggleEnableOtherOption}
                                />
                              );
                            }

                            const optionIndex = options.findIndex(
                              o => o.value === row.option.value
                            );

                            return (
                              <SortableItem
                                key={row.option.value}
                                id={row.option.value}
                                option={row.option}
                                index={optionIndex}
                                showExclusiveOptions={showExclusiveOptions}
                                exclusiveOptions={exclusiveOptions}
                                onExclusiveToggle={handleExclusiveToggle}
                                onEdit={(val, idx) =>
                                  handleOpenEditDialog(val, idx)
                                }
                                onRemove={removeOption}
                                onMove={moveOption}
                                totalItems={options.length}
                              />
                            );
                          })}
                        </SortableContext>
                      </DndContext>
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Grid>

            {/* Controls under table */}
            <Grid size={12}>
              <Box sx={{mt: 0.5}}>
                <form onSubmit={addOption}>
                  <Stack
                    direction={{xs: 'column', sm: 'row'}}
                    spacing={1}
                    sx={{mb: 1.5, alignItems: {xs: 'stretch', sm: 'flex-end'}}}
                  >
                    <Box sx={{width: {xs: '100%', sm: '52%', md: '48%'}}}>
                      <SimpleFieldWrapper
                        heading="Add option"
                        helperText={undefined}
                      >
                        <TextField
                          size="small"
                          placeholder="Add option"
                          value={newOption}
                          onChange={e => setNewOption(e.target.value)}
                          error={addOptionHasError}
                          focused={addOptionHasError}
                          fullWidth
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              ...(addOptionHasError && {
                                '& .MuiOutlinedInput-notchedOutline': {
                                  borderColor: 'error.main',
                                  borderWidth: 2,
                                },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline':
                                  {
                                    borderColor: 'error.main',
                                    borderWidth: 2,
                                  },
                              }),
                            },
                          }}
                        />
                      </SimpleFieldWrapper>
                    </Box>
                    <Button
                      color="primary"
                      variant="outlined"
                      size="small"
                      type="submit"
                      sx={{
                        width: {xs: '100%', sm: 'auto'},
                        minWidth: 56,
                        height: 40,
                        backgroundColor: '#fff',
                        borderColor: 'divider',
                        px: 2,
                        textTransform: 'none',
                        '&:hover': {
                          backgroundColor: '#f5f5f5',
                        },
                      }}
                    >
                      Add
                    </Button>
                    <Stack
                      direction="row"
                      spacing={0.65}
                      sx={{alignItems: 'center'}}
                    >
                      <Button
                        variant="outlined"
                        color="primary"
                        size="small"
                        onClick={toggleEnableOtherOption}
                        disabled={enableOther}
                        sx={{
                          width: {xs: '100%', sm: 'auto'},
                          minWidth: 56,
                          height: 40,
                          px: 2,
                        }}
                      >
                        Add "Other" Option
                      </Button>
                      <Tooltip title='Adds a special "Other" option allowing users to enter custom text beyond the predefined choices.'>
                        <InfoIcon
                          sx={{
                            ...(designerInfoIconSx as Record<string, unknown>),
                            ml: 0,
                          }}
                        />
                      </Tooltip>
                    </Stack>
                  </Stack>
                </form>

                {showExpandedCheckListControl && (
                  <FormControl sx={{mb: 0}}>
                    <FormLabel>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{alignItems: 'center'}}
                      >
                        <Typography component="span">
                          {isMultiSelectField
                            ? 'Multi-select display mode'
                            : 'Select-one display mode'}
                        </Typography>
                        <Tooltip
                          title={
                            isMultiSelectField
                              ? 'Choose how options are shown: as an expanded checklist or as a compact dropdown.'
                              : 'Choose how options are shown: as an expanded checklist or as a compact dropdown.'
                          }
                        >
                          <InfoIcon
                            sx={{
                              ...(designerInfoIconSx as Record<
                                string,
                                unknown
                              >),
                            }}
                          />
                        </Tooltip>
                      </Stack>
                    </FormLabel>
                    <RadioGroup
                      row
                      value={isDropdownMode ? 'dropdown' : 'expanded'}
                      onChange={setDisplayMode}
                    >
                      <FormControlLabel
                        value="expanded"
                        control={<Radio size="small" />}
                        label="Expanded checklist"
                      />
                      <FormControlLabel
                        value="dropdown"
                        control={<Radio size="small" />}
                        label="Dropdown list"
                      />
                    </RadioGroup>
                  </FormControl>
                )}

                {errorMessage && (
                  <Alert
                    severity="error"
                    sx={{
                      mt: 2,
                      width: {xs: '100%', sm: '52%', md: '48%'},
                    }}
                  >
                    {errorMessage}
                  </Alert>
                )}
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Box>

      {/* Edit option dialog */}
      <Dialog
        open={!!editingOption}
        onClose={() => setEditingOption(null)}
        slotProps={{
          transition: {
            onExited: () => {
              setRenameDialogState(null);
              setLastEditedOption(null);
            },
          },
        }}
      >
        <DialogTitle sx={designerDialogTitleSx}>Edit Option</DialogTitle>
        <DialogContent sx={designerDialogContentSx}>
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
          <Button
            sx={designerCancelButtonSx}
            onClick={() => setEditingOption(null)}
          >
            Cancel
          </Button>
          <Button onClick={handleEditSubmit} color="primary">
            Save
          </Button>
        </DialogActions>
      </Dialog>
      {/* Delete Option Warning Dialog */}
      <Dialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        slotProps={{
          transition: {
            onExited: () => {
              setDeleteDialogRefs([]);
            },
          },
        }}
      >
        <DialogTitle sx={designerDialogTitleSx}>
          Cannot Delete Option
        </DialogTitle>
        <DialogContent sx={designerDialogContentSx}>
          <Alert severity="warning">
            This option is used in the following conditions:
            <ul>
              {deleteDialogRefs.map((ref, idx) => (
                <li key={idx}>{ref}</li>
              ))}
            </ul>
            Please remove all dependencies on this option before deleting it.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button
            sx={designerCancelButtonSx}
            onClick={() => setIsDeleteDialogOpen(false)}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </BaseFieldEditor>
  );
};
