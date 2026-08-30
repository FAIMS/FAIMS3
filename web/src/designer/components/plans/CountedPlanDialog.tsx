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
 * @file Authoring dialog for a Counted plan template: name it and pick the
 * target form.
 */

import {useEffect, useState} from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  authoredSchema,
  COUNTED_PLAN_TYPE,
  countedPlanTemplateSchema,
} from '@faims3/data-model';
import {
  designerCancelButtonSx,
  designerDialogActionsSx,
  designerDialogContentSx,
  designerDialogTitleSx,
} from '../designer-style';
import {SimpleFieldWrapper} from '../Fields/SimpleFieldWrapper';
import type {PlanDialogProps} from '../../plans';

/** Pick the form a Counted plan counts; the count is instantiation-time config. */
export const CountedPlanDialog = ({
  open,
  uiSpec,
  initialTemplate,
  onClose,
  onSave,
}: PlanDialogProps) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const viewSets = uiSpec.viewsets;

  const [label, setLabel] = useState('');
  const [formType, setFormType] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  // Re-derive local state each time the dialog opens
  useEffect(() => {
    if (!open) return;
    setLabel(initialTemplate?.label ?? '');
    const initial = initialTemplate?.formType as string | undefined;
    if (initial && initial in viewSets) {
      setFormType(initial);
      setAlertMessage('');
    } else {
      setFormType('');
      setAlertMessage(
        initial
          ? 'The previously selected form no longer exists. Choose another.'
          : ''
      );
    }
  }, [open, initialTemplate, viewSets]);

  const handleSave = () => {
    const result = authoredSchema(countedPlanTemplateSchema).safeParse({
      planType: COUNTED_PLAN_TYPE,
      label: label.trim(),
      formType,
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
          Counted Plan
        </Typography>
      </DialogTitle>
      <DialogContent sx={{...designerDialogContentSx, pt: 4}}>
        <Box sx={{maxWidth: 740, width: '100%', mx: 'auto'}}>
          <SimpleFieldWrapper
            heading="Label"
            helperText="Names this plan where a notebook offers a choice of plan."
          >
            <TextField
              fullWidth
              value={label}
              onChange={event => setLabel(event.target.value)}
              sx={{mt: 0.85}}
              slotProps={{htmlInput: {'data-testid': 'plan-label'}}}
            />
          </SimpleFieldWrapper>

          <Box sx={{mt: 3}}>
            <SimpleFieldWrapper
              heading="Form"
              helperText={
                alertMessage ||
                'Records of this form count towards the plan. The number required is set when a notebook is created from this template.'
              }
            >
              <TextField
                select
                fullWidth
                value={formType}
                error={Boolean(alertMessage)}
                onChange={event => {
                  setAlertMessage('');
                  setFormType(event.target.value);
                }}
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
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={designerDialogActionsSx}>
        <Button onClick={onClose} sx={designerCancelButtonSx}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!formType || !label.trim()}
          onClick={handleSave}
        >
          Save Plan
        </Button>
      </DialogActions>
    </Dialog>
  );
};
