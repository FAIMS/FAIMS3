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
import React, {memo, useCallback, useMemo, useState} from 'react';
import {useAppDispatch, useAppSelector} from '../state/hooks';
import {
  findFieldConditionUsage,
  findInvalidConditionReferences,
} from './condition/utils';
import DebouncedTextField from './debounced-text-field';
import {keyframes} from '@emotion/react';
import {renderFieldEditor} from '../features/design/field-editor-registry';
import {
  designerCancelButtonSx,
  designerDialogActionsSx,
  designerDialogBodyTextSx,
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
};

type ConflictError = {
  title: string;
  message: string;
  conflicts: string[];
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
}: FieldEditorProps) => {
  const field = useAppSelector(
    state => state.notebook['ui-specification'].present.fields[fieldName]
  );
  const viewsets = useAppSelector(
    state => state.notebook['ui-specification'].present.viewsets
  );

  const allFields = useAppSelector(
    state => state.notebook['ui-specification'].present.fields
  );
  const allFviews = useAppSelector(
    state => state.notebook['ui-specification'].present.fviews
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

  const [deleteWarningOpen, setDeleteWarningOpen] = useState(false);
  const [conditionsAffected, setConditionsAffected] = useState<string[]>([]);

  const [conflictError, setConflictError] = useState<ConflictError | null>(
    null
  );

  const deleteField = (evt: React.SyntheticEvent) => {
    evt.stopPropagation();

    const usage = findFieldConditionUsage(fieldName, allFields, allFviews);

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
    VITE_TEMPLATE_PROTECTIONS && Boolean(notebookMetadata['derived-from']);

  const disableEditing =
    isDerivedFromSet &&
    (protection === 'protected' || protection === 'allow-hiding');

  const getFieldLabel = () => {
    return (
      (field['component-parameters'] && field['component-parameters'].label) ||
      (field['component-parameters'].InputLabelProps &&
        field['component-parameters'].InputLabelProps.label) ||
      field['component-parameters'].name
    );
  };

  const label = getFieldLabel();

  const moveFieldDown = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    if (isLastField) { setShakingDown(true); return; }
    dispatch(fieldMoved({fieldName, viewId, direction: 'down'}));
  };

  const moveFieldUp = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    if (isFirstField) { setShakingUp(true); return; }
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
      const usage = findFieldConditionUsage(fieldName, allFields, allFviews);
      const targetSectionLabel = allFviews[targetViewId]?.label || '';
      const conflicts = usage.filter(u =>
        u.includes(`Section: ${targetSectionLabel}`)
      );

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
    useSortable({id: fieldName});

  return (
    <Accordion
      key={fieldName}
      ref={setNodeRef}
      expanded={expanded}
      onChange={handleAccordionChange}
      TransitionProps={{unmountOnExit: true}}
      disableGutters
      square
      elevation={0}
      sx={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.82 : 1,
        border: '1px solid',
        borderColor: 'divider',
        '&:not(:nth-of-type(2))': {
          borderTop: 0,
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
              label="Drag field to reorder"
              dragAttributes={attributes}
              dragListeners={listeners}
              onPointerDown={event => event.stopPropagation()}
              onClick={event => event.stopPropagation()}
            />
            <ArrowForwardIosRoundedIcon
              className="field-expand-arrow"
              sx={{fontSize: '1rem'}}
            />
          </Box>
        }
        sx={{
          backgroundColor: theme => alpha(theme.palette.text.primary, 0.05),
          flexDirection: 'row-reverse',
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
          },
        }}
      >
        <Grid container rowGap={1} alignItems={'center'}>
          <Grid item xs={12} sm={8}>
            <Stack direction="column" spacing={1} pr={{xs: 0, sm: 2}}>
              <Typography
                variant="subtitle2"
                sx={{
                  color: theme => theme.palette.grey[800],
                  fontWeight: 600,
                  width: '100%',
                  minWidth: 0,
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                  whiteSpace: 'normal',
                }}
              >
                {label}
              </Typography>

              {/* Chips Below Title (Tighter Spacing) */}
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip
                  label={fieldComponent}
                  size="small"
                  variant="outlined"
                  sx={{
                    '&.MuiChip-outlined': {
                      background: theme =>
                        alpha(theme.palette.text.primary, 0.02),
                      color: 'text.secondary',
                      borderColor: 'text.secondary',
                    },
                  }}
                />
                {field['component-parameters'].required && (
                  <Chip
                    label="Required"
                    size="small"
                    variant="outlined"
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      borderColor: 'error.main',
                      color: 'error.main',
                    }}
                  />
                )}
              </Stack>
              {field['component-parameters'].helperText && (
                <Typography
                  variant="body2"
                  fontSize={13}
                  fontWeight={400}
                  fontStyle="italic"
                  sx={{
                    mt: 1.25,
                    px: 1,
                    py: 0.5,
                    color: 'text.disabled',
                    borderLeft: '2px solid',
                    borderColor: theme => alpha(theme.palette.text.secondary, 0.35),
                    backgroundColor: theme => alpha(theme.palette.text.primary, 0.03),
                    borderRadius: 0.75,
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
            </Stack>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Stack direction="row" justifyContent={{sm: 'right', xs: 'left'}}>
              <Tooltip title="Delete Field">
                <IconButton
                  onClick={deleteField}
                  aria-label="delete"
                  size="small"
                  sx={{color: 'error.main'}}
                >
                  <DeleteRoundedIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Move Field to another section">
                <IconButton
                  onClick={() => setOpenMoveDialog(true)}
                  aria-label="move"
                  size="small"
                  sx={{color: 'secondary.main'}}
                >
                  <MoveRoundedIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Add Field Below">
                <IconButton
                  onClick={addFieldBelow}
                  aria-label="add field"
                  size="small"
                >
                  <PlaylistAddIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Duplicate Field">
                <IconButton
                  onClick={handleOpenDuplicateDialog}
                  aria-label="duplicate"
                  size="small"
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
                    color: isFirstField ? 'text.disabled' : undefined,
                    animation: shakingUp
                      ? `${shakeAnim} 0.35s ease`
                      : undefined,
                  }}
                >
                  <ArrowDropUpRoundedIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title={isLastField ? 'Already at the bottom' : 'Move down'}>
                <IconButton
                  onClick={moveFieldDown}
                  aria-label="down"
                  size="small"
                  onAnimationEnd={() => setShakingDown(false)}
                  sx={{
                    color: isLastField ? 'text.disabled' : undefined,
                    animation: shakingDown
                      ? `${shakeAnim} 0.35s ease`
                      : undefined,
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
          TransitionProps={{
            onExited: () => {
              setConditionsAffected([]);
            },
          }}
        >
          <DialogTitle sx={designerDialogTitleSx}>Cannot Delete Field</DialogTitle>
          <DialogContent sx={{pt: 2.5, px: {xs: 2, sm: 3}}}>
            <Alert severity="warning">
              This field is referenced in the following conditions:
              <ul>
                {conditionsAffected.map((condition, index) => (
                  <li key={index}>{condition}</li>
                ))}
              </ul>
              Please remove all dependencies on this field before deleting it.
            </Alert>
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
        <DialogContent sx={{pt: 2.5, px: {xs: 2, sm: 3}}}>
          {conflictError && (
            <Alert severity="error" sx={{mb: 2}}>
              <Typography variant="body2" sx={{mb: 1}}>
                {conflictError.message}
              </Typography>
              <ul style={{marginTop: 8, paddingLeft: 20}}>
                {conflictError.conflicts.map((ref, idx) => (
                  <li key={idx}>{ref}</li>
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
        <DialogContent sx={{pt: 2.5, px: {xs: 2, sm: 3}}}>
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
          <Button sx={designerCancelButtonSx} onClick={handleCloseDuplicateDialog}>
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
              alignItems="center"
              justifyContent="center"
              spacing={1}
              sx={{
                width: '100%',
                padding: 2,
                marginBottom: 2,
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
            style={{
              pointerEvents: disableEditing ? 'none' : 'auto',
              opacity: disableEditing ? 0.5 : 1,
            }}
          >
            <Grid
              container
              sx={designerResponsiveFieldEditorSx}
            >
              {invalidRefs.length > 0 && (
                <Grid item xs={12} sx={{marginBottom: 3.5}}>
                  <Alert severity="warning">
                    The following fields/sections have visibility conditions that
                    depend on this field having a specific option available:
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

              <Grid item xs={12}>
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
