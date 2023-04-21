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

import {ProjectObject} from 'faims3-datamodel';
import {Record} from 'faims3-datamodel';
import {AlertColor} from '@mui/material/Alert/Alert';

export enum ActionType {
  IS_SYNCING_UP,
  IS_SYNCING_DOWN,
  HAS_UNSYNCED_CHANGES,
  IS_SYNC_ERROR,

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

export interface IS_SYNCING_UP {
  type: ActionType.IS_SYNCING_UP;
  payload: boolean;
}
export interface IS_SYNCING_DOWN {
  type: ActionType.IS_SYNCING_DOWN;
  payload: boolean;
}
export interface HAS_UNSYNCED_CHANGES {
  type: ActionType.HAS_UNSYNCED_CHANGES;
  payload: boolean;
}

export interface IS_SYNC_ERROR {
  type: ActionType.IS_SYNC_ERROR;
  payload: boolean;
}

export interface INITIALIZED {
  type: ActionType.INITIALIZED;
  payload: undefined;
}

export type SyncingActions =
  | INITIALIZED
  | IS_SYNCING_UP
  | IS_SYNCING_DOWN
  | HAS_UNSYNCED_CHANGES
  | IS_SYNC_ERROR;

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
    severity: AlertColor;
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
    severity: AlertColor;
  };
}

export type AlertActions = ADD_ALERT | DELETE_ALERT | ADD_CUSTOM_ALERT;
