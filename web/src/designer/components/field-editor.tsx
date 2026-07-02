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

/**
 * @file Per-field accordion in the section list: actions, conflicts, and type-specific editor.
 */

import ArrowDropDownRoundedIcon from '@mui/icons-material/ArrowDropDownRounded';
import ArrowDropUpRoundedIcon from '@mui/icons-material/ArrowDropUpRounded';
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import MoveRoundedIcon from '@mui/icons-material/DriveFileMoveRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import DuplicateIcon from '@mui/icons-material/ContentCopy';

import {TemplatedStringProps} from '@faims3/forms';
import {VITE_TEMPLATE_PROTECTIONS} from '../buildconfig';

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {alpha} from '@mui/material/styles';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {useAppDispatch, useAppSelector} from '../state/hooks';
import {
  findFieldDependencyReferences,
  type FieldDependencyReference,
  findInvalidConditionReferences,
} from './condition/utils';
import DebouncedTextField from './debounced-text-field';
import {keyframes} from '@emotion/react';
import {renderFieldEditor} from '../features/design/field-editor-registry';
import {designerFieldSelector} from '../features/navigation/designerElementIds';
import {scrollToDesignerElement} from '../features/navigation/scrollToElements';
import {
  designerCancelButtonSx,
  designerDialogActionsSx,
  designerDialogBodyTextSx,
  designerDialogContentSx,
  designerDialogFieldLabelSx,
  designerDialogTitleSx,
  designerResponsiveFieldEditorSx,
} from './designer-style';
import {DragHandle} from './drag-handle';
import {
  fieldDeleted,
  fieldDuplicated,
  fieldMoved,
  fieldMovedToSection,
  toggleFieldHidden,
} from '../store/slices/uiSpec';

/**
 * Accordion row for one field: summary chips, move/duplicate/delete, visibility toggle,
 * and the type-specific editor from `field-editor-registry`.
 */
type FieldEditorProps = {
  designerIdentifier: string;
  fieldName: string;
  viewSetId: string;
  viewId: string;
  expanded: boolean;
  addFieldCallback: (fieldName: string) => void;
  onExpandedChange: (designerIdentifier: string, expanded: boolean) => void;
  moveFieldCallback: (targetViewId: string) => void;
  dragDisabled?: boolean;
  autoFocusLabel?: boolean;
  onLabelFocused?: () => void;
};

type ConflictError = {
  title: string;
  message: string;
  conflicts: FieldDependencyReference[];
};

const shakeAnim = keyframes`
  0%, 100% { transform: translateX(0); }
  20%       { transform: translateX(-5px); }
  40%       { transform: translateX(5px); }
  60%       { transform: translateX(-4px); }
  80%       { transform: translateX(4px); }
`;

/** Accordion UI for one field: move, duplicate, delete guards, type-specific inspector. */
const FieldEditorComponent = ({
  designerIdentifier,
  fieldName,
  viewId,
  viewSetId,
  expanded,
  addFieldCallback,
  onExpandedChange,
  moveFieldCallback,
  dragDisabled = false,
  autoFocusLabel = false,
  onLabelFocused,
}: FieldEditorProps) => {
  const field = useAppSelector(
    state => state.notebook.uiSpec.present.fields[fieldName]
  );
  const viewsets = useAppSelector(
    state => state.notebook.uiSpec.present.viewsets
  );

  const allFields = useAppSelector(
    state => state.notebook.uiSpec.present.fields
  );
  const allFviews = useAppSelector(
    state => state.notebook.uiSpec.present.views
  );

  const invalidRefs = useMemo(() => {
    if (!expanded) return [];
    return findInvalidConditionReferences(
      fieldName,
      field,
      allFields,
      allFviews
    );
  }, [expanded, fieldName, field, allFields, allFviews]);

  const dispatch = useAppDispatch();

  const [openMoveDialog, setOpenMoveDialog] = useState(false);
  const [targetViewId, setTargetViewId] = useState('');
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [openDuplicateDialog, setOpenDuplicateDialog] = useState(false);
  const [duplicateTitle, setDuplicateTitle] = useState('');
  const [shakingUp, setShakingUp] = useState(false);
  const [shakingDown, setShakingDown] = useState(false);

  const sectionFields: string[] = allFviews[viewId]?.fields ?? [];
  const fieldIndex = sectionFields.indexOf(fieldName);
  const isFirstField = fieldIndex === 0;
  const isLastField = fieldIndex === sectionFields.length - 1;

  const fieldComponent = field['component-name'];
  const fieldComponentLabelMap: Record<string, string> = {
    TextField: 'Text field',
    NumberField: 'Number field',
    DateTimePicker: 'Date and time picker',
    DatePicker: 'Date only picker',
    MonthPicker: 'Month only picker',
    RadioGroup: 'Select single',
    MultiSelect: 'Select multiple',
    Select: 'Select single',
  };
  const fieldComponentDisplayName =
    fieldComponentLabelMap[fieldComponent] || fieldComponent;

  const [deleteWarningOpen, setDeleteWarningOpen] = useState(false);
  const [conditionsAffected, setConditionsAffected] = useState<
    FieldDependencyReference[]
  >([]);

  const [conflictError, setConflictError] = useState<ConflictError | null>(
    null
  );
  const editorRootRef = useRef<HTMLDivElement>(null);

  const deleteField = (evt: React.SyntheticEvent) => {
    evt.stopPropagation();

    const usage = findFieldDependencyReferences(
      fieldName,
      allFields,
      allFviews,
      viewsets
    );

    if (usage.length > 0) {
      setConditionsAffected(usage);
      setDeleteWarningOpen(true);
    } else {
      dispatch(fieldDeleted({fieldName, viewId}));
    }
  };
  const protection =
    VITE_TEMPLATE_PROTECTIONS && field['component-parameters'].protection
      ? field['component-parameters'].protection
      : 'none';

  const isHidden = field['component-parameters'].hidden || false;
  const isRequired = field['component-parameters']?.required || false;

  const notebookMetadata = useAppSelector(state => state.notebook.metadata);

  const isDerivedFromSet =
    VITE_TEMPLATE_PROTECTIONS &&
    Boolean(notebookMetadata.information?.derivedFromTemplateId);

  const disableEditing =
    isDerivedFromSet &&
    (protection === 'protected' || protection === 'allow-hiding');

  const getFieldLabel = () => {
    const params = field['component-parameters'] as TemplatedStringProps;
    return (
      params.label ||
      (params.InputLabelProps && params.InputLabelProps.label) ||
      params.name
    );
  };

  const label = getFieldLabel();

  const moveFieldDown = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    if (isLastField) {
      setShakingDown(true);
      return;
    }
    dispatch(fieldMoved({fieldName, viewId, direction: 'down'}));
  };

  const moveFieldUp = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    if (isFirstField) {
      setShakingUp(true);
      return;
    }
    dispatch(fieldMoved({fieldName, viewId, direction: 'up'}));
  };

  const addFieldBelow = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    addFieldCallback(fieldName);
  };

  const handleOpenDuplicateDialog = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    const currentLabel = getFieldLabel();
    setDuplicateTitle(currentLabel + ' Copy');
    setOpenDuplicateDialog(true);
  };

  const handleCloseDuplicateDialog = () => {
    setOpenDuplicateDialog(false);
    setDuplicateTitle('');
  };

  const duplicateField = () => {
    if (duplicateTitle.trim()) {
      dispatch(
        fieldDuplicated({
          originalFieldName: fieldName,
          newFieldName: duplicateTitle.trim(),
          viewId,
        })
      );
      handleCloseDuplicateDialog();
    }
  };

  const protectionMessage = !isDerivedFromSet
    ? 'Protected Field. Users that derive this template will not be able to modify or delete it.'
    : protection === 'protected'
      ? 'This field is protected. You may not modify or delete it.'
      : `This field is protected. You may not modify or delete it. ${
          !isHidden ? 'However, you can hide it.' : ''
        }`;

  const handleCloseMoveDialog = () => {
    setConflictError(null);
    setOpenMoveDialog(false);
    setSelectedFormId(null); // reset selectedFormId when dialog is closed
    setTargetViewId(''); // reset section value when dialog is closed
  };

  const moveFieldToSection = () => {
    if (targetViewId) {
      const usage = findFieldDependencyReferences(
        fieldName,
        allFields,
        allFviews,
        viewsets
      );
      const targetSectionLabel = allFviews[targetViewId]?.label || '';
      const conflicts = usage.filter(u => u.sectionId === targetViewId);

      if (conflicts.length > 0) {
        setConflictError({
          title: `Cannot move field "${label}" to "${targetSectionLabel}"`,
          message:
            'This section has conditions that already depend on this field. To proceed, first remove or update these conditions in the target section.',
          conflicts,
        });
        return;
      }

      dispatch(
        fieldMovedToSection({
          fieldName,
          sourceViewId: viewId,
          targetViewId,
        })
      );
      moveFieldCallback(targetViewId);
      handleCloseMoveDialog();
    }
  };

  // memoize the form value
  const formValue = useMemo(
    () =>
      selectedFormId
        ? {id: selectedFormId, label: viewsets[selectedFormId].label}
        : null,
    [selectedFormId, viewsets]
  );

  // memoize the form options
  const formOptions = useMemo(
    () =>
      Object.entries(viewsets).map(([formId, form]) => ({
        id: formId,
        label: form.label,
      })),
    [viewsets]
  );

  // memoize the section value
  const sectionValue = useMemo(
    () =>
      targetViewId
        ? {id: targetViewId, label: allFviews[targetViewId].label}
        : null,
    [targetViewId, allFviews]
  );

  // memoize the section options
  const sectionOptions = useMemo(
    () =>
      selectedFormId
        ? viewsets[selectedFormId].views
            .filter(sectionId => sectionId !== viewId)
            .map(sectionId => ({
              id: sectionId,
              label: allFviews[sectionId].label,
            }))
        : [],
    [selectedFormId, viewsets, viewId, allFviews]
  );

  /** Toggles `component-parameters.hidden` without expanding the accordion. */
  const toggleHiddenState = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    dispatch(toggleFieldHidden({fieldName, hidden: !isHidden}));
  };

  const requiredBlocksHiding =
    isRequired && fieldComponent !== 'TemplatedStringField';

  const handleAccordionChange = useCallback(
    (_event: React.SyntheticEvent, nextExpanded: boolean) => {
      onExpandedChange(designerIdentifier, nextExpanded);
    },
    [designerIdentifier, onExpandedChange]
  );
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} =
    useSortable({id: fieldName, disabled: dragDisabled});
  const baseTransform =
    CSS.Transform.toString(transform) || 'translate3d(0, 0, 0)';
  const canDragField = !expanded && !dragDisabled;

  useEffect(() => {
    if (!expanded || !autoFocusLabel) return;

    let cancelled = false;

    const focusLabel = () => {
      if (cancelled) return;
      window.requestAnimationFrame(() => {
        if (cancelled) return;
        const labelInput =
          editorRootRef.current?.querySelector<HTMLInputElement>(
            'input[data-field-label-input="true"]'
          );
        if (!labelInput) return;
        labelInput.focus();
        labelInput.select();
        onLabelFocused?.();
      });
    };

    if (isHidden) {
      // Hidden fields (e.g. templated string) render below visible fields; focus
      // alone does not scroll the designer panel to them.
      void scrollToDesignerElement(designerFieldSelector(fieldName)).then(
        focusLabel
      );
    } else {
      focusLabel();
    }

    return () => {
      cancelled = true;
    };
  }, [expanded, autoFocusLabel, fieldName, isHidden, onLabelFocused]);

  return (
    <Accordion
      key={fieldName}
      ref={setNodeRef}
      // Scroll target for global design search (see designerElementIds).
      data-designer-field={fieldName}
      expanded={expanded}
      onChange={handleAccordionChange}
      slotProps={{
        transition: {
          unmountOnExit: false,
        },
      }}
      disableGutters
      square
      elevation={0}
      sx={{
        transform: baseTransform,
        transition:
          transition ??
          'transform 180ms cubic-bezier(0.2, 0.7, 0.2, 1), box-shadow 180ms ease, border-color 180ms ease, background 180ms ease',
        opacity: isDragging ? 0.86 : 1,
        border: '1px solid',
        borderColor: theme =>
          isDragging
            ? alpha(theme.palette.primary.main, 0.36)
            : alpha(theme.palette.text.primary, 0.12),
        borderRadius: 1.25,
        overflow: 'hidden',
        mb: 0.9,
        background: theme =>
          `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.985)} 0%, ${alpha(
            theme.palette.text.primary,
            0.03
          )} 100%)`,
        boxShadow: isDragging
          ? '0 10px 24px rgba(22, 35, 50, 0.13)'
          : '0 7px 18px rgba(22, 35, 50, 0.09), 0 2px 6px rgba(22, 35, 50, 0.06), inset 0 1px 0 rgba(255,255,255,0.8)',
        '&:hover': {
          borderColor: theme =>
            isDragging
              ? alpha(theme.palette.primary.main, 0.36)
              : alpha(theme.palette.primary.main, 0.28),
          boxShadow: isDragging
            ? '0 10px 24px rgba(22, 35, 50, 0.13)'
            : '0 10px 22px rgba(22, 35, 50, 0.12), 0 3px 8px rgba(22, 35, 50, 0.08), inset 0 1px 0 rgba(255,255,255,0.84)',
          transform: isDragging
            ? baseTransform
            : `${baseTransform} translateY(-1px)`,
        },
        '&:before': {
          display: 'none',
        },
      }}
    >
      <AccordionSummary
        expandIcon={
          <Box sx={{display: 'inline-flex', alignItems: 'center', gap: 0.25}}>
            <DragHandle
              compact
              label={
                canDragField
                  ? 'Drag field to reorder'
                  : dragDisabled
                    ? 'Collapse expanded fields first to drag and reorder'
                    : 'Collapse field first to drag and reorder'
              }
              disabled={!canDragField}
              dragAttributes={canDragField ? attributes : undefined}
              dragListeners={canDragField ? listeners : undefined}
              onPointerDown={event => event.stopPropagation()}
              onClick={event => event.stopPropagation()}
            />
            <ArrowForwardIosRoundedIcon
              className="field-expand-arrow"
              sx={{fontSize: '1.25rem', color: 'text.primary', fontWeight: 700}}
            />
          </Box>
        }
        sx={{
          background: theme =>
            `linear-gradient(180deg, ${alpha(theme.palette.text.primary, 0.032)} 0%, ${alpha(
              theme.palette.text.primary,
              0.02
            )} 100%)`,
          flexDirection: 'row-reverse',
          px: {xs: 1.2, sm: 1.6},
          py: 0.2,
          minHeight: 84,
          transition: 'background 160ms ease',
          '&:hover': {
            background: theme =>
              `linear-gradient(180deg, ${alpha(theme.palette.text.primary, 0.05)} 0%, ${alpha(
                theme.palette.text.primary,
                0.03
              )} 100%)`,
          },
          '& .MuiAccordionSummary-expandIconWrapper': {
            transform: 'none !important',
          },
          '& .field-expand-arrow': {
            transition: 'transform 0.2s ease',
          },
          '& .MuiAccordionSummary-expandIconWrapper.Mui-expanded .field-expand-arrow':
            {
              transform: 'rotate(90deg)',
            },
          '& .MuiAccordionSummary-expandIconWrapper button': {
            pointerEvents: 'auto',
          },
          '& .MuiAccordionSummary-content': {
            marginLeft: '10px',
            my: 1.2,
          },
        }}
      >
        <Grid
          container
          spacing={2}
          sx={{width: '100%', rowGap: 1, alignItems: 'center'}}
        >
          <Grid size={8}>
            <Stack direction="column" spacing={1} sx={{pr: {xs: 0, sm: 2}}}>
              <Typography
                variant="subtitle2"
                sx={{
                  color: theme => theme.palette.grey[900],
                  fontWeight: 700,
                  fontSize: '1.02rem',
                  lineHeight: 1.28,
                  letterSpacing: '0.005em',
                  width: '100%',
                  minWidth: 0,
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                  whiteSpace: 'normal',
                }}
              >
                {label}
              </Typography>

              {field['component-parameters'].helperText && (
                <Typography
                  variant="body2"
                  sx={{
                    mt: 0.65,
                    px: 1,
                    py: 0.5,
                    fontSize: 13,
                    fontWeight: 450,
                    fontStyle: 'italic',
                    color: 'text.secondary',
                    background: theme =>
                      `linear-gradient(100deg, ${alpha(theme.palette.grey[400], 0.15)} 0%, ${alpha(
                        theme.palette.grey[500],
                        0.09
                      )} 18%, ${alpha(theme.palette.text.primary, 0.03)} 55%, ${alpha(
                        theme.palette.text.primary,
                        0.014
                      )} 100%)`,
                    boxShadow: theme =>
                      `0 1px 5px ${alpha(theme.palette.common.black, 0.045)}, inset 0 1px 0 ${alpha(
                        theme.palette.common.white,
                        0.72
                      )}`,
                    borderRadius: 0.95,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {field['component-parameters'].helperText}
                </Typography>
              )}
              {/* Chips below question + helper text */}
              <Stack direction="row" spacing={1} sx={{flexWrap: 'wrap'}}>
                <Chip
                  label={fieldComponentDisplayName}
                  size="small"
                  variant="outlined"
                  sx={{
                    height: 23,
                    '& .MuiChip-label': {
                      px: 1,
                      fontSize: '0.8rem',
                      fontWeight: 700,
                    },
                    '&.MuiChip-outlined': {
                      background: theme =>
                        `linear-gradient(180deg, ${alpha(theme.palette.grey[300], 0.24)} 0%, ${alpha(
                          theme.palette.grey[400],
                          0.14
                        )} 100%)`,
                      color: theme => theme.palette.grey[800],
                      borderColor: theme =>
                        alpha(theme.palette.grey[700], 0.38),
                    },
                  }}
                />
                {field['component-parameters'].required && (
                  <Chip
                    label="Required"
                    size="small"
                    variant="outlined"
                    sx={{
                      fontWeight: 650,
                      fontSize: '0.68rem',
                      height: 23,
                      '& .MuiChip-label': {
                        px: 1,
                      },
                      borderColor: theme =>
                        alpha(theme.palette.error.main, 0.82),
                      color: 'error.main',
                      backgroundColor: theme =>
                        alpha(theme.palette.error.main, 0.06),
                    }}
                  />
                )}
              </Stack>
            </Stack>
          </Grid>
          <Grid size={4}>
            <Stack
              direction="row"
              spacing={0.25}
              sx={{
                p: 0.35,
                justifyContent: {sm: 'right', xs: 'left'},
                borderRadius: 1,
              }}
            >
              <Tooltip title="Delete Field">
                <IconButton
                  onClick={deleteField}
                  aria-label="delete"
                  size="small"
                  sx={{
                    color: 'error.main',
                    '&:hover': {
                      backgroundColor: theme =>
                        alpha(theme.palette.error.main, 0.14),
                      color: 'error.dark',
                    },
                  }}
                >
                  <DeleteRoundedIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Move Field to another section">
                <IconButton
                  onClick={() => setOpenMoveDialog(true)}
                  aria-label="move"
                  size="small"
                  sx={{
                    color: theme => alpha(theme.palette.common.black, 0.62),
                    '&:hover': {
                      color: theme => alpha(theme.palette.common.black, 0.82),
                      backgroundColor: theme =>
                        alpha(theme.palette.common.black, 0.06),
                    },
                  }}
                >
                  <MoveRoundedIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Add Field Below">
                <IconButton
                  onClick={addFieldBelow}
                  aria-label="add field"
                  size="small"
                  sx={{
                    color: 'success.dark',
                    '&:hover': {
                      color: theme => alpha(theme.palette.success.dark, 0.95),
                      backgroundColor: theme =>
                        alpha(theme.palette.success.main, 0.16),
                    },
                  }}
                >
                  <PlaylistAddIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Duplicate Field">
                <IconButton
                  onClick={handleOpenDuplicateDialog}
                  aria-label="duplicate"
                  size="small"
                  sx={{
                    color: theme => alpha(theme.palette.info.dark, 0.78),
                    '&:hover': {
                      backgroundColor: theme =>
                        alpha(theme.palette.info.main, 0.1),
                    },
                  }}
                >
                  <DuplicateIcon />
                </IconButton>
              </Tooltip>
              {isHidden ? (
                <Tooltip
                  title={
                    protection === 'protected'
                      ? 'Fully protected fields cannot be hidden'
                      : requiredBlocksHiding
                        ? 'Required fields cannot be hidden'
                        : 'Unhide Field'
                  }
                >
                  <span>
                    <IconButton
                      onClick={toggleHiddenState}
                      aria-label="unhide field"
                      size="small"
                      disabled={
                        protection === 'protected' || requiredBlocksHiding
                      }
                      sx={{
                        color: theme => alpha(theme.palette.success.dark, 0.76),
                        '&:hover': {
                          backgroundColor: theme =>
                            alpha(theme.palette.success.main, 0.09),
                        },
                      }}
                    >
                      <VisibilityIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              ) : (
                <>
                  <Tooltip
                    title={
                      protection === 'protected'
                        ? 'Fully protected fields cannot be hidden'
                        : requiredBlocksHiding
                          ? 'Required fields cannot be hidden'
                          : 'Hide Field'
                    }
                  >
                    <span>
                      <IconButton
                        onClick={toggleHiddenState}
                        aria-label="hide field"
                        size="small"
                        disabled={
                          protection === 'protected' || requiredBlocksHiding
                        }
                        sx={{
                          color: theme => alpha(theme.palette.info.main, 0.66),
                          '&:hover': {
                            backgroundColor: theme =>
                              alpha(theme.palette.info.main, 0.1),
                          },
                        }}
                      >
                        <VisibilityOffIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </>
              )}
              <Tooltip title={isFirstField ? 'Already at the top' : 'Move up'}>
                <IconButton
                  onClick={moveFieldUp}
                  aria-label="up"
                  size="small"
                  onAnimationEnd={() => setShakingUp(false)}
                  sx={{
                    color: isFirstField ? 'text.disabled' : 'text.primary',
                    animation: shakingUp
                      ? `${shakeAnim} 0.35s ease`
                      : undefined,
                    '&:hover': {
                      backgroundColor: theme =>
                        alpha(theme.palette.secondary.main, 0.1),
                    },
                    '& .MuiSvgIcon-root': {fontSize: '1.45rem'},
                  }}
                >
                  <ArrowDropUpRoundedIcon />
                </IconButton>
              </Tooltip>
              <Tooltip
                title={isLastField ? 'Already at the bottom' : 'Move down'}
              >
                <IconButton
                  onClick={moveFieldDown}
                  aria-label="down"
                  size="small"
                  onAnimationEnd={() => setShakingDown(false)}
                  sx={{
                    color: isLastField ? 'text.disabled' : 'text.primary',
                    animation: shakingDown
                      ? `${shakeAnim} 0.35s ease`
                      : undefined,
                    '&:hover': {
                      backgroundColor: theme =>
                        alpha(theme.palette.secondary.main, 0.1),
                    },
                    '& .MuiSvgIcon-root': {fontSize: '1.45rem'},
                  }}
                >
                  <ArrowDropDownRoundedIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Grid>
        </Grid>
        <Dialog
          open={deleteWarningOpen}
          onClose={() => setDeleteWarningOpen(false)}
          fullWidth
          maxWidth="sm"
          slotProps={{
            transition: {
              onExited: () => {
                setConditionsAffected([]);
              },
            },
          }}
        >
          <DialogTitle sx={designerDialogTitleSx}>
            Cannot Delete Field
          </DialogTitle>
          <DialogContent sx={designerDialogContentSx}>
            <Box
              sx={{
                border: '1px solid',
                borderColor: 'warning.light',
                borderRadius: 1.5,
                p: 2,
                backgroundColor: theme =>
                  alpha(theme.palette.warning.main, 0.08),
                mb: 2,
              }}
            >
              <Typography variant="subtitle1" sx={{fontWeight: 700, mb: 0.75}}>
                Referenced From
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                useFlexGap
                sx={{flexWrap: 'wrap'}}
              >
                <Chip
                  size="small"
                  label={`Form: ${viewsets[viewSetId]?.label ?? viewSetId}`}
                />
                <Chip
                  size="small"
                  label={`Section: ${allFviews[viewId]?.label ?? viewId}`}
                />
                <Chip size="small" label={`Field: ${label}`} />
              </Stack>
            </Box>

            <Typography variant="subtitle1" sx={{fontWeight: 700, mb: 1}}>
              Dependencies ({conditionsAffected.length})
            </Typography>
            <Stack spacing={1.1}>
              {conditionsAffected.map((dependency, index) => (
                <Box
                  key={`${dependency.type}-${dependency.fieldId ?? dependency.sectionId ?? index}`}
                  sx={{
                    border: '1px solid',
                    borderColor: theme =>
                      alpha(theme.palette.warning.main, 0.22),
                    borderRadius: 1.25,
                    p: 1.25,
                    backgroundColor: theme =>
                      alpha(theme.palette.background.paper, 0.75),
                  }}
                >
                  <Typography variant="body2" sx={{fontWeight: 700}}>
                    {dependency.type === 'section-condition'
                      ? 'Section Condition'
                      : dependency.type === 'templated-string'
                        ? 'Templated String'
                        : 'Field Condition'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {dependency.fieldLabel ??
                      dependency.sectionLabel ??
                      'Unknown reference'}
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={0.75}
                    useFlexGap
                    sx={{mt: 0.75, flexWrap: 'wrap'}}
                  >
                    {dependency.formLabel && (
                      <Chip
                        size="small"
                        variant="filled"
                        label={`Form: ${dependency.formLabel}`}
                        sx={{
                          fontWeight: 700,
                          color: 'primary.dark',
                          backgroundColor: theme =>
                            alpha(theme.palette.primary.main, 0.16),
                          border: '1px solid',
                          borderColor: theme =>
                            alpha(theme.palette.primary.main, 0.35),
                        }}
                      />
                    )}
                    {dependency.sectionLabel && (
                      <Chip
                        size="small"
                        variant="filled"
                        label={`Section: ${dependency.sectionLabel}`}
                        sx={{
                          fontWeight: 700,
                          color: 'secondary.dark',
                          backgroundColor: theme =>
                            alpha(theme.palette.secondary.main, 0.16),
                          border: '1px solid',
                          borderColor: theme =>
                            alpha(theme.palette.secondary.main, 0.38),
                        }}
                      />
                    )}
                    {dependency.templateUsage && (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`Uses ${dependency.templateUsage}`}
                      />
                    )}
                  </Stack>
                </Box>
              ))}
            </Stack>
            <Typography variant="body2" sx={{mt: 1.5}} color="text.secondary">
              Remove these dependencies before deleting this field.
            </Typography>
          </DialogContent>
          <DialogActions sx={designerDialogActionsSx}>
            <Button
              sx={designerCancelButtonSx}
              onClick={event => {
                event.stopPropagation();
                setDeleteWarningOpen(false);
              }}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </AccordionSummary>

      <Dialog
        open={openMoveDialog}
        onClose={handleCloseMoveDialog}
        aria-labelledby="move-dialog-title"
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle id="move-dialog-title" sx={designerDialogTitleSx}>
          Move Field
        </DialogTitle>
        <DialogContent sx={designerDialogContentSx}>
          {conflictError && (
            <Alert severity="error" sx={{mb: 2}}>
              <Typography variant="body2" sx={{mb: 1}}>
                {conflictError.message}
              </Typography>
              <ul style={{marginTop: 8, paddingLeft: 20}}>
                {conflictError.conflicts.map((ref, idx) => (
                  <li key={idx}>
                    {ref.type === 'section-condition'
                      ? `Section Condition: ${ref.sectionLabel ?? 'Unknown section'}`
                      : ref.type === 'templated-string'
                        ? `Templated String: ${ref.fieldLabel ?? ref.fieldId ?? 'Unknown field'}`
                        : `Field Condition: ${ref.fieldLabel ?? ref.fieldId ?? 'Unknown field'}`}
                  </li>
                ))}
              </ul>
            </Alert>
          )}
          <Typography variant="body2" sx={designerDialogFieldLabelSx}>
            Destination Form
          </Typography>
          <Typography variant="body2" sx={designerDialogBodyTextSx}>
            Choose the form you want to move the field to.
          </Typography>
          <Autocomplete
            fullWidth
            value={formValue}
            onChange={(_event, newValue) => {
              setSelectedFormId(newValue ? newValue.id : null);
              setTargetViewId('');
              setConflictError(null);
            }}
            options={formOptions}
            getOptionLabel={option => option.label}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={params => (
              <DebouncedTextField onChange={function (): void {}} {...params} />
            )}
          />
          <Typography variant="body2" sx={designerDialogFieldLabelSx}>
            Destination Section
          </Typography>
          <Typography variant="body2" sx={designerDialogBodyTextSx}>
            Choose the section you want to move the field to.
          </Typography>
          <Autocomplete
            fullWidth
            value={selectedFormId ? sectionValue : null}
            onChange={(_event, newValue) => {
              setTargetViewId(newValue ? newValue.id : '');
              setConflictError(null);
            }}
            options={sectionOptions}
            getOptionLabel={option => option.label}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            disabled={!selectedFormId}
            renderInput={params => (
              <DebouncedTextField onChange={function (): void {}} {...params} />
            )}
          />
        </DialogContent>
        <DialogActions sx={designerDialogActionsSx}>
          <Button sx={designerCancelButtonSx} onClick={handleCloseMoveDialog}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={moveFieldToSection}
            disabled={!selectedFormId || !targetViewId}
          >
            Move
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openDuplicateDialog}
        onClose={handleCloseDuplicateDialog}
        aria-labelledby="duplicate-dialog-title"
        fullWidth
        maxWidth="sm"
        onClick={e => e.stopPropagation()}
      >
        <DialogTitle id="duplicate-dialog-title" sx={designerDialogTitleSx}>
          Duplicate Field
        </DialogTitle>
        <DialogContent sx={designerDialogContentSx}>
          <Typography variant="body2" sx={designerDialogFieldLabelSx}>
            Field Title
          </Typography>
          <DebouncedTextField
            autoFocus
            fullWidth
            size="small"
            value={duplicateTitle}
            onChange={e => setDuplicateTitle(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={designerDialogActionsSx}>
          <Button
            sx={designerCancelButtonSx}
            onClick={handleCloseDuplicateDialog}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={duplicateField}
            disabled={!duplicateTitle.trim()}
          >
            Duplicate
          </Button>
        </DialogActions>
      </Dialog>

      {expanded && (
        <AccordionDetails
          sx={{
            padding: 3,
            backgroundColor: theme => alpha(theme.palette.primary.main, 0.03),
          }}
        >
          {(protection === 'protected' || protection === 'allow-hiding') && (
            <Stack
              direction="column"
              spacing={1}
              sx={{
                width: '100%',
                padding: 2,
                marginBottom: 2,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'text.secondary',
                boxSizing: 'border-box',
                textAlign: 'center',
              }}
            >
              <LockRounded sx={{color: 'text.secondary', fontSize: 24}} />
              <Typography
                variant="body2"
                sx={{fontWeight: 500, color: 'text.secondary'}}
              >
                {protectionMessage}
              </Typography>
            </Stack>
          )}
          <div
            ref={editorRootRef}
            style={{
              pointerEvents: disableEditing ? 'none' : 'auto',
              opacity: disableEditing ? 0.5 : 1,
            }}
          >
            <Grid container sx={designerResponsiveFieldEditorSx}>
              {invalidRefs.length > 0 && (
                <Grid size={12} sx={{marginBottom: 3.5}}>
                  <Alert severity="warning">
                    The following fields/sections have visibility conditions
                    that depend on this field having a specific option
                    available:
                    <ul style={{marginTop: '8px', paddingLeft: '20px'}}>
                      {invalidRefs.map((msg, idx) => (
                        <li key={idx}>{msg}</li>
                      ))}
                    </ul>
                    Please update this field, or remove/modify affected
                    conditions.
                  </Alert>
                </Grid>
              )}

              <Grid size={12}>
                {renderFieldEditor({
                  fieldComponent,
                  context: {fieldName, viewId, viewSetId},
                })}
              </Grid>
            </Grid>
          </div>
        </AccordionDetails>
      )}
    </Accordion>
  );
};

/** Memoised {@link FieldEditorComponent} for stable props from parent lists. */
export const FieldEditor = memo(FieldEditorComponent);
