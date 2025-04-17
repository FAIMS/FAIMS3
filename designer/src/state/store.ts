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

import {Middleware, combineReducers, configureStore} from '@reduxjs/toolkit';
import {ToolkitStore} from '@reduxjs/toolkit/dist/configureStore';
import {throttle} from 'lodash';
import undoable, {includeAction} from 'redux-undo';
import {AppState, NotebookWithHistory} from './initial';
import {loadState, saveState} from './localStorage';
import metadataReducer from './metadata-reducer';
import modifiedStatusReducer from './modifiedStatus-reducer';
import {uiSpecificationReducer} from './uiSpec-reducer';

const persistedState = loadState();
if (
  persistedState &&
  persistedState.notebook &&
  persistedState.notebook['ui-specification']
) {
  persistedState.notebook['ui-specification'].past = [];
  persistedState.notebook['ui-specification'].future = [];
}

const loggerMiddleware: Middleware<object, AppState> =
  storeAPI => next => action => {
    console.log('dispatching', action);
    next(action);
    console.log('next state', storeAPI.getState());
  };

export const store: ToolkitStore<AppState> = configureStore({
  reducer: {
    notebook: combineReducers<NotebookWithHistory>({
      metadata: metadataReducer,
      'ui-specification': undoable(uiSpecificationReducer.reducer, {
        // This needs to be sensible as ui specs can be large
        limit: 10,
        filter: includeAction([
          // Field actions
          'ui-specification/fieldAdded',
          'ui-specification/fieldDeleted',
          'ui-specification/fieldUpdated',
          'ui-specification/fieldDuplicated',
          'ui-specification/fieldMoved',
          'ui-specification/fieldMovedToSection',
          'ui-specification/fieldRenamed',
          'ui-specification/toggleFieldProtection',
          'ui-specification/toggleFieldHidden',

          // Section actions
          'ui-specification/sectionAdded',
          'ui-specification/sectionDeleted',
          'ui-specification/sectionRenamed',
          'ui-specification/sectionDuplicated',
          'ui-specification/sectionMovedToForm',
          'ui-specification/sectionMoved',

          // ViewSet actions
          'ui-specification/viewSetAdded',
          'ui-specification/viewSetDeleted',
          'ui-specification/viewSetRenamed',
          'ui-specification/viewSetMoved',
          'ui-specification/formVisibilityUpdated',
          'ui-specification/viewSetPublishButtonBehaviourUpdated',
          'ui-specification/viewSetLayoutUpdated',
          'ui-specification/viewSetSummaryFieldsUpdated',
          'ui-specification/viewSetHridUpdated',
        ]),
        clearHistoryType: 'CLEAR_HISTORY',
        initTypes: [],
      }),
    }),
    modified: modifiedStatusReducer,
  },
  preloadedState: persistedState,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware().concat(loggerMiddleware),
});

// Write to localStorage at most once per second
store.subscribe(
  throttle(() => {
    saveState(store.getState());
  }, 1000)
);

export type AppDispatch = typeof store.dispatch;
