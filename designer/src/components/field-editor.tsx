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
import React, {useMemo, useState} from 'react';
import {useAppDispatch, useAppSelector} from '../state/hooks';
import {
  findFieldCondtionUsage,
  findInvalidConditionReferences,
} from './condition';
import DebouncedTextField from './debounced-text-field';
import {AdvancedSelectEditor} from './Fields/AdvancedSelectEditor';
import {BaseFieldEditor} from './Fields/BaseFieldEditor';
import {BasicAutoIncrementerEditor} from './Fields/BasicAutoIncrementer';
import {DateTimeNowEditor} from './Fields/DateTimeNowEditor';
import {MapFormFieldEditor} from './Fields/MapFormFieldEditor';
import {MultipleTextFieldEditor} from './Fields/MultipleTextField';
import {OptionsEditor} from './Fields/OptionsEditor';
import {RandomStyleEditor} from './Fields/RandomStyleEditor';
import {RelatedRecordEditor} from './Fields/RelatedRecordEditor';
import {RichTextEditor} from './Fields/RichTextEditor';
import {TakePhotoFieldEditor} from './Fields/TakePhotoField';
import {TemplatedStringFieldEditor} from './Fields/TemplatedStringFieldEditor';
import {TextFieldEditor} from './Fields/TextFieldEditor';

type FieldEditorProps = {
  fieldName: string;
  viewSetId: string;
  viewId: string;
  expanded: boolean;
  addFieldCallback: (fieldName: string) => void;
  handleExpandChange: (event: React.SyntheticEvent, newState: boolean) => void;
  moveFieldCallback: (targetViewId: string) => void;
};

type ConflictError = {
  title: string;
  message: string;
  conflicts: string[];
};

export const FieldEditor = ({
  fieldName,
  viewId,
  viewSetId,
  expanded,
  addFieldCallback,
  handleExpandChange,
  moveFieldCallback,
}: FieldEditorProps) => {
  const field = useAppSelector(
    state => state.notebook['ui-specification'].fields[fieldName]
  );
  const viewsets = useAppSelector(
    state => state.notebook['ui-specification'].viewsets
  );

  const allFields = useAppSelector(
    state => state.notebook['ui-specification'].fields
  );
  const allFviews = useAppSelector(
    state => state.notebook['ui-specification'].fviews
  );

  const invalidRefs = useMemo(() => {
    return findInvalidConditionReferences(
      fieldName,
      field,
      allFields,
      allFviews
    );
  }, [fieldName, field, allFields, allFviews]);

  const dispatch = useAppDispatch();

  const [openMoveDialog, setOpenMoveDialog] = useState(false);
  const [targetViewId, setTargetViewId] = useState('');
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [openDuplicateDialog, setOpenDuplicateDialog] = useState(false);
  const [duplicateTitle, setDuplicateTitle] = useState('');

  const fieldComponent = field['component-name'];

  const [deleteWarningOpen, setDeleteWarningOpen] = useState(false);
  const [conditionsAffected, setConditionsAffected] = useState<string[]>([]);

  const [conflictError, setConflictError] = useState<ConflictError | null>(
    null
  );

  const deleteField = (evt: React.SyntheticEvent) => {
    evt.stopPropagation();

    const usage = findFieldCondtionUsage(fieldName, allFields, allFviews);

    if (usage.length > 0) {
      setConditionsAffected(usage);
      setDeleteWarningOpen(true);
    } else {
      dispatch({
        type: 'ui-specification/fieldDeleted',
        payload: {fieldName, viewId},
      });
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
    dispatch({
      type: 'ui-specification/fieldMoved',
      payload: {fieldName, viewId, direction: 'down'},
    });
  };

  const moveFieldUp = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    dispatch({
      type: 'ui-specification/fieldMoved',
      payload: {fieldName, viewId, direction: 'up'},
    });
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
      dispatch({
        type: 'ui-specification/fieldDuplicated',
        payload: {
          originalFieldName: fieldName,
          newFieldName: duplicateTitle.trim(),
          viewId,
        },
      });
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
      const usage = findFieldCondtionUsage(fieldName, allFields, allFviews);
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

      dispatch({
        type: 'ui-specification/fieldMovedToSection',
        payload: {
          fieldName,
          sourceViewId: viewId,
          targetViewId,
        },
      });
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

  const toggleHiddenState = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    dispatch({
      type: 'ui-specification/toggleFieldHidden',
      payload: {fieldName, hidden: !isHidden},
    });
  };

  const requiredBlocksHiding =
    isRequired && fieldComponent !== 'TemplatedStringField';

  return (
    <Accordion
      key={fieldName}
      expanded={expanded}
      onChange={handleExpandChange}
      disableGutters
      square
      elevation={0}
      sx={{
        border: '1px solid #CBCFCD',
        '&:not(:nth-of-type(2))': {
          borderTop: 0,
        },
        '&:before': {
          display: 'none',
        },
      }}
    >
      <AccordionSummary
        expandIcon={<ArrowForwardIosRoundedIcon sx={{fontSize: '1rem'}} />}
        sx={{
          backgroundColor: '#EEF1F0',
          flexDirection: 'row-reverse',
          '& .MuiAccordionSummary-expandIconWrapper.Mui-expanded': {
            transform: 'rotate(90deg)',
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
                  minWidth: 210,
                  maxWidth: 210,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
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
                      background: '#f9fafb',
                      color: '#546e7a',
                      borderColor: '#546e7a',
                    },
                  }}
                />
                {field['component-parameters'].required && (
                  <Chip label="Required" size="small" color="primary" />
                )}
              </Stack>
              {field['component-parameters'].helperText && (
                <Typography
                  variant="body2"
                  fontSize={12}
                  fontWeight={400}
                  fontStyle="italic"
                  sx={{
                    mt: 1.5,
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
                >
                  <DeleteRoundedIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Move Field">
                <IconButton
                  onClick={() => setOpenMoveDialog(true)}
                  aria-label="move"
                  size="small"
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
              <Tooltip title="Move up">
                <IconButton onClick={moveFieldUp} aria-label="up" size="small">
                  <ArrowDropUpRoundedIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Move down">
                <IconButton
                  onClick={moveFieldDown}
                  aria-label="down"
                  size="small"
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
          TransitionProps={{
            onExited: () => {
              setConditionsAffected([]);
            },
          }}
        >
          <DialogTitle>Cannot Delete Field</DialogTitle>
          <DialogContent>
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
          <DialogActions>
            <Button
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
        maxWidth="sm"
      >
        <DialogTitle id="move-dialog-title" textAlign="center">
          Move Question
        </DialogTitle>
        <DialogContent>
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
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="body1" sx={{mt: 1, mb: 1, fontWeight: 450}}>
                Destination Form
              </Typography>
              <Typography variant="body2" sx={{mb: 0.5}}>
                Choose the form you want to move the question to.
              </Typography>
              <Autocomplete
                fullWidth
                value={formValue}
                onChange={(_event, newValue) => {
                  setSelectedFormId(newValue ? newValue.id : null);
                  setTargetViewId(''); // reset section when form changes
                  setConflictError(null);
                }}
                options={formOptions}
                getOptionLabel={option => option.label}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={params => <DebouncedTextField {...params} />}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body1" sx={{mt: 1, mb: 1, fontWeight: 450}}>
                Destination Section
              </Typography>
              <Typography variant="body2" sx={{mb: 0.5}}>
                Choose the section you want to move the question to.
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
                renderInput={params => <DebouncedTextField {...params} />}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseMoveDialog}>Cancel</Button>
          <Button
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
        maxWidth="sm"
        onClick={e => e.stopPropagation()}
      >
        <DialogTitle id="duplicate-dialog-title" textAlign="center">
          Duplicate Field
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{mb: 2}}>
            Enter a title for the duplicated field.
          </Typography>
          <DebouncedTextField
            autoFocus
            fullWidth
            value={duplicateTitle}
            onChange={e => setDuplicateTitle(e.target.value)}
            label="Field Title"
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDuplicateDialog}>Cancel</Button>
          <Button onClick={duplicateField} disabled={!duplicateTitle.trim()}>
            Duplicate
          </Button>
        </DialogActions>
      </Dialog>

      <AccordionDetails sx={{padding: 3, backgroundColor: '#00804004'}}>
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
              border: '1px solid #546e7a',
              boxSizing: 'border-box',
              textAlign: 'center',
            }}
          >
            <LockRounded sx={{color: '#546e7a', fontSize: 24}} />
            <Typography
              variant="body2"
              sx={{fontWeight: 500, color: '#546e7a'}}
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
                Please update this field, or remove/modify affected conditions.
              </Alert>
            </Grid>
          )}

          {(fieldComponent === 'MultipleTextField' && (
            <MultipleTextFieldEditor fieldName={fieldName} />
          )) ||
            (fieldComponent === 'TakePhoto' && (
              <TakePhotoFieldEditor fieldName={fieldName} />
            )) ||
            (fieldComponent === 'TextField' && (
              <TextFieldEditor fieldName={fieldName} />
            )) ||
            (fieldComponent === 'DateTimeNow' && (
              <DateTimeNowEditor fieldName={fieldName} />
            )) ||
            (fieldComponent === 'Select' && (
              <OptionsEditor fieldName={fieldName} />
            )) ||
            (fieldComponent === 'MultiSelect' && (
              <OptionsEditor
                fieldName={fieldName}
                showExpandedChecklist={true}
              />
            )) ||
            (fieldComponent === 'AdvancedSelect' && (
              <AdvancedSelectEditor fieldName={fieldName} />
            )) ||
            (fieldComponent === 'RadioGroup' && (
              <OptionsEditor fieldName={fieldName} />
            )) ||
            (fieldComponent === 'MapFormField' && (
              <MapFormFieldEditor fieldName={fieldName} />
            )) ||
            (fieldComponent === 'RandomStyle' && (
              <RandomStyleEditor fieldName={fieldName} />
            )) ||
            (fieldComponent === 'RichText' && (
              <RichTextEditor fieldName={fieldName} />
            )) ||
            (fieldComponent === 'RelatedRecordSelector' && (
              <RelatedRecordEditor fieldName={fieldName} />
            )) ||
            (fieldComponent === 'BasicAutoIncrementer' && (
              <BasicAutoIncrementerEditor
                fieldName={fieldName}
                viewId={viewId}
              />
            )) ||
            (fieldComponent === 'TemplatedStringField' && (
              <TemplatedStringFieldEditor
                fieldName={fieldName}
                viewId={viewId}
                viewsetId={viewSetId}
              />
            )) || <BaseFieldEditor fieldName={fieldName} />}
        </div>
      </AccordionDetails>
    </Accordion>
  );
};
