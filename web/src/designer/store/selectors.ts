// SPDX-License-Identifier: Apache-2.0

/**
 * @file Memoisation-friendly root selectors for notebook slice and present UI spec.
 */

import type {AppState} from '../state/initial';

/** Root selector (identity); useful for typed hooks/tests. */
export const selectDesignerState = (state: AppState) => state;

/** Notebook slice: metadata + undoable `uiSpec`. */
export const selectNotebookState = (state: AppState) => state.notebook;

/** Notebook metadata object. */
export const selectNotebookMetadata = (state: AppState) =>
  state.notebook.metadata;

/** Full redux-undo wrapper `{ present, past, future }` for the UI spec. */
export const selectNotebookHistory = (state: AppState) => state.notebook.uiSpec;

/** Current editable UI specification (not historical states). */
export const selectPresentUiSpec = (state: AppState) =>
  state.notebook.uiSpec.present;

/** Field id → field spec map. */
export const selectUiFields = (state: AppState) =>
  selectPresentUiSpec(state).fields;

/** Section id → section definition map (`views`). */
export const selectUiViews = (state: AppState) =>
  selectPresentUiSpec(state).views;

const EMPTY_CUSTOM_METADATA: Record<string, string> = {};

/** Custom metadata key/value pairs; a stable empty object when none are set. */
export const selectCustomMetadata = (state: AppState) =>
  state.notebook.metadata.custom ?? EMPTY_CUSTOM_METADATA;

/** Form id → viewset map. */
export const selectUiViewSets = (state: AppState) =>
  selectPresentUiSpec(state).viewsets;

/** Tab order of form ids in the designer chrome. */
export const selectVisibleTypes = (state: AppState) =>
  selectPresentUiSpec(state).visible_types;

/** True after local edits until save/reset (see `modifiedStatus-reducer`). */
export const selectModifiedFlag = (state: AppState) => state.modified;

/** Whether this designer session edits a notebook or a template. */
export const selectDesignerMode = (state: AppState) => state.mode;
