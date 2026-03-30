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
 * @file Factory for the designer Redux store (metadata + undoable UI spec + modified flag).
 */

import {configureStore, combineReducers, Middleware} from '@reduxjs/toolkit';
import undoable from 'redux-undo';
import {
  AppState,
  NotebookWithHistory,
  initialState as blankState,
} from './state/initial';
import metadataReducer from './state/metadata-reducer';
import modifiedStatusReducer from './state/modifiedStatus-reducer';
import {uiSpecificationReducer} from './store/slices/uiSpec';
import {uiSpecUndoConfig} from './store/undoConfig';

/**
 * Builds the designer Redux store: notebook slice (metadata + undoable UI spec)
 * plus a simple `modified` flag slice.
 *
 * @param notebook - Optional hydrated notebook; defaults to blank initial state.
 * @param debug - When true, logs every action to the console.
 * @returns Configured store instance.
 */
export function createDesignerStore(
  notebook?: NotebookWithHistory,
  debug = false
) {
  const logger: Middleware<object, AppState> = () => next => action => {
    if (debug) console.log('[designer]', action);
    return next(action);
  };

  return configureStore({
    preloadedState: notebook
      ? ({...blankState, notebook} as AppState)
      : undefined,
    reducer: {
      notebook: combineReducers<NotebookWithHistory>({
        metadata: metadataReducer,
        'ui-specification': undoable(
          uiSpecificationReducer.reducer,
          uiSpecUndoConfig
        ),
      }),
      modified: modifiedStatusReducer,
    },
    middleware: g => g().concat(logger),
  });
}

/** Dispatch type for the store instance from {@link createDesignerStore}. */
export type DesignerDispatch = ReturnType<
  typeof createDesignerStore
>['dispatch'];
