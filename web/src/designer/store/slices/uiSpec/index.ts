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

import {PayloadAction, createSlice} from '@reduxjs/toolkit';
import {NotebookUISpec, initialState} from '../../../state/initial';
import {fieldReducers} from './fieldReducers';
import {sectionReducers} from './sectionReducers';
import {viewSetReducers} from './viewSetReducers';

const uiSpecInitialState: NotebookUISpec =
  initialState.notebook['ui-specification'].present;

/**
 * RTK slice for the present UI specification only. Wrapped with `redux-undo`
 * in `createDesignerStore` so `past`/`future` live outside this reducer.
 */
export const uiSpecificationReducer = createSlice({
  name: 'ui-specification',
  initialState: uiSpecInitialState,
  reducers: {
    /** Replace the entire present UI spec (e.g. after loading a notebook). */
    loaded: (_state, action: PayloadAction<NotebookUISpec>) => {
      // Immer draft is discarded; return replacement state for a full reset.
      return action.payload;
    },
    ...fieldReducers,
    ...sectionReducers,
    ...viewSetReducers,
  },
});

export const {
  loaded,
  fieldUpdated,
  fieldMoved,
  fieldMovedToSection,
  fieldRenamed,
  fieldAdded,
  fieldDeleted,
  fieldDuplicated,
  fieldConditionChanged,
  toggleFieldProtection,
  toggleFieldHidden,
  sectionRenamed,
  sectionAdded,
  sectionDuplicated,
  sectionDeleted,
  sectionMovedToForm,
  sectionMoved,
  sectionConditionChanged,
  viewSetAdded,
  viewSetDeleted,
  viewSetMoved,
  viewSetRenamed,
  formVisibilityUpdated,
  viewSetPublishButtonBehaviourUpdated,
  viewSetLayoutUpdated,
  viewSetSummaryFieldsUpdated,
  viewSetHridUpdated,
} = uiSpecificationReducer.actions;
