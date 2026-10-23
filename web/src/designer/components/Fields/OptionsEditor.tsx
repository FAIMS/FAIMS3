// SPDX-License-Identifier: Apache-2.0

import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
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
import {ChoiceElementProps} from '@faims3/forms';
import ArrowDropDownRoundedIcon from '@mui/icons-material/ArrowDropDownRounded';
import ArrowDropUpRoundedIcon from '@mui/icons-material/ArrowDropUpRounded';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import InfoIcon from '@mui/icons-material/Info';
import SyncIcon from '@mui/icons-material/Sync';
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
  InputAdornment,
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
import {
  findOptionReferences,
  updateConditionReferences,
} from '../../domain/conditions/conditionReferences';
import {slugify} from '../../domain/notebook/ids';
import {designerHtmlInput, INPUT_LIMITS} from '../../lib/input-limits';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {FieldType} from '../../state/initial';
import {fieldUpdated, sectionConditionChanged} from '../../store/slices/uiSpec';
import {
  designerCancelButtonSx,
  designerCheckboxSx,
  designerDialogContentSx,
  designerDialogTitleSx,
  designerInfoIconSx,
} from '../designer-style';
import {DragHandle} from '../drag-handle';
import {BaseFieldEditor} from './BaseFieldEditor';
import {SimpleFieldWrapper} from './SimpleFieldWrapper';

/**
 * Subset of choice-field `component-parameters` this editor reads/writes. The
 * `ElementProps` shape is the shared {@link ChoiceElementProps} used by
 * RadioGroup, Select and MultiSelect in `@faims3/forms`; keys are optional here
 * because the editor patches them incrementally.
 */
type ChoiceOption = ChoiceElementProps['options'][number];
type ChoiceComponentParameters = {ElementProps?: Partial<ChoiceElementProps>};

/**
 * Generate a unique option ID from its label.
 * @param label - Option label used to generate the ID.
 * @param usedIds - Set of existing and reserved IDs to avoid duplicates.
 * @returns A unique ID within the maximum allowed length.
 */
const generateUniqueOptionId = (
  label: string,
  usedIds: Set<string>
): string => {
  // Generate an ID from the option label, respecting the length limit.
  const base = (slugify(label) || 'option').slice(
    0,
    INPUT_LIMITS.ID_MAX_LENGTH
  );

  let id = base;
  let suffix = 2;

  // Add a numeric suffix if the generated ID is already in use.
  while (usedIds.has(id)) {
    const suffixText = `-${suffix++}`;
    id = `${base.slice(0, INPUT_LIMITS.ID_MAX_LENGTH - suffixText.length)}${suffixText}`;
  }

  return id;
};

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

// Internal drag-and-drop identity, Other has no stored option ID.
const OTHER_ROW_DND_ID = '__other__';

// Keep the drag handle aligned to the left.
const dragHandleCellSx = {
  whiteSpace: 'nowrap',
  py: 1,
  pl: 1,
  pr: {md: 1, lg: 2},
} as const;

// exclusive and actions
const compactCellSx = {
  whiteSpace: 'nowrap',
  py: 1,
  px: {md: 1, lg: 2},
} as const;

// option text and option id
const textCellSx = {
  // Give Option text and Option ID equal shares of the available space.
  width: '50%',
  minWidth: 0,
  py: 1,
  overflowWrap: 'anywhere',
} as const;

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
      <TableCell sx={dragHandleCellSx}>
        <DragHandle
          compact
          label="Drag Other option to reorder"
          dragAttributes={attributes}
          dragListeners={listeners}
        />
      </TableCell>

      <TableCell sx={textCellSx}>
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

      {/* Other is configured separately, it has no Other option ID. Empty column for alignment */}
      <TableCell sx={textCellSx} />

      {/* Empty exclusive checkbox column for alignment */}
      {showExclusiveOptions && <TableCell align="center" sx={compactCellSx} />}

      <TableCell align="right" sx={compactCellSx}>
        <Tooltip title={isFirst ? 'Already at the top' : 'Move up'}>
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
        <Tooltip title={isLast ? 'Already at the bottom' : 'Move down'}>
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
        {/* Reserve space for the Edit button to align actions. */}
        <IconButton
          size="small"
          sx={{
            visibility: 'hidden',
            p: {xs: 0.25, sm: 0.5},
          }}
          aria-hidden
          tabIndex={-1}
        >
          <EditIcon fontSize="small" />
        </IconButton>
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

// Allow option text and IDs to wrap within their columns.
const optionTextSx = {
  maxWidth: '100%',
  fontSize: '0.875rem',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
} as const;

interface SortableItemProps {
  // item ID
  id: string;
  // Option data (ID, value, and label)
  option: ChoiceOption;
  // Whether the row is at either end of the displayed list.
  isFirst: boolean;
  isLast: boolean;
  // should we show exclusive options control/column
  showExclusiveOptions?: boolean;
  // if so, which are the exclusive options
  exclusiveOptions: string[];
  // handler for toggling exclusive
  onExclusiveToggle: (value: string) => void;
  // Open the option editor
  onEdit: (optionId: string) => void;
  // when removed
  onRemove: (option: ChoiceOption) => void;
  // when moved up/down
  onMove: (optionId: string, direction: 'up' | 'down') => void;
}

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
  isFirst,
  isLast,
  showExclusiveOptions,
  exclusiveOptions,
  onExclusiveToggle,
  onEdit,
  onRemove,
  onMove,
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
      <TableCell sx={dragHandleCellSx}>
        <DragHandle
          compact
          label="Drag option to reorder"
          dragAttributes={attributes}
          dragListeners={listeners}
        />
      </TableCell>

      {/* Option text column with tooltip */}
      <TableCell sx={textCellSx}>
        <Tooltip title={option.label}>
          <Typography sx={optionTextSx}>{option.label}</Typography>
        </Tooltip>
      </TableCell>

      {/* Option ID column */}
      <TableCell sx={textCellSx}>
        <Tooltip title={option.id}>
          <Typography sx={optionTextSx}>{option.id}</Typography>
        </Tooltip>
      </TableCell>

      {/* Optional exclusive checkbox column */}
      {showExclusiveOptions && (
        <TableCell align="center" sx={compactCellSx}>
          <Checkbox
            checked={exclusiveOptions.includes(option.value)}
            onChange={() => onExclusiveToggle(option.value)}
            size="small"
            sx={designerCheckboxSx}
          />
        </TableCell>
      )}

      {/* Action buttons column */}
      <TableCell align="right" sx={compactCellSx}>
        <Tooltip title={isFirst ? 'Already at the top' : 'Move up'}>
          <span>
            <IconButton
              size="small"
              disabled={isFirst}
              onClick={() => onMove(option.id, 'up')}
              sx={{p: {xs: 0.25, sm: 0.5}, color: 'text.secondary'}}
            >
              <ArrowDropUpRoundedIcon
                sx={{fontSize: '1.9rem', fontWeight: 700}}
              />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={isLast ? 'Already at the bottom' : 'Move down'}>
          <span>
            <IconButton
              size="small"
              disabled={isLast}
              onClick={() => onMove(option.id, 'down')}
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
            onClick={() => onEdit(option.id)}
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

/** Editable option values, keeping the original ID for lookup. */
type EditingOption = {
  originalId: string;
  id: string;
  label: string;
};

/** Condition references and whether to update them on rename. */
type RenameDialogState = {
  references: string[];
  updateConditions: boolean;
};

interface EditOptionDialogProps {
  // Option currently being edited, or null when closed.
  editingOption: EditingOption | null;
  setEditingOption: React.Dispatch<React.SetStateAction<EditingOption | null>>;
  // All options, used to generate a unique ID
  options: ChoiceOption[];
  // Original label, used to detect renaming.
  originalLabel?: string;
  // Condition references and update preference.
  renameDialogState: RenameDialogState | null;
  // Update the condition reference preference.
  setRenameDialogState: React.Dispatch<
    React.SetStateAction<RenameDialogState | null>
  >;
  // validation error to display.
  errorMessage: string;
  setErrorMessage: React.Dispatch<React.SetStateAction<string>>;
  // Save the edited option.
  onSave: () => void;
  // Close the dialog.
  onClose: () => void;
  // ean up state after the dialog closes.
  onExited: () => void;
}

/** Dialog for editing an option's label and ID. */
const EditOptionDialog = ({
  editingOption,
  setEditingOption,
  options,
  originalLabel,
  renameDialogState,
  setRenameDialogState,
  errorMessage,
  setErrorMessage,
  onSave,
  onClose,
  onExited,
}: EditOptionDialogProps) => {
  // Generate a unique ID without including the option being edited.
  const suggestedId = editingOption
    ? generateUniqueOptionId(
        editingOption.label,
        new Set([
          ...options
            .filter(option => option.id !== editingOption.originalId)
            .map(option => option.id),
          OTHER_ROW_DND_ID,
        ])
      )
    : '';

  const showSync = !!editingOption && suggestedId !== editingOption.id;

  return (
    <Dialog
      open={!!editingOption}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{
        transition: {onExited},
      }}
    >
      <DialogTitle sx={designerDialogTitleSx}>Edit Option</DialogTitle>

      <DialogContent sx={designerDialogContentSx}>
        <TextField
          autoFocus
          margin="dense"
          label="Display label"
          fullWidth
          value={editingOption?.label ?? ''}
          onChange={e => {
            setEditingOption(previous =>
              previous ? {...previous, label: e.target.value} : null
            );
            setErrorMessage('');
          }}
          slotProps={{
            htmlInput: designerHtmlInput(INPUT_LIMITS.SHORT_TEXT_MAX_LENGTH),
          }}
        />

        <TextField
          margin="dense"
          label="Option ID"
          fullWidth
          value={editingOption?.id ?? ''}
          onChange={e =>
            setEditingOption(previous =>
              previous ? {...previous, id: e.target.value} : null
            )
          }
          slotProps={{
            htmlInput: designerHtmlInput(INPUT_LIMITS.ID_MAX_LENGTH),
            input: {
              endAdornment: showSync ? (
                <InputAdornment position="end">
                  <Tooltip title="Sync ID with label">
                    <IconButton
                      aria-label="Sync ID with label"
                      size="small"
                      edge="end"
                      onClick={() => {
                        setEditingOption(previous =>
                          previous ? {...previous, id: suggestedId} : null
                        );
                        setErrorMessage('');
                      }}
                    >
                      <SyncIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ) : undefined,
            },
          }}
        />

        {errorMessage && (
          <Alert severity="error" sx={{mt: 2}}>
            {errorMessage}
          </Alert>
        )}
        {renameDialogState && editingOption?.label.trim() !== originalLabel && (
          <Alert severity="warning" sx={{mt: 2}}>
            <Typography variant="body2" sx={{mb: 1}}>
              The option "<strong>{originalLabel}</strong>" is used in:
            </Typography>
            <ul>
              {renameDialogState.references.map((ref, index) => (
                <li key={index}>{ref}</li>
              ))}
            </ul>
            <FormControlLabel
              control={
                <Checkbox
                  checked={renameDialogState.updateConditions}
                  onChange={e =>
                    setRenameDialogState(previous =>
                      previous
                        ? {...previous, updateConditions: e.target.checked}
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
        <Button sx={designerCancelButtonSx} onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onSave} color="primary">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

type CombinedRow =
  | {id: string; type: 'option'; option: ChoiceOption}
  | {id: string; type: 'other'};

/**
 * Choice options table: reorder options and edit IDs while preserving label rename behaviour.
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
  const allViews = useAppSelector(state => state.notebook.uiSpec.present.views);

  const dispatch = useAppDispatch();

  // Configure drag-and-drop sensors - just pointer sensor is fine
  const sensors = useSensors(useSensor(PointerSensor));

  const elementProps = (
    field['component-parameters'] as ChoiceComponentParameters
  ).ElementProps;

  // Component state
  const isShowExpandedList = elementProps?.expandedChecklist ?? true;
  const isDropdownMode = !isShowExpandedList;
  const showExpandedCheckListControl = showExpandedChecklist ?? false;
  const fieldComponent = field['component-name'];
  const isMultiSelectField = fieldComponent === 'MultiSelect';
  const [newOption, setNewOption] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [deleteDialogRefs, setDeleteDialogRefs] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [editingOption, setEditingOption] = useState<EditingOption | null>(
    null
  );

  const addOptionHasError = Boolean(errorMessage) && !editingOption;

  const [renameDialogState, setRenameDialogState] =
    useState<RenameDialogState | null>(null);

  // Preserve existing IDs and generate unique IDs for options with no ID.
  // The Other option is stored separately, not included in either options or elementProps?.options
  const options: ChoiceOption[] = useMemo(() => {
    const source = elementProps?.options ?? [];

    // Collect existing IDs and reserve the internal Other drag ID.
    const usedIds = new Set(source.map(option => option.id).filter(Boolean));
    usedIds.add(OTHER_ROW_DND_ID);

    return source.map(option => {
      // Keep existing option IDs unchanged.
      if (option.id) return option;
      // Generate and reserve a unique ID for this option.
      const id = generateUniqueOptionId(option.label, usedIds);
      usedIds.add(id);
      return {...option, id};
    });
  }, [elementProps?.options]);

  // Find the original option being edited by its ID.
  const editingOriginal = options.find(o => o.id === editingOption?.originalId);
  const exclusiveOptions: string[] = elementProps?.exclusiveOptions || [];
  const enableOther: boolean = elementProps?.enableOtherOption ?? false;
  // Use the saved Other position, or default to the end of the options list.
  const otherOptionPosition: number =
    elementProps?.otherOptionPosition ?? options.length;

  /**
   * made a combined list (options + other) in visual order.
   * This combined list is thee source of truth for sortable order.
   */
  const combinedRows: CombinedRow[] = useMemo(() => {
    // Create rows for regular options.
    const rows: CombinedRow[] = options.map(option => ({
      id: option.id,
      type: 'option',
      option,
    }));

    if (enableOther) {
      // Keep Other's position within the available range.
      const safeOtherPos = Math.max(
        0,
        Math.min(otherOptionPosition, rows.length)
      );
      // Insert Other at its configured position.
      rows.splice(safeOtherPos, 0, {
        id: OTHER_ROW_DND_ID,
        type: 'other',
      });
    }

    return rows;
  }, [enableOther, options, otherOptionPosition]);

  /**
   * Validates option text for duplicates and empty values
   * @param text - Option text to validate
   * @param currentId - ID of the option being edited (excluded from duplicate checks)
   * @returns Error message string or null if valid
   */
  const validateOptionText = (
    text: string,
    currentId?: string
  ): string | null => {
    const normalized = text.trim().toLowerCase();
    if (!normalized) return 'Option text cannot be empty';

    const duplicateExists = options.some(
      option =>
        option.id !== currentId &&
        option.label.trim().toLowerCase() === normalized
    );

    return duplicateExists ? 'This option already exists in the list' : null;
  };

  /** IDs are unique, non empty and must not clash with the special Other row. */
  const validateOptionId = (id: string, currentId?: string): string | null => {
    if (!id) return 'Option ID cannot be empty';
    if (id.length > INPUT_LIMITS.ID_MAX_LENGTH)
      return `Option ID must be ${INPUT_LIMITS.ID_MAX_LENGTH} characters or fewer`;
    if (id === OTHER_ROW_DND_ID)
      return 'This option ID is reserved. Please choose a different ID.';
    if (options.some(o => o.id === id && o.id !== currentId)) {
      return 'An option with this ID already exists. Please choose a different ID.';
    }
    return null;
  };

  /** Generate a unique ID for a new option. */
  const generateOptionId = (label: string): string => {
    // Collect existing option IDs and reserve the internal Other drag ID.
    const usedIds = new Set(options.map(option => option.id));
    usedIds.add(OTHER_ROW_DND_ID);

    // Generate a unique ID without changing existing options.
    return generateUniqueOptionId(label, usedIds);
  };

  /**
   * Updates the field's options and related settings in Redux.
   * @param updatedOptions - Updated options array.
   * @param updatedExclusiveOptions - Updated exclusive options array.
   * @param updatedOtherOptionPosition - Optional new position for Other; defaults to its current position.
   */
  const updateField = (
    updatedOptions: ChoiceOption[],
    updatedExclusiveOptions: string[],
    updatedOtherOptionPosition?: number
  ) => {
    const newField = JSON.parse(JSON.stringify(field)) as FieldType;
    const newParams = newField[
      'component-parameters'
    ] as ChoiceComponentParameters;

    newParams.ElementProps = {
      ...newParams.ElementProps,
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

    // Preserve Other's position when enabled; otherwise remove it.
    if (enableOther) {
      newParams.ElementProps.otherOptionPosition =
        updatedOtherOptionPosition ?? otherOptionPosition;
    } else {
      delete newParams.ElementProps.otherOptionPosition;
    }

    dispatch(fieldUpdated({fieldName, newField}));

    return newField;
  };

  /**
   * Used when user chooses to auto-update references in conditions
   */
  const updateConditions = (
    oldValue: string,
    newValue: string,
    updatedField: FieldType
  ) => {
    // Field-level conditions
    for (const fId in allFields) {
      const fieldDef = fId === fieldName ? updatedField : allFields[fId];
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
    for (const vId in allViews) {
      const sectionDef = allViews[vId];
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

  /** Save the combined display order back into regular options and Other's position. */
  const saveCombinedOrder = (rows: CombinedRow[]) => {
    // Extract regular options in their new order, excluding Other.
    const newOptions = rows.flatMap(row =>
      row.type === 'option' ? [row.option] : []
    );
    // Ensure no regular options were lost during reordering.
    if (newOptions.length !== options.length) return;

    // Find Other's new position if it is enabled.
    const newOtherPosition = enableOther
      ? rows.findIndex(row => row.type === 'other')
      : undefined;
    // Do not save if the enabled Other row is missing.
    if (enableOther && newOtherPosition === -1) return;

    updateField(newOptions, exclusiveOptions, newOtherPosition);
  };

  /** Move any visible row one place, including across the special Other row. */
  const moveRow = (rowId: string, direction: 'up' | 'down') => {
    const index = combinedRows.findIndex(row => row.id === rowId);
    if (index < 0) return;

    const nextIndex = index + (direction === 'up' ? -1 : 1);
    if (nextIndex < 0 || nextIndex >= combinedRows.length) return;

    const newCombined = arrayMove(combinedRows, index, nextIndex);
    saveCombinedOrder(newCombined);
  };

  /** Drag-and-drop uses exactly the same ordering rules as the arrow buttons. */
  const handleDragEnd = ({active, over}: DragEndEvent) => {
    // Only handle drag if we have a valid drop target and it's different from source
    if (!over || active.id === over.id) return;

    const oldIndex = combinedRows.findIndex(
      row => row.id === String(active.id)
    );
    const newIndex = combinedRows.findIndex(row => row.id === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const newCombined = arrayMove(combinedRows, oldIndex, newIndex);
    saveCombinedOrder(newCombined);
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
      const label = newOption.trim();
      const newOptionObj: ChoiceOption = {
        id: generateOptionId(label),
        // label-as-value default
        value: label,
        label,
      };

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
  const removeOption = (option: ChoiceOption) => {
    // Check if this option is referenced in any condition.
    const references = findOptionReferences(
      allFields,
      allViews,
      fieldName,
      option.value
    );

    if (references.length > 0) {
      // Option is in use: open the warning dialog.
      setDeleteDialogRefs(references);
      setIsDeleteDialogOpen(true);
    } else {
      // Option is not used: proceed with deletion.
      const newOptions = options.filter(o => o.id !== option.id);
      const newExclusiveOptions = exclusiveOptions.filter(
        eo => eo !== option.value
      );

      // Removing an option before Other shifts its position left.
      const removedIndex = options.findIndex(o => o.id === option.id);
      const nextOtherPosition =
        enableOther && removedIndex >= 0 && removedIndex < otherOptionPosition
          ? otherOptionPosition - 1
          : undefined;

      updateField(newOptions, newExclusiveOptions, nextOtherPosition);
    }
  };

  /** Open the editor and check references to the option's stored value. */
  const handleOpenEditDialog = (optionId: string) => {
    const option = options.find(o => o.id === optionId);
    if (!option) return;

    setEditingOption({
      originalId: option.id,
      id: option.id,
      label: option.label,
    });
    setErrorMessage('');

    const references = findOptionReferences(
      allFields,
      allViews,
      fieldName,
      option.value
    );
    setRenameDialogState(
      references.length > 0 ? {references, updateConditions: true} : null
    );
  };

  /** Preserve label-to-value renaming; ID-only edits leave value untouched. */
  const handleEditSubmit = () => {
    if (!editingOption) return;

    const original = editingOriginal;
    if (!original) return;

    const newId = editingOption.id.trim();
    const newLabel = editingOption.label.trim();

    const error =
      validateOptionText(newLabel, original.id) ||
      validateOptionId(newId, original.id);
    if (error) {
      setErrorMessage(error);
      return;
    }

    const labelChanged = newLabel !== original.label;
    const valueChanged = labelChanged && newLabel !== original.value;
    const nextOptions = options.map(option =>
      option.id === original.id
        ? {
            ...option,
            id: newId,
            label: newLabel,
            // As before, renaming Option Text also updates its stored value.
            value: labelChanged ? newLabel : option.value,
          }
        : option
    );

    // Keep exclusive selection working when its stored value is renamed.
    const nextExclusiveOptions = valueChanged
      ? exclusiveOptions.map(value =>
          value === original.value ? newLabel : value
        )
      : exclusiveOptions;

    // Should update field or section level conditions
    const shouldUpdateConditions =
      valueChanged && renameDialogState?.updateConditions;

    // Save the updated options and exclusive selections.
    const updatedField = updateField(nextOptions, nextExclusiveOptions);

    // Conditions reference option.value, not option.id.
    if (shouldUpdateConditions) {
      updateConditions(original.value, newLabel, updatedField);
    }

    setEditingOption(null);
    setRenameDialogState(null);
    setErrorMessage('');
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
    const newParams = newField[
      'component-parameters'
    ] as ChoiceComponentParameters;
    newParams.ElementProps = {
      ...(newParams.ElementProps ?? {}),
      expandedChecklist: selectedMode === 'expanded',
    };
    dispatch(fieldUpdated({fieldName, newField}));
  };

  /**
   * "Other" option feature
   */
  const setEnableOtherOption = (newEnable: boolean) => {
    const newField = JSON.parse(JSON.stringify(field)) as FieldType;
    const newParams = newField[
      'component-parameters'
    ] as ChoiceComponentParameters;

    newParams.ElementProps = {
      ...(newParams.ElementProps ?? {}),
      enableOtherOption: newEnable,
    };

    if (newEnable) {
      // Place Other at the end when enabled.
      newParams.ElementProps.otherOptionPosition = options.length;
    } else {
      // Remove Other's position when disabled.
      delete newParams.ElementProps.otherOptionPosition;
    }

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
                  <Table size="small" sx={{tableLayout: 'auto', width: '100%'}}>
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
                        {/* Compact controls leave more room for both text columns. */}
                        <TableCell sx={compactCellSx} />
                        <TableCell sx={textCellSx}>Option text</TableCell>
                        <TableCell sx={textCellSx}>Option ID</TableCell>
                        {showExclusiveOptions && (
                          <TableCell align="center" sx={compactCellSx}>
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
                        <TableCell align="right" sx={compactCellSx}>
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
                                  key={OTHER_ROW_DND_ID}
                                  id={OTHER_ROW_DND_ID}
                                  showExclusiveOptions={showExclusiveOptions}
                                  isFirst={rowIdx === 0}
                                  isLast={rowIdx === combinedRows.length - 1}
                                  onMoveUp={() =>
                                    moveRow(OTHER_ROW_DND_ID, 'up')
                                  }
                                  onMoveDown={() =>
                                    moveRow(OTHER_ROW_DND_ID, 'down')
                                  }
                                  onRemove={() => setEnableOtherOption(false)}
                                />
                              );
                            }

                            return (
                              <SortableItem
                                key={row.option.id}
                                id={row.option.id}
                                option={row.option}
                                isFirst={rowIdx === 0}
                                isLast={rowIdx === combinedRows.length - 1}
                                showExclusiveOptions={showExclusiveOptions}
                                exclusiveOptions={exclusiveOptions}
                                onExclusiveToggle={handleExclusiveToggle}
                                onEdit={handleOpenEditDialog}
                                onRemove={removeOption}
                                onMove={moveRow}
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
                          slotProps={{
                            htmlInput: designerHtmlInput(
                              INPUT_LIMITS.SHORT_TEXT_MAX_LENGTH
                            ),
                          }}
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
                        onClick={() => setEnableOtherOption(true)}
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
      <EditOptionDialog
        editingOption={editingOption}
        setEditingOption={setEditingOption}
        options={options}
        originalLabel={editingOriginal?.label}
        renameDialogState={renameDialogState}
        setRenameDialogState={setRenameDialogState}
        errorMessage={errorMessage}
        setErrorMessage={setErrorMessage}
        onSave={handleEditSubmit}
        onClose={() => setEditingOption(null)}
        onExited={() => {
          setRenameDialogState(null);
          setErrorMessage('');
        }}
      />

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
