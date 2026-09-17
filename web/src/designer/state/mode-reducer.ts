// SPDX-License-Identifier: Apache-2.0

/**
 * @file Read-only slice recording whether the designer is editing a notebook or a template.
 */

import {createSlice} from '@reduxjs/toolkit';
import {initialState} from './initial';

// Set once via preloadedState in createDesignerStore; never changes mid-session
const modeReducer = createSlice({
  name: 'mode',
  initialState: initialState.mode,
  reducers: {},
});

export default modeReducer.reducer;
