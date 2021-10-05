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
import {ProjectID, RecordID, RevisionID, FAIMSTypeName} from './core';
import {ProjectUIFields, ProjectUIViewsets, ProjectUIViews} from './typesystem';

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
  viewsets: ProjectUIViewsets;
  visible_types: string[];
}

export interface RecordMetadata {
  project_id: ProjectID;
  record_id: RecordID;
  revision_id: RevisionID;
  created: Date;
  created_by: string;
  updated: Date;
  updated_by: string;
  conflicts: boolean;
}

export type RecordMetadataList = {
  [key: string]: RecordMetadata;
};

// This is used within the form/ui subsystem, do not use with pouch
export interface Record {
  project_id?: ProjectID;
  record_id: RecordID;
  revision_id: RevisionID | null;
  type: FAIMSTypeName;
  data: {[field_name: string]: any};
  updated: Date;
  updated_by: string;
  /*
  created{_by} are optional as we don't need to track them with the actual data.
  If you need creation information, then use record metadata
  */
  created?: Date;
  created_by?: string;
}

export type RecordList = {
  [key: string]: Record;
};

export interface RecordReference {
  project_id?: ProjectID;
  record_id: RecordID;
  // This is for HRIDs or other non ID descriptions of reference
  record_label: RecordID | string;
}

/*
 * This somehow needs to handle class-based components and function-based
 * components...
 */
export type FAIMSFormField = any;
export type FAIMSBuilderFormField = any;
export type FAIMSBuilderIcon = any;
export type FAIMSUiSpec = any;

export interface ComponentRegistryProperties {
  human_readable_name: string;
  description: string;
  category: string;
  component: FAIMSFormField;
  uiSpecProps:FAIMSUiSpec;
  builder_component: FAIMSBuilderFormField;
  icon: FAIMSBuilderIcon;
}

export type ComponentRegistryItem = {
  [name: string]: ComponentRegistryProperties;
};

export type ComponentRegistry = {[namespace: string]: ComponentRegistryItem};

export interface FormComponent {
  namespace: string;
  component_name: string;
  component_properties: ComponentRegistryProperties;
}
export type FormComponentList = FormComponent[];
