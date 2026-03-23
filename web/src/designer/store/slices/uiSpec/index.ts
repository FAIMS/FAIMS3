import {PayloadAction, createSlice} from '@reduxjs/toolkit';
import {NotebookUISpec, initialState} from '../../../state/initial';
import {fieldReducers} from './fieldReducers';
import {sectionReducers} from './sectionReducers';
import {viewSetReducers} from './viewSetReducers';

const uiSpecInitialState: NotebookUISpec =
  initialState.notebook['ui-specification'].present;

export const uiSpecificationReducer = createSlice({
  name: 'ui-specification',
  initialState: uiSpecInitialState,
  reducers: {
    loaded: (_state, action: PayloadAction<NotebookUISpec>) => {
      _state = action.payload;
      return action.payload;
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
  viewSetPublishButtonBehaviourUpdated,
  viewSetLayoutUpdated,
  viewSetSummaryFieldsUpdated,
  viewSetHridUpdated,
} = uiSpecificationReducer.actions;
