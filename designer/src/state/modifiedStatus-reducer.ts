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

import {createSlice} from '@reduxjs/toolkit';
import {initialState} from './initial';
import {propertyUpdated, rolesUpdated} from './metadata-reducer';
import {
  fieldAdded,
  fieldDeleted,
  fieldMoved,
  fieldRenamed,
  fieldUpdated,
  formVisibilityUpdated,
  sectionAdded,
  sectionConditionChanged,
  sectionDeleted,
  sectionMoved,
  sectionRenamed,
  viewSetAdded,
  viewSetDeleted,
  viewSetMoved,
  viewSetRenamed,
} from './uiSpec-reducer';

const modifiedStatusReducer = createSlice({
  name: 'modifiedStatus',
  initialState: initialState.modified,
  reducers: {
    resetFlag: (_state, action) => {
      const newStatus = action.payload as boolean;
      console.log('Reached modified reducer ' + newStatus);
      return newStatus;
    },
  },
  extraReducers: builder => {
    //Metadata reducers
    builder
      .addCase(propertyUpdated, () => {
        return true;
      })
      .addCase(rolesUpdated, () => {
        return true;
      })
      //UISpec reducers
      .addCase(fieldUpdated, () => {
        return true;
      })
      .addCase(fieldMoved, () => {
        return true;
      })
      .addCase(fieldRenamed, () => {
        return true;
      })
      .addCase(fieldAdded, () => {
        return true;
      })
      .addCase(fieldDeleted, () => {
        return true;
      })
      .addCase(sectionRenamed, () => {
        return true;
      })
      .addCase(sectionAdded, () => {
        return true;
      })
      .addCase(sectionDeleted, () => {
        return true;
      })
      .addCase(sectionMoved, () => {
        return true;
      })
      .addCase(sectionConditionChanged, () => {
        return true;
      })
      .addCase(viewSetAdded, () => {
        return true;
      })
      .addCase(viewSetDeleted, () => {
        return true;
      })
      .addCase(viewSetMoved, () => {
        return true;
      })
      .addCase(viewSetRenamed, () => {
        return true;
      })
      .addCase(formVisibilityUpdated, () => {
        return true;
      });
  },
});

export const {resetFlag} = modifiedStatusReducer.actions;

export default modifiedStatusReducer.reducer;
