/*
 * Copyright 2021 Macquarie University
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
import {Observation, ProjectObject} from './datamodel';
import {
  ProjectActions,
  ObservationActions,
  SyncingActions,
  AlertActions,
  ActionType,
} from './actions';
import {Color} from '@material-ui/lab/Alert';
import LoadingApp from './gui/components/loadingApp';
import {initialize} from './sync';
import {v4 as uuidv4} from 'uuid';

interface InitialStateProps {
  initialized: boolean;
  isSyncing: boolean;

  active_project: ProjectObject | null;
  active_observation: Observation | null;
  alerts: Array<{message: string; severity: Color; key: string}>;
}

const InitialState = {
  initialized: false,
  isSyncing: false,

  active_project: null,
  active_observation: null,
  alerts: [],
};

interface ContextType {
  state: InitialStateProps;
  dispatch: Dispatch<
    ProjectActions | ObservationActions | SyncingActions | AlertActions
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
      action:
        | ProjectActions
        | ObservationActions
        | SyncingActions
        | AlertActions
    ) => {
      switch (action.type) {
        case ActionType.INITIALIZED: {
          return {
            ...state,
            initialized: true,
          };
        }
        case ActionType.IS_SYNCING: {
          return {
            ...state,
            isSyncing: action.payload,
          };
        }

        case ActionType.GET_ACTIVE_PROJECT: {
          return {...state, active_project: action.payload};
        }
        case ActionType.DROP_ACTIVE_PROJECT: {
          return {...state, active_project: null};
        }

        case ActionType.ADD_ALERT: {
          console.log('ADD ALERT', action.payload);
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

        // case ActionType.APPEND_OBSERVATION_LIST: {
        //   return {
        //     ...state,
        //     observation_list: {
        //       ...state.observation_list,
        //       [action.payload.project_id]: action.payload.data,
        //     },
        //   };
        //   // return {...state, observation_list: action.payload};
        // }
        // case ActionType.POP_OBSERVATION_LIST: {
        //   const new_observation_list = {
        //     ...state.observation_list[action.payload.project_id],
        //   };
        //   action.payload.data_ids.forEach(
        //     data_id => delete new_observation_list[data_id]
        //   );
        //   return {
        //     ...state,
        //     observation_list: {
        //       ...state.observation_list,
        //       [action.payload.project_id]: new_observation_list,
        //     },
        //   };
        // }
        default:
          throw new Error();
      }
    },
    InitialState
  );

  useEffect(() => {
    initialize()
      .then(() =>
        dispatch({
          type: ActionType.INITIALIZED,
          payload: undefined,
        })
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
