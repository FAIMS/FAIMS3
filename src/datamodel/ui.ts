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
 * Filename: ui.ts
 * Description:
 *   TODO
 */

/**
 * User readable information about a project
 * Do not use with sync code; UI code only
 */

import {ProjectID, ObservationID, RevisionID, DatumID} from './core';
import {ProjectUIFields, ProjectUIViews} from './typesystem';

export interface ProjectInformation {
  project_id: ProjectID;
  name: string;
  description?: string;
  last_updated?: string;
  created?: string;
  status?: string;
}

export interface ProjectUIModel {
  _id?: string; // optional as we may want to include the raw json in places
  _rev?: string; // optional as we may want to include the raw json in places
  fields: ProjectUIFields;
  views: ProjectUIViews;
  start_view: string;
}

export interface ObservationMetadata {
  project_id: ProjectID;
  observation_id: ObservationID;
  revision_id: RevisionID;
  created: Date;
  created_by: string;
  updated: Date;
  updated_by: string;
  conflicts: boolean;
}

export type ObservationMetadataList = {
  [key: string]: ObservationMetadata;
};

// This is used within the form/ui subsystem, do not use with pouch
export interface Observation {
  project_id?: ProjectID;
  observation_id: ObservationID;
  revision_id: RevisionID | null;
  type: string;
  data: {[field_name: string]: any};
  updated: Date;
  updated_by: string;
  /*
  created{_by} are optional as we don't need to track them with the actual data.
  If you need creation information, then use observation metadata
  */
  created?: Date;
  created_by?: string;
}

export type ObservationList = {
  [key: string]: Observation;
};
