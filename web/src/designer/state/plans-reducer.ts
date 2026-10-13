// SPDX-License-Identifier: Apache-2.0

/**
 * @file Read-only slice holding a notebook's instantiated plans.
 */

import {createSlice} from '@reduxjs/toolkit';
import {initialState} from './initial';

// The designer never edits an instantiated plan, it only carries them through
// so that saving a design does not drop them. Set via preloadedState on
// hydration.
const plansReducer = createSlice({
  name: 'plans',
  initialState: initialState.notebook.plans,
  reducers: {},
});

export default plansReducer.reducer;
