import {configureStore, combineReducers, Middleware} from '@reduxjs/toolkit';
import undoable, {includeAction} from 'redux-undo';
import {
  AppState,
  NotebookWithHistory,
  initialState as blankState,
} from './state/initial';
import metadataReducer from './state/metadata-reducer';
import modifiedStatusReducer from './state/modifiedStatus-reducer';
import {uiSpecificationReducer} from './state/uiSpec-reducer';

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
        'ui-specification': undoable(uiSpecificationReducer.reducer, {
          limit: 10,
          filter: includeAction(/^ui-specification\//),
          clearHistoryType: 'CLEAR_HISTORY',
          initTypes: [],
        }),
      }),
      modified: modifiedStatusReducer,
    },
    middleware: g => g().concat(logger),
  });
}

export type DesignerDispatch = ReturnType<
  typeof createDesignerStore
>['dispatch'];
