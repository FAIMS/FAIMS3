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
 * @file Authoring dialog for a List of Records plan template: pick the target
 * form and the subset of its fields the record list pre-fills.
 */

import {useEffect, useMemo, useState} from 'react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  MenuItem,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  LIST_OF_RECORDS_PLAN_TYPE,
  listPlanTemplateSchema,
} from '@faims3/data-model';
import {
  designerCancelButtonSx,
  designerDialogActionsSx,
  designerDialogContentSx,
  designerDialogTitleSx,
} from '../designer-style';
import {SimpleFieldWrapper} from '../Fields/SimpleFieldWrapper';
import type {PlanDialogProps} from '../../plans';

/** Pick the form and pre-filled fields for a List of Records plan. */
export const ListOfRecordsPlanDialog = ({
  open,
  uiSpec,
  initialTemplate,
  onClose,
  onSave,
}: PlanDialogProps) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const viewSets = uiSpec.viewsets;

  const [formType, setFormType] = useState('');
  const [recordFields, setRecordFields] = useState<string[]>([]);
  const [alertMessage, setAlertMessage] = useState('');

  // Fields belonging to the chosen form, across all its sections
  const formFields = useMemo(() => {
    if (!formType || !(formType in viewSets)) return [];
    return (viewSets[formType]?.views ?? []).flatMap(
      viewId => uiSpec.views[viewId]?.fields ?? []
    );
  }, [formType, uiSpec]);

  // Re-derive local state each time the dialog opens
  useEffect(() => {
    if (!open) return;
    const initial = initialTemplate?.formType as string | undefined;
    if (initial && initial in viewSets) {
      setFormType(initial);
      setRecordFields((initialTemplate?.recordFields as string[]) ?? []);
      setAlertMessage('');
    } else {
      setFormType('');
      setRecordFields([]);
      setAlertMessage(
        initial
          ? 'The previously selected form no longer exists. Choose another.'
          : ''
      );
    }
  }, [open, initialTemplate, viewSets]);

  const fieldLabel = (fieldName: string): string => {
    const label = uiSpec.fields[fieldName]?.['component-parameters']?.label;
    return typeof label === 'string' && label ? label : fieldName;
  };

  const toggleField = (fieldName: string) => {
    setRecordFields(current =>
      current.includes(fieldName)
        ? current.filter(f => f !== fieldName)
        : [...current, fieldName]
    );
  };

  const handleFormChange = (newFormType: string) => {
    setAlertMessage('');
    setFormType(newFormType);
    // Field subset belongs to a form; changing form resets it
    setRecordFields([]);
  };

  const handleSave = () => {
    const result = listPlanTemplateSchema.safeParse({
      planType: LIST_OF_RECORDS_PLAN_TYPE,
      formType,
      recordFields,
    });
    if (!result.success) {
      setAlertMessage('Please choose a form for this plan.');
      return;
    }
    onSave(result.data);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={fullScreen}
    >
      <DialogTitle sx={designerDialogTitleSx}>
        <Typography variant="h6" component="span" sx={{fontWeight: 800}}>
          List of Records Plan
        </Typography>
      </DialogTitle>
      <DialogContent sx={{...designerDialogContentSx, pt: 4}}>
        <Box sx={{maxWidth: 740, width: '100%', mx: 'auto'}}>
          <SimpleFieldWrapper
            heading="Form"
            helperText={
              alertMessage ||
              'Records of this form are created from the planned list. The list itself is supplied when a notebook is created from this template.'
            }
          >
            <TextField
              select
              fullWidth
              value={formType}
              error={Boolean(alertMessage)}
              onChange={event => handleFormChange(event.target.value)}
              sx={{mt: 0.85}}
            >
              {Object.entries(viewSets).map(([id, viewSet]) =>
                viewSet ? (
                  <MenuItem key={id} value={id}>
                    {viewSet.label}
                  </MenuItem>
                ) : null
              )}
            </TextField>
          </SimpleFieldWrapper>

          {formType && (
            <Box sx={{mt: 3}}>
              <SimpleFieldWrapper
                heading="Pre-filled fields"
                helperText="Fields of the form that each planned record supplies values for."
              >
                <FormGroup sx={{mt: 0.85}}>
                  {formFields.map(fieldName => (
                    <FormControlLabel
                      key={fieldName}
                      control={
                        <Checkbox
                          checked={recordFields.includes(fieldName)}
                          onChange={() => toggleField(fieldName)}
                        />
                      }
                      label={fieldLabel(fieldName)}
                    />
                  ))}
                  {formFields.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      This form has no fields yet.
                    </Typography>
                  )}
                </FormGroup>
              </SimpleFieldWrapper>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={designerDialogActionsSx}>
        <Button onClick={onClose} sx={designerCancelButtonSx}>
          Cancel
        </Button>
        <Button variant="contained" disabled={!formType} onClick={handleSave}>
          Save Plan
        </Button>
      </DialogActions>
    </Dialog>
  );
};
