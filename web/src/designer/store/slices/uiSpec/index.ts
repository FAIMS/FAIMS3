// SPDX-License-Identifier: Apache-2.0

import {PayloadAction, createSlice} from '@reduxjs/toolkit';
import {NotebookUISpec, initialState} from '../../../state/initial';
import {fieldReducers} from './fieldReducers';
import {sectionReducers} from './sectionReducers';
import {viewSetReducers} from './viewSetReducers';

import type {NotebookSettings} from '../../../state/initial';

const uiSpecInitialState: NotebookUISpec = initialState.notebook.uiSpec.present;

/**
 * RTK slice for the present UI specification only. Wrapped with `redux-undo`
 * in `createDesignerStore` so `past`/`future` live outside this reducer.
 */
export const uiSpecificationReducer = createSlice({
  name: 'uiSpec',
  initialState: uiSpecInitialState,
  reducers: {
    /** Replace the entire present UI spec (e.g. after loading a notebook). */
    loaded: (_state, action: PayloadAction<NotebookUISpec>) => {
      // Immer draft is discarded; return replacement state for a full reset.
      return action.payload;
    },
    /** Merge partial updates into `uiSpec.settings`. */
    settingsUpdated: (
      state,
      action: PayloadAction<Partial<NotebookSettings>>
    ) => {
      state.settings = {...state.settings, ...action.payload};
    },
    ...fieldReducers,
    ...sectionReducers,
    ...viewSetReducers,
  },
});

export const {
  loaded,
  fieldUpdated,
  fieldMoved,
  fieldReordered,
  fieldMovedToSection,
  fieldRenamed,
  fieldAdded,
  fieldDeleted,
  fieldDuplicated,
  fieldConditionChanged,
  toggleFieldProtection,
  toggleFieldHidden,
  sectionRenamed,
  sectionAdded,
  sectionDuplicated,
  sectionDeleted,
  sectionMovedToForm,
  sectionMoved,
  sectionConditionChanged,
  viewSetAdded,
  viewSetDeleted,
  viewSetMoved,
  viewSetRenamed,
  formVisibilityUpdated,
  viewSetLayoutUpdated,
  viewSetSummaryFieldsUpdated,
  viewSetHridUpdated,
  viewSetDisplayInOverviewMapUpdated,
  settingsUpdated,
} = uiSpecificationReducer.actions;
