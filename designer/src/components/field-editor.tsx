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
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import MoveRoundedIcon from '@mui/icons-material/DriveFileMoveRounded';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {useAppDispatch, useAppSelector} from '../state/hooks';
import {AdvancedSelectEditor} from './Fields/AdvancedSelectEditor';
import {BaseFieldEditor} from './Fields/BaseFieldEditor';
import {BasicAutoIncrementerEditor} from './Fields/BasicAutoIncrementer';
import {DateTimeNowEditor} from './Fields/DateTimeNowEditor';
import HiddenFieldEditor from './Fields/HiddenToggle';
import {MapFormFieldEditor} from './Fields/MapFormFieldEditor';
import {MultipleTextFieldEditor} from './Fields/MultipleTextField';
import {OptionsEditor} from './Fields/OptionsEditor';
import {RandomStyleEditor} from './Fields/RandomStyleEditor';
import {RelatedRecordEditor} from './Fields/RelatedRecordEditor';
import {RichTextEditor} from './Fields/RichTextEditor';
import {TakePhotoFieldEditor} from './Fields/TakePhotoField';
import {TemplatedStringFieldEditor} from './Fields/TemplatedStringFieldEditor';
import {TextFieldEditor} from './Fields/TextFieldEditor';
import {useState, useMemo} from 'react';
import {isFieldUsedInCondition} from './condition';

type FieldEditorProps = {
  fieldName: string;
  viewSetId: string;
  viewId: string;
  expanded: boolean;
  addFieldCallback: (fieldName: string) => void;
  handleExpandChange: (event: React.SyntheticEvent, newState: boolean) => void;
  moveFieldCallback: (targetViewId: string) => void;
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

  const dispatch = useAppDispatch();

  const [openMoveDialog, setOpenMoveDialog] = useState(false);
  const [targetViewId, setTargetViewId] = useState('');
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);

  const fieldComponent = field['component-name'];

  const [deleteWarningOpen, setDeleteWarningOpen] = useState(false);
  const [conditionsAffected, setConditionsAffected] = useState<string[]>([]);

  const deleteField = (evt: React.SyntheticEvent) => {
    evt.stopPropagation();

    const usage = findFieldUsage(fieldName, allFields, allFviews);

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

  const confirmDelete = () => {
    dispatch({
      type: 'ui-specification/fieldDeleted',
      payload: {fieldName, viewId},
    });

    setDeleteWarningOpen(false);
  };

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

  const handleCloseMoveDialog = () => {
    setOpenMoveDialog(false);
    setSelectedFormId(null); // reset selectedFormId when dialog is closed
    setTargetViewId(''); // reset section value when dialog is closed
  };

  const moveFieldToSection = () => {
    if (targetViewId) {
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

  /**
   * Finds where a field is used in conditions or templated string fields
   */
  const findFieldUsage = (
    fieldName: string,
    allFields: Record<string, any>,
    allFviews: Record<string, any>
  ): string[] => {
    const affected: string[] = [];

    // Check section-level conditions
    for (const sectionId in allFviews) {
      const condition = allFviews[sectionId].condition;
      if (isFieldUsedInCondition(condition, fieldName)) {
        affected.push(`Section: ${allFviews[sectionId].label}`);
      }
    }

    // Check field-level conditions
    for (const fId in allFields) {
      const condition = allFields[fId].condition;
      if (isFieldUsedInCondition(condition, fieldName)) {
        const label = allFields[fId]['component-parameters']?.label ?? fId;
        affected.push(`Field Condition: ${label}`);
      }
    }

    // Check for Templated String Fields using the deleted field
    for (const fId in allFields) {
      if (allFields[fId]['component-name'] === 'TemplatedStringField') {
        const template = allFields[fId]['component-parameters']?.template || '';

        if (template.includes(`{{${fieldName}}}`)) {
          const label = allFields[fId]['component-parameters']?.label ?? fId;
          affected.push(`Templated String: ${label} (uses '{{${fieldName}}}')`);
        }
      }
    }

    return affected;
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
        color: '#1A211E',
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
        >
          <DialogTitle>Field Deletion Warning</DialogTitle>
          <DialogContent>
            <p>
              This field is referenced in the following conditions. Deleting it
              will invalidate them:
            </p>
            <ul>
              {conditionsAffected.map((condition, index) => (
                <li key={index}>{condition}</li>
              ))}
            </ul>
            <p>Are you sure you want to proceed?</p>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={e => {
                e.stopPropagation();
                setDeleteWarningOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={confirmDelete} color="error">
              Delete Anyway
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
                }}
                options={formOptions}
                getOptionLabel={option => option.label}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={params => <TextField {...params} />}
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
                }}
                options={sectionOptions}
                getOptionLabel={option => option.label}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                disabled={!selectedFormId}
                renderInput={params => <TextField {...params} />}
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

      <AccordionDetails sx={{padding: 3, backgroundColor: '#00804004'}}>
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
              showExclusiveOptions={true}
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
            <BasicAutoIncrementerEditor fieldName={fieldName} viewId={viewId} />
          )) ||
          (fieldComponent === 'TemplatedStringField' && (
            <>
              <TemplatedStringFieldEditor
                fieldName={fieldName}
                viewId={viewId}
                viewsetId={viewSetId}
              />
              <HiddenFieldEditor fieldName={fieldName} />
            </>
          )) || <BaseFieldEditor fieldName={fieldName} />}
      </AccordionDetails>
    </Accordion>
  );
};
