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
 * @file Memoisation-friendly root selectors for notebook slice and present UI spec.
 */

import type {AppState} from '../state/initial';

/** Root selector (identity); useful for typed hooks/tests. */
export const selectDesignerState = (state: AppState) => state;

/** Notebook slice: metadata + undoable `ui-specification`. */
export const selectNotebookState = (state: AppState) => state.notebook;

/** Notebook metadata object. */
export const selectNotebookMetadata = (state: AppState) =>
  state.notebook.metadata;

/** Full redux-undo wrapper `{ present, past, future }` for the UI spec. */
export const selectNotebookHistory = (state: AppState) =>
  state.notebook['ui-specification'];

/** Current editable UI specification (not historical states). */
export const selectPresentUiSpec = (state: AppState) =>
  state.notebook['ui-specification'].present;

/** Field id → field spec map. */
export const selectUiFields = (state: AppState) =>
  selectPresentUiSpec(state).fields;

/** Section id → section definition map (`fviews`). */
export const selectUiViews = (state: AppState) =>
  selectPresentUiSpec(state).fviews;

/** Form id → viewset map. */
export const selectUiViewSets = (state: AppState) =>
  selectPresentUiSpec(state).viewsets;

/** Tab order of form ids in the designer chrome. */
export const selectVisibleTypes = (state: AppState) =>
  selectPresentUiSpec(state).visible_types;

/** True after local edits until save/reset (see `modifiedStatus-reducer`). */
export const selectModifiedFlag = (state: AppState) => state.modified;
