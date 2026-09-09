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
 * @file Plan template partition slice: optional planTemplate authored on templates.
 */

import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import type {PlanTemplate} from '@faims3/data-model';

// null means no plan template; combineReducers cannot store undefined
type PlanTemplateState = PlanTemplate | null;

const planTemplateReducer = createSlice({
  name: 'planTemplate',
  initialState: null as PlanTemplateState,
  reducers: {
    /** Set or replace the plan template from the designer UI. */
    planTemplateSet: (_state, action: PayloadAction<PlanTemplate>) =>
      action.payload,
    /** Remove the plan template. */
    planTemplateRemoved: () => null,
  },
});

export const {planTemplateSet, planTemplateRemoved} =
  planTemplateReducer.actions;

export default planTemplateReducer.reducer;
