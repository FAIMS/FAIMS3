import {PayloadAction} from '@reduxjs/toolkit';
import {NotebookUISpec} from '../../../state/initial';
import {slugify} from '../../../state/helpers/uiSpec-helpers';

export const viewSetReducers = {
  viewSetAdded: (
    state: NotebookUISpec,
    action: PayloadAction<{formName: string}>
  ) => {
    const {formName} = action.payload;
    const newViewSet = {
      label: formName,
      views: [],
      publishButtonBehaviour: 'always' as 'always' | 'visited' | 'noErrors',
    };
    const formID = slugify(formName);
    if (formID in state.viewsets) {
      throw new Error(`Form ${formID} already exists in notebook.`);
    } else {
      state.viewsets[formID] = newViewSet;
      state.visible_types.push(formID);
    }
  },

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
  viewSetRenamed: (
    state: NotebookUISpec,
    action: PayloadAction<{viewSetId: string; label: string}>
  ) => {
    const {viewSetId, label} = action.payload;
    if (viewSetId in state.viewsets) {
      state.viewsets[viewSetId].label = label;
    }
  },
  viewSetSummaryFieldsUpdated: (
    state: NotebookUISpec,
    action: PayloadAction<{viewSetId: string; fields: string[]}>
  ) => {
    const {viewSetId, fields} = action.payload;
    if (viewSetId in state.viewsets) {
      state.viewsets[viewSetId].summary_fields = fields;
    }
  },
  viewSetLayoutUpdated: (
    state: NotebookUISpec,
    action: PayloadAction<{viewSetId: string; layout?: 'inline' | 'tabs'}>
  ) => {
    const {viewSetId, layout} = action.payload;
    if (viewSetId in state.viewsets) {
      state.viewsets[viewSetId].layout = layout;
    }
  },
  viewSetHridUpdated: (
    state: NotebookUISpec,
    action: PayloadAction<{viewSetId: string; hridField?: string}>
  ) => {
    const {viewSetId, hridField} = action.payload;
    if (viewSetId in state.viewsets) {
      state.viewsets[viewSetId].hridField = hridField;
    }
  },
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
    } else {
      state.visible_types.splice(state.visible_types.length, 0, viewSetId);
    }
  },
  viewSetPublishButtonBehaviourUpdated: (
    state: NotebookUISpec,
    action: PayloadAction<{
      viewSetId: string;
      publishButtonBehaviour: 'always' | 'visited' | 'noErrors';
    }>
  ) => {
    const {viewSetId, publishButtonBehaviour} = action.payload;
    if (viewSetId in state.viewsets) {
      state.viewsets[viewSetId].publishButtonBehaviour = publishButtonBehaviour;
    }
  },
};
