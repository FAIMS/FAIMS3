import {ProjectObject, Observation} from './datamodel';
import {Color} from '@material-ui/lab/Alert';

export enum ActionType {
  IS_SYNCING,
  INITIALIZED,

  GET_ACTIVE_PROJECT,
  DROP_ACTIVE_PROJECT,

  GET_ACTIVE_OBSERVATION,
  DROP_ACTIVE_OBSERVATION,

  ADD_ALERT,
  DELETE_ALERT,
}

export interface IS_SYNCING {
  type: ActionType.IS_SYNCING;
  payload: boolean;
}

export interface INITIALIZED {
  type: ActionType.INITIALIZED;
  payload: undefined;
}

export type SyncingActions = INITIALIZED | IS_SYNCING;

export interface GET_ACTIVE_PROJECT {
  type: ActionType.GET_ACTIVE_PROJECT;
  payload: ProjectObject | null;
}

export interface DROP_ACTIVE_PROJECT {
  type: ActionType.DROP_ACTIVE_PROJECT;
}

export type ProjectActions = GET_ACTIVE_PROJECT | DROP_ACTIVE_PROJECT;

export interface GET_ACTIVE_OBSERVATION {
  type: ActionType.GET_ACTIVE_OBSERVATION;
  payload: Observation | null;
}

export interface DROP_ACTIVE_OBSERVATION {
  type: ActionType.DROP_ACTIVE_OBSERVATION;
}

export type ObservationActions =
  | GET_ACTIVE_OBSERVATION
  | DROP_ACTIVE_OBSERVATION;

export interface ADD_ALERT {
  type: ActionType.ADD_ALERT;
  payload: {
    message: string;
    severity: Color;
  };
}

export interface DELETE_ALERT {
  type: ActionType.DELETE_ALERT;
  payload: {key: string};
}

export type AlertActions = ADD_ALERT | DELETE_ALERT;
