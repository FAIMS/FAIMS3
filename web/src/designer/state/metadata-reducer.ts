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
 * @file Metadata slice: notebook title, descriptions, access roles, and ad-hoc properties.
 * `propertyUpdated` rejects writes to keys in `protectedFields`.
 */

import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {initialState, NotebookMetadata} from './initial';

/** Keys managed by the platform or notebook structure — not editable via `propertyUpdated`. */
const protectedFields = [
  'meta',
  'access',
  'accesses',
  'forms',
  'filenames',
  'ispublic',
  'isrequest',
  'sections',
];

const metadataReducer = createSlice({
  name: 'metadata',
  initialState: initialState.notebook.metadata,
  reducers: {
    /** Replace metadata when hydrating the store from a notebook record. */
    loaded: (_state, action: PayloadAction<NotebookMetadata>) => {
      return action.payload;
    },
    /** Set a single string property; throws if `property` is protected. */
    propertyUpdated: (
      state,
      action: PayloadAction<{property: string; value: string}>
    ) => {
      const {property, value} = action.payload;
      if (protectedFields.includes(property)) {
        throw new Error(
          `Cannot update protected metadata field ${property} via propertyUpdated action`
        );
      } else {
        state[property] = value;
      }
    },
    /** Overwrite `accesses` from role picker UI. */
    rolesUpdated: (state, action: PayloadAction<{roles: string[]}>) => {
      const {roles} = action.payload;
      state.accesses = roles;
    },
  },
});

export const {loaded, propertyUpdated, rolesUpdated} = metadataReducer.actions;

export default metadataReducer.reducer;
