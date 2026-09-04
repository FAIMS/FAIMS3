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
