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

import PouchDB from 'pouchdb';
import {
  NonUniqueProjectID,
  ListingID,
  RecordID,
  RevisionID,
  AttributeValuePairID,
  FAIMSAttachmentID,
  ProjectID,
  FAIMSTypeName,
  Annotations,
  Relationship,
} from './core';
import {
  FAIMSConstantCollection,
  FAIMSTypeCollection,
  ProjectUIFields,
  ProjectUIViewsets,
  ProjectUIViews,
} from './typesystem';

export const UI_SPECIFICATION_NAME = 'ui-specification';
export const PROJECT_SPECIFICATION_PREFIX = 'project-specification';
export const PROJECT_METADATA_PREFIX = 'project-metadata';
export const RECORD_INDEX_NAME = 'record-version-index';
export const LOCAL_AUTOINCREMENT_PREFIX = 'local-autoincrement-state';
export const LOCAL_AUTOINCREMENT_NAME = 'local-autoincrementers';
export const LOCALLY_CREATED_PROJECT_PREFIX = 'locallycreatedproject';
export const LOCAL_FIELDpersistent_PREFIX = 'local-fieldpersistent-state';

export interface ConnectionInfo {
  proto: string;
  host: string;
  port: number;
  lan?: boolean;
  db_name: string;
  auth?: {
    username: string;
    password: string;
  };
  jwt_token?: string;
}

export type ConductorURL = string;

export type PossibleConnectionInfo =
  | undefined
  | {
      proto?: string | undefined;
      host?: string | undefined;
      port?: number | undefined;
      lan?: boolean | undefined;
      db_name?: string | undefined;
      auth?: {
        username: string;
        password: string;
      };
      jwt_token?: string;
    };

export interface ListingsObject {
  _id: ListingID;
  name: string;
  description: string;
  projects_db?: PossibleConnectionInfo;
  conductor_url?: ConductorURL;
  local_only?: boolean;
}

export interface NonNullListingsObject extends ListingsObject {
  projects_db: ConnectionInfo;
}

export interface ActiveDoc {
  _id: ProjectID;
  listing_id: ListingID;
  project_id: NonUniqueProjectID;
  username: string | null;
  password: string | null;
  friendly_name?: string;
  is_sync: boolean;
  is_sync_attachments: boolean;
}

export type JWTToken = string;

export interface JWTTokenInfo {
  pubkey: string;
  pubalg: string;
  token: JWTToken;
}

export type JWTTokenMap = {
  [username: string]: JWTTokenInfo;
};

export interface LocalAuthDoc {
  _id: string; //Corresponds to a listings ID
  _rev?: string; // optional as we may want to include the raw json in places
  current_token: JWTToken;
  current_username: string;
  available_tokens: JWTTokenMap;
}

/**
 * Describes a project, with connection, name, description, and schema
 * Part of the Projects DB
 * Do not use with UI code; sync code only
 */
export interface ProjectObject {
  _id: NonUniqueProjectID;
  name: string;
  description?: string;
  data_db?: PossibleConnectionInfo;
  metadata_db?: PossibleConnectionInfo;
  last_updated?: string;
  created?: string;
  status?: string;
}

export type ProjectsList = {
  [key: string]: ProjectObject;
};

export interface ProjectSchema {
  _id?: string; // optional as we may want to include the raw json in places
  _rev?: string; // optional as we may want to include the raw json in places
  _deleted?: boolean;
  namespace: string;
  constants: FAIMSConstantCollection;
  types: FAIMSTypeCollection;
}

export interface EncodedProjectUIModel {
  _id: string; // optional as we may want to include the raw json in places
  _rev?: string; // optional as we may want to include the raw json in places
  _deleted?: boolean;
  fields: ProjectUIFields;
  fviews: ProjectUIViews; // conflicts with pouchdb views/indexes, hence fviews
  viewsets: ProjectUIViewsets;
  visible_types: string[];
}

export interface EncodedProjectMetadata {
  _id: string; // optional as we may want to include the raw json in places
  _rev?: string; // optional as we may want to include the raw json in places
  _deleted?: boolean;
  _attachments?: PouchDB.Core.Attachments;
  is_attachment: boolean;
  metadata: any;
  single_attachment?: boolean;
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
  type: FAIMSTypeName;
  relationship?: Relationship;
}

export type AttributeValuePairIDMap = {
  [field_name: string]: AttributeValuePairID;
};

export type AttributeValuePairMap = {
  [field_name: string]: AttributeValuePair;
};

export type RevisionMap = {
  [revision_id: string]: Revision;
};

export type RecordMap = {
  [record_id: string]: EncodedRecord;
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
  type: FAIMSTypeName;
  deleted?: boolean;
  ugc_comment?: string;
  relationship?: Relationship; // added for save relation to child/linked record
}

export interface AttributeValuePair {
  _id: string;
  _rev?: string; // optional as we may want to include the raw json in places
  _deleted?: boolean; // This is for couchdb deletion
  _attachments?: PouchDB.Core.Attachments;
  avp_format_version: number;
  type: FAIMSTypeName;
  data: any;
  revision_id: RevisionID;
  record_id: RecordID;
  annotations: Annotations;
  created: string;
  created_by: string;
  faims_attachments?: FAIMSAttachmentReference[];
}

export interface FAIMSAttachmentReference {
  attachment_id: FAIMSAttachmentID;
  filename: string;
  file_type: string;
}

export interface FAIMSAttachment {
  _id: string;
  _rev?: string; // optional as we may want to include the raw json in places
  _deleted?: boolean; // This is for couchdb deletion
  _attachments?: PouchDB.Core.Attachments;
  filename: string;
  attach_format_version: number;
  avp_id: AttributeValuePairID;
  revision_id: RevisionID;
  record_id: RecordID;
  created: string;
  created_by: string;
}

/*
 * Autoincrementing types
 */
export interface LocalAutoIncrementRange {
  start: number;
  stop: number;
  fully_used: boolean;
  using: boolean;
}

export interface LocalAutoIncrementState {
  _id: string;
  _rev?: string;
  last_used_id: number | null;
  ranges: LocalAutoIncrementRange[];
}

export interface AutoIncrementReference {
  form_id: string;
  field_id: string;
  label?: string;
}

export interface AutoIncrementReferenceDoc {
  _id: string;
  _rev?: string;
  references: AutoIncrementReference[];
}

/*
 * Elements of a Project's metadataDB can be any one of these,
 * discriminated by the prefix of the object's id
 */
export type ProjectMetaObject =
  | ProjectSchema
  | EncodedProjectUIModel
  | EncodedProjectMetadata
  | AutoIncrementReferenceDoc;

/*
 * Elements of a Project's dataDB can be any one of these,
 * discriminated by the prefix of the object's id
 */
export type ProjectDataObject =
  | AttributeValuePair
  | Revision
  | EncodedRecord
  | FAIMSAttachment;

export function isRecord(doc: ProjectDataObject): doc is EncodedRecord {
  return (<EncodedRecord>doc).record_format_version !== undefined;
}
