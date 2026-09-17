// SPDX-License-Identifier: Apache-2.0

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
