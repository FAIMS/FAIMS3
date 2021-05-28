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
 * Filename: actions.ts
 * Description: 
 *   TODO
 */


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
