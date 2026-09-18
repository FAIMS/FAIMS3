// SPDX-License-Identifier: Apache-2.0

/**
 * @file Factory for the designer Redux store (metadata + undoable UI spec + modified flag).
 */

import {configureStore, combineReducers, Middleware} from '@reduxjs/toolkit';
import undoable from 'redux-undo';
import {
  AppState,
  DesignerDocumentMode,
  NotebookWithHistory,
  initialState as blankState,
} from './state/initial';
import metadataReducer from './state/metadata-reducer';
import plansReducer from './state/plans-reducer';
import planTemplatesReducer from './state/planTemplates-reducer';
import modifiedStatusReducer from './state/modifiedStatus-reducer';
import modeReducer from './state/mode-reducer';
import {uiSpecificationReducer} from './store/slices/uiSpec';
import {uiSpecUndoConfig} from './store/undoConfig';

/**
 * Builds the designer Redux store: notebook slice (metadata + undoable UI spec)
 * plus a simple `modified` flag slice.
 */
export function createDesignerStore(
  notebook?: NotebookWithHistory,
  debug = false,
  mode: DesignerDocumentMode = 'project'
) {
  const logger: Middleware<object, AppState> = () => next => action => {
    if (debug) console.log('[designer]', action);
    return next(action);
  };

  return configureStore({
    preloadedState: notebook
      ? ({...blankState, notebook, mode} as AppState)
      : ({...blankState, mode} as AppState),
    reducer: {
      notebook: combineReducers<NotebookWithHistory>({
        metadata: metadataReducer,
        uiSpec: undoable(uiSpecificationReducer.reducer, uiSpecUndoConfig),
        planTemplates: planTemplatesReducer,
        plans: plansReducer,
      }),
      modified: modifiedStatusReducer,
      mode: modeReducer,
    },
    middleware: g => g().concat(logger),
  });
}

/** Dispatch type for the store instance from {@link createDesignerStore}. */
export type DesignerDispatch = ReturnType<
  typeof createDesignerStore
>['dispatch'];
