import type {AppState} from '../state/initial';

export const selectDesignerState = (state: AppState) => state;

export const selectNotebookState = (state: AppState) => state.notebook;

export const selectNotebookMetadata = (state: AppState) =>
  state.notebook.metadata;

export const selectNotebookHistory = (state: AppState) =>
  state.notebook['ui-specification'];

export const selectPresentUiSpec = (state: AppState) =>
  state.notebook['ui-specification'].present;

export const selectUiFields = (state: AppState) =>
  selectPresentUiSpec(state).fields;

export const selectUiViews = (state: AppState) =>
  selectPresentUiSpec(state).fviews;

export const selectUiViewSets = (state: AppState) =>
  selectPresentUiSpec(state).viewsets;

export const selectVisibleTypes = (state: AppState) =>
  selectPresentUiSpec(state).visible_types;

export const selectModifiedFlag = (state: AppState) => state.modified;
