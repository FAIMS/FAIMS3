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
 * Filename: actions.ts
 * Description:
 *   TODO
 */

import {ProjectObject} from './datamodel/database';
import {Record} from './datamodel/ui';
import AlertColor from '@mui/material/Alert';

export enum ActionType {
  IS_SYNCING,
  INITIALIZED,

  GET_ACTIVE_PROJECT,
  DROP_ACTIVE_PROJECT,

  GET_ACTIVE_RECORD,
  DROP_ACTIVE_RECORD,

  SET_LISTINGS_KNOWN,

  ADD_ALERT,
  DELETE_ALERT,
  ADD_CUSTOM_ALERT,
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

export interface GET_ACTIVE_RECORD {
  type: ActionType.GET_ACTIVE_RECORD;
  payload: Record | null;
}

export interface DROP_ACTIVE_RECORD {
  type: ActionType.DROP_ACTIVE_RECORD;
}

export type RecordActions = GET_ACTIVE_RECORD | DROP_ACTIVE_RECORD;

export interface SET_LISTINGS_KNOWN {
  type: ActionType.SET_LISTINGS_KNOWN;
  payload: Set<string>;
}

export type SyncActions = SET_LISTINGS_KNOWN;

export interface ADD_ALERT {
  type: ActionType.ADD_ALERT;
  payload: {
    message: string;
    severity: string;
  };
}

export interface DELETE_ALERT {
  type: ActionType.DELETE_ALERT;
  payload: {key: string};
}

export interface ADD_CUSTOM_ALERT {
  type: ActionType.ADD_CUSTOM_ALERT;
  payload: {
    element: JSX.Element[];
    severity:  string;
  };
}

export type AlertActions = ADD_ALERT | DELETE_ALERT | ADD_CUSTOM_ALERT;
