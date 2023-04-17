/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: store.tsx
 * Description:
 *   TODO
 */

import React, {createContext, useReducer, Dispatch, useEffect} from 'react';

import {v4 as uuidv4} from 'uuid';

import {ProjectObject} from 'faims3-datamodel';
import {Record} from 'faims3-datamodel';
import {getSyncStatusCallbacks} from '../utils/status';
import {
  ProjectActions,
  RecordActions,
  SyncingActions,
  AlertActions,
  ActionType,
} from './actions';
import LoadingApp from '../gui/components/loadingApp';
import {initialize} from '../sync/initialize';
import {set_sync_status_callbacks} from '../sync/connection';
import {AlertColor} from '@mui/material/Alert/Alert';

interface InitialStateProps {
  initialized: boolean;
  isSyncingUp: boolean;
  isSyncingDown: boolean;
  hasUnsyncedChanges: boolean;
  isSyncError: boolean;

  active_project: ProjectObject | null;
  active_record: Record | null;
  alerts: Array<
    {
      severity: AlertColor;
      key: string;
    } & ({message: string} | {element: JSX.Element[]})
  >;
}

const InitialState = {
  initialized: false,
  isSyncingUp: false,
  isSyncingDown: false,
  hasUnsyncedChanges: false,
  isSyncError: false,

  active_project: null,
  active_record: null,
  alerts: [],
};

export interface ContextType {
  state: InitialStateProps;
  dispatch: Dispatch<
    ProjectActions | RecordActions | SyncingActions | AlertActions
  >;
}

const store = createContext<ContextType>({
  state: InitialState,
  dispatch: () => null,
});

const {Provider} = store;

const StateProvider = (props: any) => {
  const [state, dispatch] = useReducer(
    (
      state: InitialStateProps,
      action: ProjectActions | RecordActions | SyncingActions | AlertActions
    ) => {
      switch (action.type) {
        case ActionType.INITIALIZED: {
          return {
            ...state,
            initialized: true,
          };
        }
        case ActionType.IS_SYNCING_UP: {
          return {
            ...state,
            isSyncingUp: action.payload,
          };
        }
        case ActionType.IS_SYNCING_DOWN: {
          return {
            ...state,
            isSyncingDown: action.payload,
          };
        }
        case ActionType.HAS_UNSYNCED_CHANGES: {
          return {
            ...state,
            hasUnsyncedChanges: action.payload,
          };
        }
        case ActionType.IS_SYNC_ERROR: {
          return {
            ...state,
            isSyncError: action.payload,
          };
        }
        case ActionType.GET_ACTIVE_PROJECT: {
          return {...state, active_project: action.payload};
        }
        case ActionType.DROP_ACTIVE_PROJECT: {
          return {...state, active_project: null};
        }

        case ActionType.ADD_ALERT: {
          const alert = {
            ...action.payload,
            key: uuidv4(),
            message: action.payload.message,
            severity: action.payload.severity,
          };
          return {
            ...state,
            alerts: [...state.alerts, alert],
          };
        }
        case ActionType.DELETE_ALERT: {
          return {
            ...state,
            alerts: state.alerts.filter(
              alert => alert.key !== action.payload.key
            ),
          };
        }
        case ActionType.ADD_CUSTOM_ALERT: {
          const alert = {
            ...action.payload,
            key: uuidv4(),
            element: action.payload.element,
            severity: action.payload.severity,
          };
          return {
            ...state,
            alerts: [...state.alerts, alert],
          };
        }

        // case ActionType.APPEND_RECORD_LIST: {
        //   return {
        //     ...state,
        //     record_list: {
        //       ...state.record_list,
        //       [action.payload.project_id]: action.payload.data,
        //     },
        //   };
        //   // return {...state, record_list: action.payload};
        // }
        // case ActionType.POP_RECORD_LIST: {
        //   const new_record_list = {
        //     ...state.record_list[action.payload.project_id],
        //   };
        //   action.payload.data_ids.forEach(
        //     data_id => delete new_record_list[data_id]
        //   );
        //   return {
        //     ...state,
        //     record_list: {
        //       ...state.record_list,
        //       [action.payload.project_id]: new_record_list,
        //     },
        //   };
        // }
        default:
          throw new Error();
      }
    },
    InitialState
  );

  set_sync_status_callbacks(getSyncStatusCallbacks(dispatch));

  useEffect(() => {
    initialize()
      .then(() =>
        setTimeout(
          () =>
            dispatch({
              type: ActionType.INITIALIZED,
              payload: undefined,
            }),
          10000
        )
      )
      .catch(err => {
        console.log('Could not initialize: ', err);
        dispatch({
          type: ActionType.ADD_ALERT,
          payload: {message: err.message, severity: 'error'},
        });
      });
  }, []);

  if (state.initialized) {
    return <Provider value={{state, dispatch}}>{props.children}</Provider>;
  } else {
    return (
      <Provider value={{state, dispatch}}>
        <LoadingApp />
      </Provider>
    );
  }
};

export {store, StateProvider};
