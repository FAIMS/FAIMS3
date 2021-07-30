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

import {createContext, useReducer, Dispatch} from 'react';
import {AlertActions, ActionType} from './actions';
import {Color} from '@material-ui/lab/Alert';
import {v4 as uuidv4} from 'uuid';

interface InitialStateProps {
  alerts: Array<{message: string; severity: Color; key: string}>;
}

const InitialState = {
  alerts: [],
};

interface ContextType {
  state: InitialStateProps;
  dispatch: Dispatch<AlertActions>;
}

const store = createContext<ContextType>({
  state: InitialState,
  dispatch: () => null,
});

const {Provider} = store;

const StateProvider = (props: any) => {
  const [state, dispatch] = useReducer(
    (state: InitialStateProps, action: AlertActions) => {
      switch (action.type) {
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
        default:
          throw new Error();
      }
    },
    InitialState
  );
  return <Provider value={{state, dispatch}}>{props.children}</Provider>;
};

export {store, StateProvider};
