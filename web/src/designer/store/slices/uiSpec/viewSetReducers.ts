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

import {PayloadAction} from '@reduxjs/toolkit';
import {NotebookUISpec} from '../../../state/initial';
import {slugify} from '../../../domain/notebook/ids';

/** Form (viewset) RTK reducers merged into `uiSpecificationReducer`. */
export const viewSetReducers = {
  /** Create form with slug id, empty `views`, append id to `visible_types`. */
  viewSetAdded: (
    state: NotebookUISpec,
    action: PayloadAction<{formName: string}>
  ) => {
    const {formName} = action.payload;
    const newViewSet = {
      label: formName,
      views: [],
    };
    const formID = slugify(formName);
    if (formID in state.viewsets) {
      throw new Error(`Form ${formID} already exists in notebook.`);
    } else {
      state.viewsets[formID] = newViewSet;
      state.visible_types.push(formID);
    }
  },

  /** Delete form, its sections, their fields, and remove from `visible_types`. */
  viewSetDeleted: (
    state: NotebookUISpec,
    action: PayloadAction<{viewSetId: string}>
  ) => {
    const {viewSetId} = action.payload;

    if (viewSetId in state.viewsets) {
      const viewSetViews: string[] = state.viewsets[viewSetId].views;
      viewSetViews.forEach(view => {
        if (view in state.fviews) {
          const viewFields: string[] = state.fviews[view].fields;
          viewFields.forEach(formField => {
            if (formField in state.fields) {
              delete state.fields[formField];
            }
          });
          delete state.fviews[view];
        }
      });
      delete state.viewsets[viewSetId];
      const newVisibleTypes = state.visible_types.filter(
        field => field !== viewSetId
      );
      state.visible_types = newVisibleTypes;
    }
  },
  /** Reorder `visible_types` (form tab order) left/right. */
  viewSetMoved: (
    state: NotebookUISpec,
    action: PayloadAction<{viewSetId: string; direction: 'left' | 'right'}>
  ) => {
    const {viewSetId, direction} = action.payload;

    const formsList = state.visible_types;
    for (let i = 0; i < formsList.length; i++) {
      if (formsList[i] === viewSetId) {
        if (direction === 'left') {
          if (i > 0) {
            const tmp = formsList[i - 1];
            formsList[i - 1] = formsList[i];
            formsList[i] = tmp;
          }
        } else {
          if (i < formsList.length - 1) {
            const tmp = formsList[i + 1];
            formsList[i + 1] = formsList[i];
            formsList[i] = tmp;
          }
        }
        break;
      }
    }
    state.visible_types = formsList;
  },
  /** Update display label only (id unchanged). */
  viewSetRenamed: (
    state: NotebookUISpec,
    action: PayloadAction<{viewSetId: string; label: string}>
  ) => {
    const {viewSetId, label} = action.payload;
    if (viewSetId in state.viewsets) {
      state.viewsets[viewSetId].label = label;
    }
  },
  /** Record list UI: which field ids appear in the form summary header. */
  viewSetSummaryFieldsUpdated: (
    state: NotebookUISpec,
    action: PayloadAction<{viewSetId: string; fields: string[]}>
  ) => {
    const {viewSetId, fields} = action.payload;
    if (viewSetId in state.viewsets) {
      state.viewsets[viewSetId].summary_fields = fields;
    }
  },
  /** Tabs vs inline layout for sections in this form. */
  viewSetLayoutUpdated: (
    state: NotebookUISpec,
    action: PayloadAction<{viewSetId: string; layout?: 'inline' | 'tabs'}>
  ) => {
    const {viewSetId, layout} = action.payload;
    if (viewSetId in state.viewsets) {
      state.viewsets[viewSetId].layout = layout;
    }
  },
  /** Human-readable record id source field for this form. */
  viewSetHridUpdated: (
    state: NotebookUISpec,
    action: PayloadAction<{viewSetId: string; hridField?: string}>
  ) => {
    const {viewSetId, hridField} = action.payload;
    if (viewSetId in state.viewsets) {
      state.viewsets[viewSetId].hridField = hridField;
    }
  },
  /** Add/remove form id from `visible_types` when user toggles form in notebook chrome. */
  formVisibilityUpdated: (
    state: NotebookUISpec,
    action: PayloadAction<{
      viewSetId: string;
      ticked: boolean;
      initialIndex: number;
    }>
  ) => {
    const {viewSetId, ticked} = action.payload;

    if (!ticked) {
      const newVisibleTypes = state.visible_types.filter(
        visibleType => visibleType !== viewSetId
      );
      state.visible_types = newVisibleTypes;
    } else if (!state.visible_types.includes(viewSetId)) {
      // insert if not already present
      state.visible_types.splice(state.visible_types.length, 0, viewSetId);
    }
  },
};
