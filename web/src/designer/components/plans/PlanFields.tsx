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
 * @file The fields every plan is authored with. `label` and `description` sit
 * on the base plan template schema rather than on any one plan type, so every
 * plan dialog authors them the same way.
 */

import {useEffect, useState} from 'react';
import {Box, TextField} from '@mui/material';
import {planLabelKey, type PlanTemplate} from '@faims3/data-model';
import {SimpleFieldWrapper} from '../Fields/SimpleFieldWrapper';

export type PlanFieldsState = {
  /** The label as the author has typed it, untrimmed. */
  labelValue: string;
  setLabelValue: (value: string) => void;
  /** The description as the author has typed it, untrimmed. */
  descriptionValue: string;
  setDescriptionValue: (value: string) => void;
  /** Whether another of the template's plans already carries this label. */
  isLabelTaken: boolean;
  /** Whether the plan may be saved with these values. */
  canSave: boolean;
  /** What a dialog saves, trimmed, with a blank description left off. */
  authored: {label: string; description?: string};
};

/** Holds the base fields a dialog is authoring, re-derived each time it opens. */
export const usePlanFields = ({
  open,
  initialTemplate,
  takenLabels,
}: {
  open: boolean;
  initialTemplate?: PlanTemplate;
  takenLabels: string[];
}): PlanFieldsState => {
  const [labelValue, setLabelValue] = useState('');
  const [descriptionValue, setDescriptionValue] = useState('');

  useEffect(() => {
    if (!open) return;
    setLabelValue(initialTemplate?.label ?? '');
    setDescriptionValue(initialTemplate?.description ?? '');
  }, [open, initialTemplate]);

  // Compared as the api compares before refusing the save, so the designer and
  // the api agree on what counts as the same label
  const label = planLabelKey(labelValue);
  const description = descriptionValue.trim();
  const isLabelTaken = takenLabels.some(taken => planLabelKey(taken) === label);
  return {
    labelValue,
    setLabelValue,
    descriptionValue,
    setDescriptionValue,
    isLabelTaken,
    canSave: Boolean(label) && !isLabelTaken,
    // The schema refuses an empty description, so a blank one is left off
    authored: description ? {label, description} : {label},
  };
};

/** The base fields of a plan dialog, over the state {@link usePlanFields} holds. */
export const PlanFields = ({state}: {state: PlanFieldsState}) => (
  <>
    <SimpleFieldWrapper
      heading="Label"
      helperText={
        state.isLabelTaken
          ? 'Another plan already has this label. The chooser has only the label to tell them apart by.'
          : 'Names this plan where a notebook offers a choice of plan.'
      }
    >
      <TextField
        fullWidth
        value={state.labelValue}
        error={state.isLabelTaken}
        onChange={event => state.setLabelValue(event.target.value)}
        sx={{mt: 0.85}}
        slotProps={{htmlInput: {'data-testid': 'plan-label'}}}
      />
    </SimpleFieldWrapper>

    <Box sx={{mt: 3}}>
      <SimpleFieldWrapper
        heading="Description"
        helperText="Says what following this plan involves, under its label on the chooser. Optional."
      >
        <TextField
          fullWidth
          multiline
          minRows={2}
          value={state.descriptionValue}
          onChange={event => state.setDescriptionValue(event.target.value)}
          sx={{mt: 0.85}}
          slotProps={{htmlInput: {'data-testid': 'plan-description'}}}
        />
      </SimpleFieldWrapper>
    </Box>
  </>
);
