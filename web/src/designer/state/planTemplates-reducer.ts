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
 * @file Plan template partition slice: the plan templates authored on a
 * template, in the order the app offers them in.
 */

import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import type {PlanTemplate} from '@faims3/data-model';

const planTemplatesReducer = createSlice({
  name: 'planTemplates',
  initialState: [] as PlanTemplate[],
  reducers: {
    /** Append a plan template authored in the designer UI. */
    planTemplateAdded: (state, action: PayloadAction<PlanTemplate>) => {
      state.push(action.payload);
    },
    /** Replace the plan template at an index, keeping its position. */
    planTemplateSet: (
      state,
      action: PayloadAction<{index: number; planTemplate: PlanTemplate}>
    ) => {
      const {index, planTemplate} = action.payload;
      if (index in state) state[index] = planTemplate;
    },
    /** Rename the plan template at an index; a blank label clears it. */
    planTemplateLabelled: (
      state,
      action: PayloadAction<{index: number; label: string}>
    ) => {
      const {index, label} = action.payload;
      const planTemplate = state[index];
      if (!planTemplate) return;
      if (label) planTemplate.label = label;
      else delete planTemplate.label;
    },
    /** Remove the plan template at an index. */
    planTemplateRemoved: (state, action: PayloadAction<number>) => {
      state.splice(action.payload, 1);
    },
    /**
     * Move a plan template one place up or down. The array order is the order
     * the app's plan chooser offers the plans in, so this is how a template
     * author sets that order.
     */
    planTemplateMoved: (
      state,
      action: PayloadAction<{index: number; delta: number}>
    ) => {
      const {index, delta} = action.payload;
      const to = index + delta;
      if (!(index in state) || !(to in state)) return;
      const [moved] = state.splice(index, 1);
      state.splice(to, 0, moved);
    },
  },
});

export const {
  planTemplateAdded,
  planTemplateSet,
  planTemplateLabelled,
  planTemplateRemoved,
  planTemplateMoved,
} = planTemplatesReducer.actions;

export default planTemplatesReducer.reducer;
