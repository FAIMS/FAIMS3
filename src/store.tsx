import React, {createContext, useReducer, Dispatch} from 'react';
import {Observation, ObservationList, ProjectObject, ProjectsList} from './datamodel';
import {ProjectActions, ObservationActions, ActionType} from './actions';

interface InitialStateProps {
  project_list: ProjectsList;
  observation_list: {[project_id: string]: ObservationList};

  isLoadingProjectMeta: boolean;
  project_meta: ProjectsList;
  active_project: ProjectObject | null;
  active_observation: Observation | null;
}

const InitialState = {
  project_list: {},
  observation_list: {},

  isLoadingProjectMeta: false,
  project_meta: {},
  active_project: null,
  active_observation: null,
};

interface ContextType {
  state: InitialStateProps;
  dispatch: Dispatch<ProjectActions | ObservationActions>;
}

const store = createContext<ContextType>({
  state: InitialState,
  dispatch: () => null,
});

const {Provider} = store;

const StateProvider = (props: any) => {
  const [state, dispatch] = useReducer(
    (state: InitialStateProps, action: ProjectActions | ObservationActions) => {
      switch (action.type) {
        case ActionType.GET_PROJECT_LIST: {
          return {...state, project_list: action.payload};
        }
        case ActionType.GET_PROJECT: {
          return {...state, active_project: action.payload};
        }
        case ActionType.DROP_PROJECT: {
          return {...state, active_project: null};
        }
        case ActionType.GET_OBSERVATION_LIST: {
          return {
            ...state,
            observation_list: {
              ...state.observation_list,
              [action.payload.project_id]: action.payload.data,
            },
          };
          // return {...state, observation_list: action.payload};
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
