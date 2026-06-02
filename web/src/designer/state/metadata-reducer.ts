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
 * @file Metadata partition slice: typed `information` fields and org `custom` key/value pairs.
 */

import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {
  initialState,
  type NotebookInformation,
  type NotebookMetadata,
} from './initial';

const metadataReducer = createSlice({
  name: 'metadata',
  initialState: initialState.notebook.metadata,
  reducers: {
    /** Replace metadata when hydrating the store from a notebook record. */
    loaded: (_state, action: PayloadAction<NotebookMetadata>) => {
      return action.payload;
    },
    /** Merge partial updates into `metadata.information`. */
    informationUpdated: (
      state,
      action: PayloadAction<Partial<NotebookInformation>>
    ) => {
      state.information = {...state.information, ...action.payload};
    },
    /** Set or update a single key in `metadata.custom`. */
    customFieldUpdated: (
      state,
      action: PayloadAction<{key: string; value: string}>
    ) => {
      const {key, value} = action.payload;
      if (!state.custom) {
        state.custom = {};
      }
      state.custom[key] = value;
    },
    /** Remove a key from `metadata.custom`. */
    customFieldRemoved: (state, action: PayloadAction<{key: string}>) => {
      if (!state.custom) {
        return;
      }
      delete state.custom[action.payload.key];
      if (Object.keys(state.custom).length === 0) {
        delete state.custom;
      }
    },
  },
});

export const {
  loaded,
  informationUpdated,
  customFieldUpdated,
  customFieldRemoved,
} = metadataReducer.actions;

export default metadataReducer.reducer;
