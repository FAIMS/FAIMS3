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
 * @file Tracks whether the notebook has unsaved edits. Set `true` by metadata/UI-spec actions;
 * reset via {@link resetFlag} after save.
 */

import {createSlice} from '@reduxjs/toolkit';
import {initialState} from './initial';
import {
  customFieldRemoved,
  customFieldUpdated,
  informationUpdated,
} from './metadata-reducer';
import {
  fieldAdded,
  fieldDeleted,
  fieldMoved,
  fieldReordered,
  fieldRenamed,
  fieldUpdated,
  formVisibilityUpdated,
  sectionAdded,
  sectionConditionChanged,
  sectionDeleted,
  sectionMoved,
  sectionRenamed,
  settingsUpdated,
  viewSetAdded,
  viewSetDeleted,
  viewSetMoved,
  viewSetRenamed,
} from '../store/slices/uiSpec';

const modifiedStatusReducer = createSlice({
  name: 'modifiedStatus',
  initialState: initialState.modified,
  reducers: {
    /** Set dirty flag explicitly (typically `false` after persisting). */
    resetFlag: (_state, action) => {
      const newStatus = action.payload as boolean;
      return newStatus;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(informationUpdated, () => true)
      .addCase(customFieldUpdated, () => true)
      .addCase(customFieldRemoved, () => true)
      .addCase(settingsUpdated, () => true)
      .addCase(fieldUpdated, () => true)
      .addCase(fieldMoved, () => true)
      .addCase(fieldReordered, () => true)
      .addCase(fieldRenamed, () => true)
      .addCase(fieldAdded, () => true)
      .addCase(fieldDeleted, () => true)
      .addCase(sectionRenamed, () => true)
      .addCase(sectionAdded, () => true)
      .addCase(sectionDeleted, () => true)
      .addCase(sectionMoved, () => true)
      .addCase(sectionConditionChanged, () => true)
      .addCase(viewSetAdded, () => true)
      .addCase(viewSetDeleted, () => true)
      .addCase(viewSetMoved, () => true)
      .addCase(viewSetRenamed, () => true)
      .addCase(formVisibilityUpdated, () => true);
  },
});

export const {resetFlag} = modifiedStatusReducer.actions;

export default modifiedStatusReducer.reducer;
