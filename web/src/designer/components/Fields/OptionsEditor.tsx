// SPDX-License-Identifier: Apache-2.0

import {designerHtmlInput, INPUT_LIMITS} from '@/designer/lib/input-limits';
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
import {MDXEditorMethods} from '@mdxeditor/editor';
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
import {alpha, Theme} from '@mui/material/styles';
import {useMemo, useRef, useState} from 'react';
import {
  findOptionReferences,
  updateConditionReferences,
} from '../../domain/conditions/conditionReferences';
import {cloneField} from '../../domain/notebook/fieldFactory';
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
import {MdxEditor, MdxEditorFeature} from '../mdx-editor';
import {BaseFieldEditor} from './BaseFieldEditor';

// ============================================================================
// Types & Consts
// ============================================================================

// Choice options have separate stored values and Markdown display labels.
type ChoiceOption = ChoiceElementProps['options'][number];

/**
 * Subset of choice-field `component-parameters` this editor reads/writes. The
 * `ElementProps` shape is the shared {@link ChoiceElementProps} used by
 * RadioGroup, Select and MultiSelect in `@faims3/forms`; keys are optional here
 * because the editor patches them incrementally.
 */
type ChoiceComponentParameters = {ElementProps?: Partial<ChoiceElementProps>};

// Prefix sortable IDs without changing values: normalising their text could
// make different values collide (e.g. 'Low Damage' and 'low-damage').
const getOptionDndId = (value: string): string => `__option__${value}`;
const OTHER_ROW_DND_ID = '__other__';

// Available display modes for choice fields.
enum ChoiceDisplayMode {
  expanded = 'expanded',
  dropdown = 'dropdown',
}

// Hide toolbar buttons while keeping Markdown features supported.
const hiddenOptionToolbarFeatures: MdxEditorFeature[] = [
  'lists',
  'tables',
  'images',
];

// tooltip titles
const EXPORT_VALUE_TOOLTIP = 'The value saved in exported data.';
const DISPLAY_LABEL_TOOLTIP =
  'What users will see when viewing options. Supports advanced formatting e.g. bold, italic, underline etc.';
const DISPLAY_LABEL_HINT = 'optional - leave blank to use the export value';
const EXCLUSIVE_TOOLTIP =
  "Marks the option as exclusive — selecting it clears any other selections in this field. Useful for choices like 'None of the above'.";

// dndId: Internal drag-and-drop row identifier.
// type: Distinguishes normal options from Other.
type CombinedRow =
  | {dndId: string; type: 'option'; option: ChoiceOption}
  | {dndId: string; type: 'other'};

// ============================================================================
// Styles & Shared Components
// ============================================================================

// Shared table header styling: theme-aware background and divider.
const optionTableHeaderSx = {
  backgroundColor: (theme: Theme) => alpha(theme.palette.text.primary, 0.025),
  '& .MuiTableCell-root': {
    borderBottom: '1px solid',
    borderColor: (theme: Theme) => alpha(theme.palette.text.primary, 0.12),
    fontWeight: 700,
    fontSize: '0.78rem',
    color: 'text.secondary',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    py: 0.9,
  },
} as const;

// Keep the drag handle aligned to the left.
const dragHandleCellSx = {
  whiteSpace: 'nowrap',
  py: 1,
  pl: 1,
  pr: {md: 1, lg: 2},
} as const;

// Compact controls leave more room for text columns.
// drag handle, exclusive and actions
const compactCellSx = {
  whiteSpace: 'nowrap',
  py: 1,
  px: {md: 1, lg: 2},
} as const;

// Prefer a 35/65 value-to-label split, allowing auto layout to adjust widths
// to accommodate the drag handle, exclusive checkbox, and action buttons.
const valueColumnSx = {
  width: '35%',
} as const;

const labelColumnSx = {
  width: '65%',
} as const;

// Headings
const textCellHeaderSx = {
  py: 1,
  minWidth: 0,
  whiteSpace: 'normal',
  overflowWrap: 'normal',
  wordBreak: 'normal',
} as const;

// Text cells allow shrinking and truncation in auto-layout tables.
const textCellSx = {
  py: 1,
  // Allow the cell to shrink
  minWidth: 0,
  // Prevent long text from determining the column's preferred width.
  maxWidth: 0,
} as const;

// Shared row styling: subtle background + clear hover state + row divider.
const optionRowSx = {
  backgroundColor: (theme: Theme) => alpha(theme.palette.text.primary, 0.015),
  borderBottom: '1px solid',
  borderColor: (theme: Theme) => alpha(theme.palette.text.primary, 0.08),
  transition: 'background-color 140ms ease',
  '&:last-of-type': {borderBottom: 'none'},
  '&:hover': {
    backgroundColor: (theme: Theme) => alpha(theme.palette.primary.main, 0.06),
  },
} as const;

// Show a single line with an ellipsis when text overflows.
const optionTextSx = {
  width: '100%',
  minWidth: 0,
  fontSize: '0.875rem',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
} as const;

// MUI TextField error and focus border override.
const optionInputErrorSx = (hasError: boolean) => ({
  '& .MuiOutlinedInput-root': {
    ...(hasError && {
      '& .MuiOutlinedInput-notchedOutline, &.Mui-focused .MuiOutlinedInput-notchedOutline':
        {
          borderColor: 'error.main',
          borderWidth: 2,
        },
    }),
  },
});

// Render a field heading with optional tooltip and hint text.
const OptionInputHeading = ({
  label,
  tooltip,
  hint,
}: {
  // Heading text.
  label: string;
  // Optional tooltip content displayed next to the heading.
  tooltip?: React.ReactNode;
  // Optional hint text displayed inline after the tooltip.
  hint?: string;
}) => (
  <Stack direction="row" spacing={0.65} sx={{mb: 1, alignItems: 'center'}}>
    <Typography component="span" sx={{fontWeight: 700}}>
      {label}
    </Typography>
    {!!tooltip && (
      <Tooltip title={tooltip}>
        <InfoIcon sx={designerInfoIconSx} />
      </Tooltip>
    )}
    {hint && (
      <Typography variant="caption" sx={{color: 'text.secondary'}}>
        ({hint})
      </Typography>
    )}
  </Stack>
);

/** Render a table header label with an info tooltip. */
const OptionHeaderWithTooltip = ({
  label,
  tooltip,
}: {
  label: string;
  tooltip: React.ReactNode;
}) => (
  <Box
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.4,
    }}
  >
    {label}
    <Tooltip title={tooltip}>
      <InfoIcon
        sx={{
          ...designerInfoIconSx,
          fontSize: '1.1rem',
        }}
      />
    </Tooltip>
  </Box>
);

// ============================================================================
// Option Validation Helpers
// ============================================================================

/** Normalize whitespace in Markdown labels for validation. */
const normaliseMarkdownWhitespace = (label: string): string =>
  label.replace(/&#x20;|&#32;|&#xa0;|&#160;|&nbsp;/gi, ' ').trim();

/**
 * Ensure the final display label is not empty or already used.
 * The caller resolves an empty input to the export value first.
 *
 * @param options - Existing predefined options.
 * @param newLabel - The display label to validate.
 * @param originalValue - The original export value to exclude when editing.
 * @returns An error message if invalid, otherwise null.
 */
const validateLabel = (
  options: ChoiceOption[],
  newLabel: string,
  originalValue?: string
): string | null => {
  const normalizedLabel = normaliseMarkdownWhitespace(newLabel).toLowerCase();
  if (!normalizedLabel) return 'Display label is required';

  // Check if another option already uses the same label.
  const isDuplicateLabel = options.some(
    option =>
      option.value !== originalValue &&
      normaliseMarkdownWhitespace(option.label).toLowerCase() ===
        normalizedLabel
  );

  if (isDuplicateLabel)
    return 'This display label already exists. Please enter a unique label.';

  return null;
};

/**
 * Ensure the export value is not empty or already used by another option.
 * Comparison is case-insensitive and ignores surrounding whitespace.
 *
 * @param options - Existing predefined options.
 * @param newValue - The export value to validate.
 * @param originalValue - The original export value to exclude when editing.
 * @returns An error message if invalid, otherwise null.
 */
const validateValue = (
  options: ChoiceOption[],
  newValue: string,
  originalValue?: string
): string | null => {
  const normalizedValue = newValue.trim().toLowerCase();
  if (!normalizedValue) return 'Export value is required';

  // Check if another option already uses the same value.
  const isDuplicateValue = options.some(
    option =>
      option.value.trim().toLowerCase() === normalizedValue &&
      option.value !== originalValue
  );

  if (isDuplicateValue)
    return 'This export value already exists. Please enter a unique value.';

  return null;
};

// ============================================================================
// Edit Option Dialog
// ============================================================================

/** Values for the option currently being edited. */
type EditingOption = {
  // Original stored value used to identify the option.
  originalValue: string;
  // Updated export value to save.
  value: string;
  // Updated user-facing Markdown label to save.
  label: string;
};

/** Condition references affected by an export value change. */
type ConditionUpdateState = {
  // Conditions referencing the original export value.
  references: string[];
  // Whether to update those conditions.
  updateConditions: boolean;
};

interface EditOptionDialogProps {
  // Option currently being edited, or null when closed.
  editingOption: EditingOption | null;
  setEditingOption: React.Dispatch<React.SetStateAction<EditingOption | null>>;
  // Update the condition reference preference.
  conditionUpdateState: ConditionUpdateState | null;
  setConditionUpdateState: React.Dispatch<
    React.SetStateAction<ConditionUpdateState | null>
  >;
  // Existing options used to validate unique values and labels.
  options: ChoiceOption[];
  // Save the validated export value and label.
  onSave: (value: string, label: string) => void;
  // Closes the dialog without saving changes.
  onCancel: () => void;
  // Clear temporary dialog state after its closing animation finishes
  onExited: () => void;
}

/** Edit the export value and Markdown label independently. */
const EditOptionDialog = ({
  editingOption,
  setEditingOption,
  conditionUpdateState,
  setConditionUpdateState,
  options,
  onSave,
  onCancel,
  onExited,
}: EditOptionDialogProps) => {
  const editorRef = useRef<MDXEditorMethods>(null);

  const [valueError, setValueError] = useState('');
  const [labelError, setLabelError] = useState('');

  // Validate the edited value and label before saving through the parent.
  const handleSave = () => {
    if (!editingOption) return;

    const newValue = editingOption.value.trim();
    const rawLabel = editingOption.label.trim();
    // Default empty or whitespace only Markdown labels to the export value.
    const newLabel = normaliseMarkdownWhitespace(rawLabel)
      ? rawLabel
      : newValue;

    const valueErrorMessage = validateValue(
      options,
      newValue,
      editingOption.originalValue
    );

    const labelErrorMessage = validateLabel(
      options,
      newLabel,
      editingOption.originalValue
    );

    setValueError(valueErrorMessage ?? '');
    setLabelError(labelErrorMessage ?? '');

    if (valueErrorMessage || labelErrorMessage) return;

    onSave(newValue, newLabel);
  };

  const handleExited = () => {
    setValueError('');
    setLabelError('');
    onExited();
  };

  return (
    <Dialog
      open={!!editingOption}
      onClose={onCancel}
      fullWidth
      maxWidth="md"
      slotProps={{transition: {onExited: handleExited}}}
    >
      <DialogTitle sx={designerDialogTitleSx}>Edit Option</DialogTitle>
      <DialogContent sx={designerDialogContentSx}>
        {/* First row: stored export value */}
        <Box sx={{mt: 1, mb: 2}}>
          <OptionInputHeading
            label="Export value"
            tooltip={EXPORT_VALUE_TOOLTIP}
          />
          <TextField
            fullWidth
            size="small"
            placeholder="Enter a unique export value"
            required
            value={editingOption?.value ?? ''}
            error={!!valueError}
            onChange={e => {
              setEditingOption(previous =>
                previous ? {...previous, value: e.target.value} : null
              );
              setValueError('');
            }}
            slotProps={{
              htmlInput: designerHtmlInput(INPUT_LIMITS.SHORT_TEXT_MAX_LENGTH),
            }}
            sx={optionInputErrorSx(!!valueError)}
          />

          {valueError && (
            <Alert severity="error" sx={{mt: 1.5}}>
              {valueError}
            </Alert>
          )}
        </Box>

        {/* Second row: optional Markdown label */}
        <Box sx={{mb: 1}}>
          <OptionInputHeading
            label="Display label"
            tooltip={DISPLAY_LABEL_TOOLTIP}
            hint={DISPLAY_LABEL_HINT}
          />
          {/* Remount the editor when opening an option, not while typing. */}
          {editingOption && (
            <MdxEditor
              key={editingOption.originalValue}
              initialMarkdown={editingOption.label}
              handleChange={markdown => {
                setEditingOption(previous =>
                  previous ? {...previous, label: markdown} : null
                );
                setLabelError('');
              }}
              editorRef={editorRef}
              hiddenToolbarFeatures={hiddenOptionToolbarFeatures}
            />
          )}

          {labelError && (
            <Alert severity="error" sx={{mt: 1.5}}>
              {labelError}
            </Alert>
          )}
        </Box>

        {/* Warn that changing the stored value may affect existing records. */}
        {editingOption &&
          editingOption.value.trim() !== editingOption.originalValue && (
            <Alert severity="warning" sx={{mt: 2}}>
              Changing the export value will not update existing saved records.
              Answers using the old export value may no longer match this
              option.
              {conditionUpdateState && (
                <>
                  <Typography variant="body2" sx={{mt: 1, mb: 1}}>
                    This export value is also used in:
                  </Typography>
                  <ul>
                    {conditionUpdateState.references.map((ref, index) => (
                      <li key={index}>{ref}</li>
                    ))}
                  </ul>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={conditionUpdateState.updateConditions}
                        onChange={e =>
                          setConditionUpdateState(previous =>
                            previous
                              ? {
                                  ...previous,
                                  updateConditions: e.target.checked,
                                }
                              : null
                          )
                        }
                      />
                    }
                    label="Update conditions to use the new export value"
                    sx={{mt: 1}}
                  />
                </>
              )}
            </Alert>
          )}
      </DialogContent>

      <DialogActions>
        <Button sx={designerCancelButtonSx} onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} color="primary">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ============================================================================
// Sortable Row Components
// ============================================================================

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

interface OtherOptionRowProps {
  // Internal dnd-kit identifier, separate from the stored export value.
  dndId: string;
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
  dndId,
  showExclusiveOptions,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onRemove,
}: OtherOptionRowProps) => {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} =
    useSortable({id: dndId});

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
          label="Drag Other option to reorder"
          dragAttributes={attributes}
          dragListeners={listeners}
        />
      </TableCell>

      {/* Other is configured separately, so its export value column stays empty. */}
      <TableCell sx={{...textCellSx, ...valueColumnSx}} />

      {/* Display label column */}
      <TableCell sx={{...textCellSx, ...labelColumnSx}}>
        <Tooltip title="Allows custom text input">
          <Typography sx={optionTextSx}>
            Other{' '}
            <Typography
              component="span"
              sx={{
                fontSize: '0.75rem',
                color: 'text.secondary',
              }}
            >
              (allows custom text input)
            </Typography>
          </Typography>
        </Tooltip>
      </TableCell>

      {/* Empty exclusive checkbox column for alignment */}
      {showExclusiveOptions && <TableCell align="center" sx={compactCellSx} />}

      {/* Action buttons column */}
      <TableCell align="right" sx={compactCellSx}>
        <Tooltip title={isFirst ? 'Already at the top' : 'Move up'}>
          <span>
            <IconButton
              aria-label="Move up"
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
              aria-label="Move down"
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

interface SortableItemProps {
  // Internal dnd-kit identifier, separate from the stored export value.
  dndId: string;
  option: ChoiceOption;
  // Whether the row is at either end of the displayed list.
  isFirst: boolean;
  isLast: boolean;
  // Whether to show exclusive-option selection controls.
  showExclusiveOptions?: boolean;
  // values of options that exclude the other selections.
  exclusiveOptions: string[];
  // Toggle by value, never by display label.
  onExclusiveToggle: (value: string) => void;
  // Editing uses the current export value to locate the option.
  onEdit: (value: string) => void;
  // Delete by current value.
  onRemove: (value: string) => void;
  // Nudge by value; the parent converts it into the sortable row ID.
  onMove: (value: string, direction: 'up' | 'down') => void;
}

/**
 * Individual sortable item row component for the options table
 * Handles drag-and-drop functionality and row actions
 *
 * @component
 * @param props - See SortableItemProps interface
 */
const SortableItem = ({
  dndId,
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
    useSortable({id: dndId});

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

      {/* Export value column */}
      <TableCell sx={{...textCellSx, ...valueColumnSx}}>
        <Tooltip title={option.value}>
          <Typography sx={optionTextSx}>{option.value}</Typography>
        </Tooltip>
      </TableCell>

      {/* Display label column */}
      <TableCell sx={{...textCellSx, ...labelColumnSx}}>
        <Tooltip title={option.label}>
          <Typography sx={optionTextSx}>{option.label}</Typography>
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
              aria-label="Move up"
              size="small"
              disabled={isFirst}
              onClick={() => onMove(option.value, 'up')}
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
              aria-label="Move down"
              size="small"
              disabled={isLast}
              onClick={() => onMove(option.value, 'down')}
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
            onClick={() => onEdit(option.value)}
            sx={{p: {xs: 0.25, sm: 0.5}, color: 'success.main'}}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete option">
          <IconButton
            size="small"
            onClick={() => onRemove(option.value)}
            sx={{p: {xs: 0.25, sm: 0.5}, color: 'error.main'}}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * Manage choice options with separate stored values and display labels.
 * Supports editing, reordering, exclusive options, and Other.
 */
export const OptionsEditor = ({
  fieldName,
  showExpandedChecklist,
  showExclusiveOptions,
}: {
  // Field name of this options editor
  fieldName: string;
  // Show the expanded/dropdown display mode control when relevant.
  showExpandedChecklist?: boolean;
  // Show exclusive option controls for multi-select fields.
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

  const [newOptionValue, setNewOptionValue] = useState('');

  // Validation errors for adding new option.
  const [addErrorMessage, setAddErrorMessage] = useState('');

  const [deleteDialogRefs, setDeleteDialogRefs] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [editingOption, setEditingOption] = useState<EditingOption | null>(
    null
  );
  const [conditionUpdateState, setConditionUpdateState] =
    useState<ConditionUpdateState | null>(null);

  // Component state
  const elementProps = (
    field['component-parameters'] as ChoiceComponentParameters
  ).ElementProps;
  const fieldComponent = field['component-name'];

  const displayMode: ChoiceDisplayMode =
    elementProps?.expandedChecklist === false
      ? ChoiceDisplayMode.dropdown
      : ChoiceDisplayMode.expanded;
  const showExpandedCheckListControl = showExpandedChecklist ?? false;
  const isMultiSelectField = fieldComponent === 'MultiSelect';

  // Choice options only, the Other option is managed separately.
  const options: ChoiceOption[] = elementProps?.options ?? [];
  const exclusiveOptions: string[] = elementProps?.exclusiveOptions || [];
  const enableOther: boolean = elementProps?.enableOtherOption ?? false;
  // Use the saved Other position, or default to the end of the options list.
  const otherOptionPosition: number =
    elementProps?.otherOptionPosition ?? options.length;

  /** Merge regular options and Other into one sortable visual sequence. */
  const combinedRows: CombinedRow[] = useMemo(() => {
    const rows: CombinedRow[] = options.map(option => ({
      // Prefix the export value so it cannot conflict with Other's sortable ID.
      dndId: getOptionDndId(option.value),
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
      rows.splice(safeOtherPos, 0, {dndId: OTHER_ROW_DND_ID, type: 'other'});
    }

    return rows;
  }, [enableOther, options, otherOptionPosition]);

  // Actions

  /**
   * Update the field's options and related settings in Redux.
   *
   * @param updatedOptions - The updated predefined options.
   * @param updatedExclusiveOptions - Optional updated exclusive export values.
   * @param updatedOtherOptionPosition - The new Other option position, if provided.
   * @returns The updated field configuration.
   */
  const updateField = (
    updatedOptions: ChoiceOption[],
    updatedExclusiveOptions?: string[],
    updatedOtherOptionPosition?: number
  ) => {
    const newField = cloneField(field);
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
    };

    // Only update exclusive options when a replacement array is provided.
    if (updatedExclusiveOptions !== undefined) {
      newParams.ElementProps.exclusiveOptions = updatedExclusiveOptions;
    }

    // Preserve Other's position when enabled
    if (enableOther) {
      newParams.ElementProps.otherOptionPosition =
        updatedOtherOptionPosition ?? otherOptionPosition;
    } else {
      // disabled other, remove it.
      delete newParams.ElementProps.otherOptionPosition;
    }

    dispatch(fieldUpdated({fieldName, newField}));

    return newField;
  };

  /**
   * Rename condition references only when the stored value changes.
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
    // no regular options should be lost during reordering.
    if (newOptions.length !== options.length) return;

    // Find Other's new position if it is enabled.
    const newOtherPosition = enableOther
      ? rows.findIndex(row => row.type === 'other')
      : undefined;
    // Do not save if the enabled Other row is missing.
    if (enableOther && newOtherPosition === -1) return;

    updateField(newOptions, exclusiveOptions, newOtherPosition);
  };

  /** Move a sortable row, including across the special Other row. */
  const moveRow = (rowId: string, direction: 'up' | 'down') => {
    const index = combinedRows.findIndex(row => row.dndId === rowId);
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
      row => row.dndId === String(active.id)
    );
    const newIndex = combinedRows.findIndex(
      row => row.dndId === String(over.id)
    );
    if (oldIndex < 0 || newIndex < 0) return;

    const newCombined = arrayMove(combinedRows, oldIndex, newIndex);
    saveCombinedOrder(newCombined);
  };

  /**
   * Add a new option using the entered value as both
   * the stored value and display label.
   */
  const addOption = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const value = newOptionValue.trim();

    const error =
      validateValue(options, value) || validateLabel(options, value);
    if (error) {
      setAddErrorMessage(error);
      return;
    }

    // Keep Other at the end when it already sits there. A new choice is
    // appended to the regular list, so an end index would otherwise land
    // that choice below Other. Delete already shifts this index.
    const nextOtherPosition =
      enableOther && otherOptionPosition >= options.length
        ? otherOptionPosition + 1
        : otherOptionPosition;

    // Add a new option, defaulting the label to the export value.
    updateField(
      [...options, {value, label: value}],
      undefined,
      nextOtherPosition
    );
    setNewOptionValue('');
    setAddErrorMessage('');
  };

  /** Exclusive choices refer to stored values, not rendered Markdown. */
  const handleExclusiveToggle = (value: string) => {
    const newExclusiveOptions = exclusiveOptions.includes(value)
      ? exclusiveOptions.filter(id => id !== value)
      : [...exclusiveOptions, value];
    updateField(options, newExclusiveOptions);
  };

  /** Block deletion if conditions still reference this option's value. */
  const removeOption = (value: string) => {
    const references = findOptionReferences(
      allFields,
      allViews,
      fieldName,
      value
    );

    if (references.length > 0) {
      setDeleteDialogRefs(references);
      setIsDeleteDialogOpen(true);
      return;
    }

    const newOptions = options.filter(option => option.value !== value);
    const newExclusiveOptions = exclusiveOptions.filter(id => id !== value);

    // Keep Other's visual position when deleting an option above it.
    const removedIndex = options.findIndex(option => option.value === value);
    const nextOtherPosition =
      enableOther && removedIndex >= 0 && removedIndex < otherOptionPosition
        ? otherOptionPosition - 1
        : otherOptionPosition;

    updateField(newOptions, newExclusiveOptions, nextOtherPosition);
  };

  /** Open the editor and locate conditions referring to the stored value. */
  const handleOpenEditDialog = (value: string) => {
    const option = options.find(option => option.value === value);
    if (!option) return;

    setEditingOption({
      originalValue: option.value,
      value: option.value,
      label: option.label,
    });

    const references = findOptionReferences(
      allFields,
      allViews,
      fieldName,
      value
    );
    setConditionUpdateState(
      references.length > 0 ? {references, updateConditions: true} : null
    );
  };

  // Save the edited option and update related references if its value changes.
  const handleEditSubmit = (newValue: string, newLabel: string) => {
    if (!editingOption) return;
    // Find the original option, even if its export value has been edited.
    const original = options.find(
      option => option.value === editingOption.originalValue
    );
    if (!original) {
      // close editor dialog
      setEditingOption(null);
      return;
    }

    const valueChanged = newValue !== original.value;
    const nextOptions = options.map(option =>
      option.value === original.value
        ? {...option, value: newValue, label: newLabel}
        : option
    );

    const nextExclusiveOptions = valueChanged
      ? exclusiveOptions.map(id => (id === original.value ? newValue : id))
      : exclusiveOptions;

    const updatedField = updateField(nextOptions, nextExclusiveOptions);

    // Existing records are NOT migrated by this editor,
    // condition references may be updated when the designer elects to do so.
    if (valueChanged && conditionUpdateState?.updateConditions) {
      updateConditions(original.value, newValue, updatedField);
    }

    setEditingOption(null);
    setConditionUpdateState(null);
  };

  /**
   * Switches between expanded checklist and dropdown display modes.
   */
  const setDisplayMode = (
    event: React.ChangeEvent<HTMLInputElement>,
    _value: string
  ) => {
    const selectedMode = event.target.value as ChoiceDisplayMode;
    const newField = cloneField(field);
    const newParams = newField[
      'component-parameters'
    ] as ChoiceComponentParameters;
    newParams.ElementProps = {
      ...(newParams.ElementProps ?? {}),
      expandedChecklist: selectedMode === ChoiceDisplayMode.expanded,
    };
    dispatch(fieldUpdated({fieldName, newField}));
  };

  /**
   * "Other" option feature
   */
  const setEnableOtherOption = (newEnable: boolean) => {
    const newField = cloneField(field);
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
            backgroundColor: 'background.paper',
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
                  {/* Auto-sized control columns leave flexible space for value and label. */}
                  <Table size="small" sx={{tableLayout: 'auto', width: '100%'}}>
                    <TableHead>
                      <TableRow sx={optionTableHeaderSx}>
                        {/* Drag handle header */}
                        <TableCell sx={compactCellSx} />

                        <TableCell sx={{...textCellHeaderSx, ...valueColumnSx}}>
                          <OptionHeaderWithTooltip
                            label="Export value"
                            tooltip={EXPORT_VALUE_TOOLTIP}
                          />
                        </TableCell>

                        <TableCell sx={{...textCellHeaderSx, ...labelColumnSx}}>
                          <OptionHeaderWithTooltip
                            label="Display label"
                            tooltip={DISPLAY_LABEL_TOOLTIP}
                          />
                        </TableCell>

                        {showExclusiveOptions && (
                          <TableCell align="center" sx={compactCellSx}>
                            <OptionHeaderWithTooltip
                              label="Exclusive"
                              tooltip={EXCLUSIVE_TOOLTIP}
                            />
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
                          items={combinedRows.map(r => r.dndId)}
                          strategy={verticalListSortingStrategy}
                        >
                          {combinedRows.map((row, rowIdx) => {
                            if (row.type === 'other') {
                              return (
                                <SortableOtherOptionRow
                                  key={OTHER_ROW_DND_ID}
                                  dndId={OTHER_ROW_DND_ID}
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
                                key={row.dndId}
                                dndId={row.dndId}
                                option={row.option}
                                isFirst={rowIdx === 0}
                                isLast={rowIdx === combinedRows.length - 1}
                                showExclusiveOptions={showExclusiveOptions}
                                exclusiveOptions={exclusiveOptions}
                                onExclusiveToggle={handleExclusiveToggle}
                                onEdit={handleOpenEditDialog}
                                onRemove={removeOption}
                                onMove={(value, direction) =>
                                  moveRow(getOptionDndId(value), direction)
                                }
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

            {/* Add option row */}
            <Grid size={12}>
              <Typography
                component="h4"
                sx={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: 'text.primary',
                  my: 0.75,
                }}
              >
                Add option
              </Typography>

              <Box component="form" onSubmit={addOption}>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: {xs: 'column', md: 'row'},
                    alignItems: {xs: 'stretch', md: 'flex-end'},
                    gap: 1,
                  }}
                >
                  <Box sx={{width: {xs: '100%', md: '50%'}, minWidth: 0}}>
                    <TextField
                      size="small"
                      placeholder="Add option"
                      required
                      value={newOptionValue}
                      onChange={e => {
                        setNewOptionValue(e.target.value);
                        setAddErrorMessage('');
                      }}
                      error={!!addErrorMessage}
                      slotProps={{
                        htmlInput: designerHtmlInput(
                          INPUT_LIMITS.SHORT_TEXT_MAX_LENGTH
                        ),
                      }}
                      fullWidth
                      sx={optionInputErrorSx(!!addErrorMessage)}
                    />
                  </Box>

                  <Stack
                    direction="row"
                    spacing={1}
                    useFlexGap
                    sx={{alignItems: 'center', flexWrap: 'wrap'}}
                  >
                    <Button
                      type="submit"
                      variant="outlined"
                      color="primary"
                      sx={{
                        height: 40,
                      }}
                    >
                      Add
                    </Button>

                    <Button
                      type="button"
                      variant="outlined"
                      color="primary"
                      onClick={() => setEnableOtherOption(true)}
                      disabled={enableOther}
                      sx={{
                        height: 40,
                      }}
                    >
                      Add "Other" Option
                    </Button>

                    <Tooltip title='Adds an "Other" option so users can enter their own answer.'>
                      <InfoIcon sx={{...designerInfoIconSx, ml: 0}} />
                    </Tooltip>
                  </Stack>
                </Box>

                {addErrorMessage && (
                  <Alert severity="error" sx={{mt: 1.5}}>
                    {addErrorMessage}
                  </Alert>
                )}
              </Box>
            </Grid>

            {/* Expanded/dropdown display mode. Updates expandedChecklist in Redux. */}
            {showExpandedCheckListControl && (
              <Grid size={12}>
                <FormControl>
                  <FormLabel>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{my: 0.75, alignItems: 'center'}}
                    >
                      <Typography component="h4">
                        {isMultiSelectField
                          ? 'Multi-select display mode'
                          : 'Select-one display mode'}
                      </Typography>
                      <Tooltip title="Choose whether to show options as a checklist or a dropdown list.">
                        <InfoIcon sx={designerInfoIconSx} />
                      </Tooltip>
                    </Stack>
                  </FormLabel>
                  <RadioGroup row value={displayMode} onChange={setDisplayMode}>
                    <FormControlLabel
                      value={ChoiceDisplayMode.expanded}
                      control={<Radio size="small" />}
                      label="Expanded checklist"
                    />
                    <FormControlLabel
                      value={ChoiceDisplayMode.dropdown}
                      control={<Radio size="small" />}
                      label="Dropdown list"
                    />
                  </RadioGroup>
                </FormControl>
              </Grid>
            )}
          </Grid>
        </Box>
      </Box>

      {/* Edit option dialog */}
      <EditOptionDialog
        editingOption={editingOption}
        setEditingOption={setEditingOption}
        conditionUpdateState={conditionUpdateState}
        setConditionUpdateState={setConditionUpdateState}
        options={options}
        onSave={handleEditSubmit}
        onCancel={() => setEditingOption(null)}
        onExited={() => {
          setConditionUpdateState(null);
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
