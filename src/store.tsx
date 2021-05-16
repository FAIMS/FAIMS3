import React, {createContext, useReducer, Dispatch} from 'react';
import {ProjectObject} from './datamodel';

interface InitialStateProps {
  project_list: Array<ProjectObject>;
}

type ActionProps = {
  type: 'SET_PROJECT_LIST';
  payload: Array<ProjectObject>;
};

const InitialState = {
  project_list: [],
};

interface ContextType {
  state: InitialStateProps;
  dispatch: Dispatch<ActionProps>;
}

const store = createContext<ContextType>({
  state: InitialState,
  dispatch: () => null,
});

const {Provider} = store;

const StateProvider = (props: any) => {
  const [state, dispatch] = useReducer(
    (state: InitialStateProps, action: ActionProps) => {
      switch (action.type) {
        case 'SET_PROJECT_LIST': {
          // console.log('GET_PROJECT_LIST reducer PAYLOAD', action.payload);
          return {...state, project_list: action.payload};
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
