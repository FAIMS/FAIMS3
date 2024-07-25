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
 * Filename: database.ts
 * Description:
 *   TODO
 */

import {RecordID, RevisionID, AttributeValuePairID} from 'faims3-datamodel';

export const UI_SPECIFICATION_NAME = 'ui-specification';
export const PROJECT_SPECIFICATION_PREFIX = 'project-specification';
export const PROJECT_METADATA_PREFIX = 'project-metadata';
export const RECORD_INDEX_NAME = 'record-version-index';

/*
 * This may already exist in pouchdb's typing, but lets make a temporary one for
 * our needs
 */
export interface PouchAttachments {
  [key: string]: any; // any for now until we work out what we need
}

/**
 * User-facing description of an Authentication mechanism.
 * The actual auth mechanisms are stored in authconfig.ts in the FAIMS3-conductor
 * in the auth proxy of the listing that this auth is for.
 */
export type AuthInfo = {
  portal: string; // Url to give AuthInfo to get token(s)
  type: 'oauth';
  name: string;
};

export interface LocalAuthDoc {
  _id: string; //Corresponds to a listings ID
  dc_token: string;
}

export interface EncodedProjectMetadata {
  _id: string; // optional as we may want to include the raw json in places
  _rev?: string; // optional as we may want to include the raw json in places
  _deleted?: boolean;
  _attachments?: PouchAttachments;
  is_attachment: boolean;
  metadata: any;
}

// This is used within the pouch/sync subsystem, do not use with form/ui
export interface EncodedRecord {
  _id: string;
  _rev?: string; // optional as we may want to include the raw json in places
  _deleted?: boolean; // This is for couchdb deletion
  record_format_version: number;
  created: string;
  created_by: string;
  revisions: RevisionID[];
  heads: RevisionID[];
}

export type AttributeValuePairIDMap = {
  [field_name: string]: AttributeValuePairID;
};

export type AttributeValuePairMap = {
  [field_name: string]: AttributeValuePair;
};

export type RevisionMap = {
  [field_name: string]: Revision;
};

export type RecordMap = {
  [field_name: string]: EncodedRecord;
};

export interface Revision {
  _id: string;
  _rev?: string; // optional as we may want to include the raw json in places
  _deleted?: boolean; // This is for couchdb deletion
  revision_format_version: number;
  avps: AttributeValuePairIDMap;
  record_id: RecordID;
  parents: RevisionID[];
  created: string;
  created_by: string;
  type: string;
  deleted?: boolean;
}

export interface AttributeValuePair {
  _id: string;
  _rev?: string; // optional as we may want to include the raw json in places
  _deleted?: boolean; // This is for couchdb deletion
  _attachments?: PouchAttachments;
  avp_format_version: number;
  type: string;
  data: any;
  revision_id: RevisionID;
  record_id: RecordID;
  annotations: any;
}

/*
 * Elements of a Project's metadataDB can be any one of these,
 * discriminated by the prefix of the object's id
 */
export type ProjectMetaObject =
  // | ProjectSchema
  // | EncodedProjectUIModel
  EncodedProjectMetadata;

export interface ProjectMetadata {
  [key: string]: any;
}

export interface ProjectUIFields {
  [key: string]: any;
}

export interface ProjectUIViewsets {
  [type: string]: {
    label?: string;
    views: string[];
    submit_label?: string;
    is_visible?: boolean;
  };
}

export interface ProjectUIViews {
  [key: string]: {
    label?: string;
    fields: string[];
    uidesign?: string;
    next_label?: string;
    is_logic?: {[key: string]: string[]}; //add for branching logic
  };
}

export interface ProjectUIModel {
  _id?: string; // optional as we may want to include the raw json in places
  _rev?: string; // optional as we may want to include the raw json in places
  fields: ProjectUIFields;
  views: ProjectUIViews;
  viewsets: ProjectUIViewsets;
  visible_types: string[];
}

/*
 * Elements of a Project's dataDB can be any one of these,
 * discriminated by the prefix of the object's id
 */
export type ProjectDataObject = AttributeValuePair | Revision | EncodedRecord;
