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
 * @file Authoring dialog for a List of Forms plan template: name it and pick
 * the forms it presents.
 */

import {useEffect, useState} from 'react';
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
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  authoredSchema,
  LIST_OF_FORMS_PLAN_TYPE,
  listOfFormsPlanTemplateSchema,
} from '@faims3/data-model';
import {PlanFields, usePlanFields} from './PlanFields';
import {
  designerCancelButtonSx,
  designerDialogActionsSx,
  designerDialogContentSx,
  designerDialogTitleSx,
} from '../designer-style';
import {SimpleFieldWrapper} from '../Fields/SimpleFieldWrapper';
import type {PlanDialogProps} from '../../plans';

// The same value every save, so it is built once rather than per save
const authoredListOfFormsPlanTemplateSchema = authoredSchema(
  listOfFormsPlanTemplateSchema
);

/** Pick the forms a List of Forms plan presents; nothing is configured per notebook. */
export const ListOfFormsPlanDialog = ({
  open,
  uiSpec,
  initialTemplate,
  takenLabels,
  onClose,
  onSave,
}: PlanDialogProps) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const viewSets = uiSpec.viewsets;

  const planFields = usePlanFields({open, initialTemplate, takenLabels});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [alertMessage, setAlertMessage] = useState('');

  // Re-derive local state each time the dialog opens
  useEffect(() => {
    if (!open) return;
    const initial = (initialTemplate?.formTypes as string[] | undefined) ?? [];
    const existing = initial.filter(id => id in viewSets);
    setSelected(new Set(existing));
    setAlertMessage(
      existing.length < initial.length
        ? 'A previously selected form no longer exists and has been dropped.'
        : ''
    );
  }, [open, initialTemplate, viewSets]);

  const toggle = (id: string) => {
    setAlertMessage('');
    setSelected(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Presented in the order the template declares its forms
  const formTypes = Object.keys(viewSets).filter(id => selected.has(id));

  const handleSave = () => {
    const result = authoredListOfFormsPlanTemplateSchema.safeParse({
      planType: LIST_OF_FORMS_PLAN_TYPE,
      ...planFields.authored,
      formTypes,
    });
    if (!result.success) {
      setAlertMessage('Please choose at least one form for this plan.');
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
          List of Forms Plan
        </Typography>
      </DialogTitle>
      <DialogContent sx={{...designerDialogContentSx, pt: 4}}>
        <Box sx={{maxWidth: 740, width: '100%', mx: 'auto'}}>
          <PlanFields state={planFields} />

          <Box sx={{mt: 3}}>
            <SimpleFieldWrapper
              heading="Forms"
              helperText={
                alertMessage ||
                'The plan presents these forms for creating and browsing records, in the order they appear here.'
              }
            >
              <FormGroup sx={{mt: 0.85}}>
                {Object.entries(viewSets).map(([id, viewSet]) =>
                  viewSet ? (
                    <FormControlLabel
                      key={id}
                      label={viewSet.label}
                      control={
                        <Checkbox
                          checked={selected.has(id)}
                          onChange={() => toggle(id)}
                        />
                      }
                    />
                  ) : null
                )}
              </FormGroup>
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
          disabled={formTypes.length === 0 || !planFields.canSave}
          onClick={handleSave}
        >
          Save Plan
        </Button>
      </DialogActions>
    </Dialog>
  );
};
