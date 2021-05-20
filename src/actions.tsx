import {
  ProjectObject,
  ProjectsList,
  Observation,
  ObservationList,
  ProjectUIModel,
} from './datamodel';

export enum ActionType {
  INITIALIZED,
  APPEND_PROJECT_LIST,
  POP_PROJECT_LIST,
  GET_PROJECT,
  UPDATE_PROJECT,
  DROP_PROJECT,
  UPDATE_UI_SPEC,
  APPEND_OBSERVATION_LIST,
  POP_OBSERVATION_LIST,
  GET_OBSERVATION,
  UPDATE_OBSERVATION,
  DROP_OBSERVATION,
}

export interface INITIALIZED {
  type: ActionType.INITIALIZED;
  payload: undefined;
}

export type InitializeActions = INITIALIZED;

export interface APPEND_PROJECT_LIST {
  type: ActionType.APPEND_PROJECT_LIST;
  payload: ProjectsList;
}

export interface POP_PROJECT_LIST {
  type: ActionType.POP_PROJECT_LIST;
  payload: Set<string>;
}

export interface GET_PROJECT {
  type: ActionType.GET_PROJECT;
  payload: ProjectObject | null;
}
export interface UPDATE_PROJECT {
  type: ActionType.UPDATE_PROJECT;
  payload: ProjectObject | null;
}

export interface UPDATE_UI_SPEC {
  type: ActionType.UPDATE_UI_SPEC;
  payload: ProjectUIModel | null;
}
export interface DROP_PROJECT {
  type: ActionType.DROP_PROJECT;
}

export type ProjectActions =
  | APPEND_PROJECT_LIST
  | POP_PROJECT_LIST
  | GET_PROJECT
  | UPDATE_PROJECT
  | DROP_PROJECT;

export interface APPEND_OBSERVATION_LIST {
  type: ActionType.APPEND_OBSERVATION_LIST;
  payload: {project_id: string; data: ObservationList};
}

export interface POP_OBSERVATION_LIST {
  type: ActionType.POP_OBSERVATION_LIST;
  payload: {project_id: string; data_ids: Set<string>};
}

export interface GET_OBSERVATION {
  type: ActionType.GET_OBSERVATION;
  payload: Observation | null;
}

export interface UPDATE_OBSERVATION {
  type: ActionType.UPDATE_OBSERVATION;
  payload: Observation | null;
}

export interface DROP_OBSERVATION {
  type: ActionType.DROP_OBSERVATION;
}

export type ObservationActions =
  | APPEND_OBSERVATION_LIST
  | POP_OBSERVATION_LIST
  | GET_OBSERVATION
  | UPDATE_OBSERVATION
  | DROP_OBSERVATION;
