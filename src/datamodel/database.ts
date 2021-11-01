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
 * Filename: database.ts
 * Description:
 *   TODO
 */

import {
  NonUniqueProjectID,
  RecordID,
  RevisionID,
  AttributeValuePairID,
  ProjectID,
  FAIMSTypeName,
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

/*
 * This may already exist in pouchdb's typing, but lets make a temporary one for
 * our needs
 */
export interface PouchAttachments {
  [key: string]: any; // any for now until we work out what we need
}

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
  _id: string;
  name: string;
  description: string;
  projects_db?: PossibleConnectionInfo;
  auth_mechanisms: {[key: string]: AuthInfo};
  local_only?: boolean;
}

export interface NonNullListingsObject extends ListingsObject {
  projects_db: ConnectionInfo;
}

export interface ActiveDoc {
  _id: ProjectID;
  listing_id: string;
  project_id: NonUniqueProjectID;
  username: string | null;
  password: string | null;
  friendly_name?: string;
  is_sync: boolean;
}

export interface LocalAuthDoc {
  _id: string; //Corresponds to a listings ID
  token: string;
}

/**
 * Describes a project, with connection, name, description, and schema
 * Part of the Projects DB
 * Do not use with UI code; sync code only
 */
export interface ProjectObject {
  _id: string;
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
  type: FAIMSTypeName;
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
  type: FAIMSTypeName;
  deleted?: boolean;
}

export interface AttributeValuePair {
  _id: string;
  _rev?: string; // optional as we may want to include the raw json in places
  _deleted?: boolean; // This is for couchdb deletion
  _attachments?: PouchAttachments;
  avp_format_version: number;
  type: FAIMSTypeName;
  data: any;
  revision_id: RevisionID;
  record_id: RecordID;
  annotations: any;
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
  project_id: ProjectID;
  form_id: string;
  field_id: string;
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
export type ProjectDataObject = AttributeValuePair | Revision | EncodedRecord;

export function isRecord(doc: ProjectDataObject): doc is EncodedRecord {
  return (<EncodedRecord>doc).record_format_version !== undefined;
}
