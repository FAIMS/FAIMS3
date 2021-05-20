import React, {createContext, useReducer, Dispatch, useEffect} from 'react';
import {
  ActiveDoc,
  EncodedObservation,
  ObservationList,
  Observation,
  ProjectObject,
} from './datamodel';
import {
  ProjectActions,
  ObservationActions,
  SyncingActions,
  ActionType,
} from './actions';
import LoadingApp from './gui/components/loadingApp';
import {add_initial_listener, initialize} from './sync/index';
import {lookupFAIMSDataID} from './dataStorage';

interface InitialStateProps {
  initialized: boolean;
  isSyncing: boolean;

  active_project: ProjectObject | null;
  active_observation: Observation | null;
}

const InitialState = {
  initialized: false,
  isSyncing: false,

  active_project: null,
  active_observation: null,
};

interface ContextType {
  state: InitialStateProps;
  dispatch: Dispatch<ProjectActions | ObservationActions | SyncingActions>;
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
      action: ProjectActions | ObservationActions | SyncingActions
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

  add_initial_listener(initializeEvents => {
    const observations_update_listener = (
      active: ActiveDoc,
      data_db: PouchDB.Database<EncodedObservation>
    ) =>
      data_db
        .allDocs() // FIXME: include_docs here might be more efficient, but requires convertFromDBToForm be public
        .then(docs => {
          // To generate, from a data_db database, a list of observations,
          // this is what has to happen:
          // For each doc ID in the data's db, use lookupFAIMSDataID
          // Wait for all those lookups to return
          // Then dispatch the APPEND_OBSERVATION_LIST
          const data_acc: ObservationList = {};
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const promises = docs.rows.map(({id: doc_id}) =>
            lookupFAIMSDataID(active._id, doc_id).then(decoded =>
              decoded !== null
                ? (data_acc[doc_id] = decoded)
                : Promise.reject(
                    Error(
                      'lookupFAIMSDataID returned null even though doc is in local DB'
                    )
                  )
            )
          );
          // Promise.all(promises)
          //   .then(() =>
          //     // dispatch({
          //     //   type: ActionType.APPEND_OBSERVATION_LIST,
          //     //   payload: {
          //     //     project_id: active._id,
          //     //     data: data_acc,
          //     //   },
          //     // });
          //   )
          //   .catch(err => {
          //     //TODO
          //     console.error(err);
          //   });
        })
        .catch(err => {
          // TODO
          console.error(err);
        });

    initializeEvents.on(
      'project_local',
      (listing, active, project, meta_db, data_db) =>
        observations_update_listener(active, data_db.local)
    );

    initializeEvents.on(
      'project_data_paused',
      (listing, active, project, data_db) =>
        observations_update_listener(active, data_db.local)
    );
  }, 'store');

  useEffect(() => {
    initialize()
      .catch(err => {
        console.error(err);
      })
      .then(() =>
        dispatch({
          type: ActionType.INITIALIZED,
          payload: undefined,
        })
      );
  }, []);

  if (state.initialized) {
    return <Provider value={{state, dispatch}}>{props.children}</Provider>;
  } else {
    return <LoadingApp />;
  }
};

export {store, StateProvider};
