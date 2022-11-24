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
 * Filename: ui.ts
 * Description:
 *   Types/interfaces for the UI code.
 *   Do not use with sync code; UI code only.
 */

import {
  ProjectID,
  RecordID,
  RevisionID,
  AttributeValuePairID,
  ListingID,
  FAIMSTypeName,
  Annotations,
  Relationship,
  NonUniqueProjectID,
} from './core';
import {ProjectUIFields, ProjectUIViewsets, ProjectUIViews} from './typesystem';

export interface ListingInformation {
  id: ListingID;
  name: string;
  description: string;
  conductor_url: string;
}

export interface ProjectInformation {
  project_id: ProjectID;
  name: string;
  description?: string;
  last_updated?: string;
  created?: string;
  status?: string;
  is_activated: boolean;
  listing_id: ListingID;
  non_unique_project_id: NonUniqueProjectID;
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
  deleted: boolean;
  hrid: string;
  type: FAIMSTypeName;
  relationship?: Relationship;
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
  field_types: {[field_name: string]: FAIMSTypeName};
  annotations: {[field_name: string]: Annotations};
  ugc_comment?: string;
  /*
  created{_by} are optional as we don't need to track them with the actual data.
  If you need creation information, then use record metadata
  */
  created?: Date;
  created_by?: string;
  /**add for relationship*/
  relationship?: Relationship; // added for save relation to child/linked record
}

export interface FieldMergeInformation {
  avp_id: AttributeValuePairID;
  data: any;
  type: FAIMSTypeName;
  annotations: Annotations;
  created: Date;
  created_by: string;
}

export interface RecordMergeInformation {
  project_id: ProjectID;
  record_id: RecordID;
  revision_id: RevisionID;
  type: FAIMSTypeName;
  updated: Date;
  updated_by: string;
  fields: {[field_name: string]: FieldMergeInformation};
  deleted: boolean;
  relationship: Relationship;
}

export interface UserMergeResult {
  project_id: ProjectID;
  record_id: RecordID;
  parents: RevisionID[];
  updated: Date;
  updated_by: string;
  type: FAIMSTypeName;
  field_choices: {[field_name: string]: AttributeValuePairID | null};
  field_types: {[field_name: string]: FAIMSTypeName};
  relationship: Relationship;
}

export type RecordList = {
  [key: string]: Record;
};

export interface RecordReference {
  project_id?: ProjectID;
  record_id: RecordID;
  // This is for HRIDs or other non ID descriptions of reference
  record_label: RecordID | string;
  //this is for Lable of linked items, default: ['is related to', 'is related to']
  relation_type_vocabPair?: Array<string>;
  is_preferred?: boolean;
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
  uiSpecProps: FAIMSUiSpec;
  settingsProps: Array<FAIMSUiSpec>;
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

export type FAIMShandlerType = any;
export type FAIMSEVENTTYPE = any;
export interface ProjectValueList {
  [key: string]: any;
}

export interface BehaviourProperties {
  label: string;
  helpText: string;
}

export type componenentSettingprops = {
  uiSetting: ProjectUIModel;
  formProps: any;
  component: FAIMSBuilderFormField;
  uiSpec: ProjectUIModel;
  setuiSpec: FAIMShandlerType;
  fieldName: string;
  fieldui: ProjectUIFields;
  handlerchanges?: any;
  handlerchangewithview: FAIMShandlerType;
  designvalue: string;
  initialValues: ProjectUIFields;
  setinitialValues: FAIMShandlerType;
  currentview: string;
  currentform: string;
  projectvalue: any;
};

export type resetprops = {
  namespace: string;
  componentName: string;
  uiSpec: ProjectUIModel;
  setuiSpec: FAIMShandlerType;
  fieldName: string;
  formProps: any;
  designvalue: string;
  currentview: string;
  currentform: string;
  initialValues: ProjectUIFields;
  setinitialValues: FAIMShandlerType;
  projectvalue: any;
};

export type SectionMeta = any;

//interface for field persistent state
export interface fieldpersistentdata {
  _id?: string;
  project_id?: ProjectID;
  type: FAIMSTypeName;
  data: {[field_name: string]: any};
  updated?: Date;
  field_types?: {[field_name: string]: FAIMSTypeName};
  annotations: {[field_name: string]: Annotations};
  created?: Date;
}
