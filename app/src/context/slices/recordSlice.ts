/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 *  * Description:
 *  Redux slice for state of the currently edited record form
 */

import {createSlice, PayloadAction} from '@reduxjs/toolkit';

// Simple state of the record form
//   - has it been edited (is there a current draft)?
//   - what percentage complete is the form?
export interface RecordState {
  edited: boolean;
  percent: number;
}

const initialRecordState: RecordState = {
  edited: false,
  percent: 0,
};

const recordSlice = createSlice({
  name: 'records',
  initialState: initialRecordState,
  reducers: {
    setEdited: (state, action: PayloadAction<{edited: boolean}>) => {
      state.edited = action.payload.edited;
    },
    setPercent: (state, action: PayloadAction<{percent: number}>) => {
      state.percent = action.payload.percent;
    },
  },
});

export const {setEdited, setPercent} = recordSlice.actions;
export default recordSlice.reducer;
