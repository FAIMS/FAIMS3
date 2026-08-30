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
 * @file The label a plan is authored with. `label` sits on the base plan
 * template schema rather than on any one plan type, so every plan dialog
 * authors it the same way.
 */

import {useEffect, useState} from 'react';
import {TextField} from '@mui/material';
import type {PlanTemplate} from '@faims3/data-model';
import {SimpleFieldWrapper} from '../Fields/SimpleFieldWrapper';

export type PlanLabelState = {
  /** What the author has typed, untrimmed. */
  value: string;
  setValue: (value: string) => void;
  /** The label to save, trimmed. */
  label: string;
  /** Whether another of the template's plans already carries this label. */
  isTaken: boolean;
  /** Whether the plan may be saved with this label. */
  canSave: boolean;
};

/** Holds the label a dialog is authoring, re-derived each time it opens. */
export const usePlanLabel = ({
  open,
  initialTemplate,
  takenLabels,
}: {
  open: boolean;
  initialTemplate?: PlanTemplate;
  takenLabels: string[];
}): PlanLabelState => {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!open) return;
    setValue(initialTemplate?.label ?? '');
  }, [open, initialTemplate]);

  const label = value.trim();
  const isTaken = takenLabels.includes(label);
  return {value, setValue, label, isTaken, canSave: Boolean(label) && !isTaken};
};

/** The label block of a plan dialog, over the state {@link usePlanLabel} holds. */
export const PlanLabelField = ({state}: {state: PlanLabelState}) => (
  <SimpleFieldWrapper
    heading="Label"
    helperText={
      state.isTaken
        ? 'Another plan already has this label. The chooser has only the label to tell them apart by.'
        : 'Names this plan where a notebook offers a choice of plan.'
    }
  >
    <TextField
      fullWidth
      value={state.value}
      error={state.isTaken}
      onChange={event => state.setValue(event.target.value)}
      sx={{mt: 0.85}}
      slotProps={{htmlInput: {'data-testid': 'plan-label'}}}
    />
  </SimpleFieldWrapper>
);
