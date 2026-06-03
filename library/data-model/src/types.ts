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
 * Filename: types.ts
 * Description:
 *   Types and interfaces shared across the data model: identifiers, sync/storage
 *   documents, the database interface, and the form/UI record representations.
 */

// ============================================================================
// Identifiers
// ============================================================================

/** Stand-in for jose's KeyLike. Aliased here to avoid the import dependency. */
export type KeyLike = string;

// There are two internal IDs for projects: ProjectID is unique to the whole
// system (it includes the listing_id), while NonUniqueProjectID is unique only
// to the 'projects' database it came from. This is because the list of projects
// is decentralised, so we cannot enforce system-wide unique project IDs without
// a 'namespace' listing id.

/** Project identifier unique to the whole system. */
export type ProjectID = string;

/**
 * Project identifier unique only to the database it comes from. May clash with
 * identifiers in other databases.
 */
export type NonUniqueProjectID = string;

/** Listing identifier. */
export type ListingID = string;

// There are two internal IDs for records: RecordID is unique to a project, while
// FullyResolvedRecordID is unique to the system (it includes the project_id).

/** Record identifier unique to the project. */
export type RecordID = string;

/** Record identifier unique to the system; includes the project identifier. */
export type FullyResolvedRecordID = string;

/** A {@link FullyResolvedRecordID} split into its component parts. */
export interface SplitRecordID {
  project_id: ProjectID;
  record_id: RecordID;
}

export type RevisionID = string;
export type AttributeValuePairID = string;
export type FAIMSAttachmentID = string;

export type FAIMSTypeName = string;

export type ProjectRole = string;

// ============================================================================
// Shared value types
// ============================================================================

export type Annotations = {annotation: string; uncertainty: boolean};

export interface ClusterProjectRoles {
  [key: string]: Array<ProjectRole>;
}

export interface SyncStatusCallbacks {
  sync_up: () => void;
  sync_down: () => void;
  sync_error: () => void;
  sync_denied: () => void;
}

export interface LinkedRelation {
  record_id: RecordID;
  field_id: string;
  relation_type_vocabPair: string[];
}

export interface Relationship {
  /** A record has a single parent. */
  parent?: LinkedRelation;
  /** A record may have multiple links. */
  linked?: Array<LinkedRelation>;
}

/**
 * Connection details for a project's remote database. Part of the Projects DB.
 * Do not use with UI code; sync code only.
 */
export type PossibleConnectionInfo = {
  base_url?: string | undefined;
  proto?: string | undefined;
  host?: string | undefined;
  port?: number | undefined;
  db_name?: string | undefined;
  auth?: {
    username: string;
    password: string;
  };
  jwt_token?: string;
};

// ============================================================================
// Data DB documents (PouchDB / sync layer)
//
// These types describe the documents stored in a project's data database and
// are used within the pouch/sync subsystem. Do not use them with the form/UI.
// ============================================================================

export type EncodedRecord = PouchDB.Core.Document<{
  /** PouchDB conflicts array. */
  _conflicts?: string[];
  record_format_version: number;
  created: string;
  created_by: string;
  revisions: RevisionID[];
  heads: RevisionID[];
  type: FAIMSTypeName;
  _deleted?: boolean;
}>;

export interface Revision {
  _id: string;
  /** Optional, as we may want to include the raw JSON in places. */
  _rev?: string;
  /** CouchDB deletion flag. */
  _deleted?: boolean;
  revision_format_version: number;
  avps: AttributeValuePairIDMap;
  record_id: RecordID;
  parents: RevisionID[];
  created: string;
  created_by: string;
  type: FAIMSTypeName;
  deleted?: boolean;
  ugc_comment?: string;
  /** Saves the relation to a child/linked record. */
  relationship?: Relationship;
}

export interface AttributeValuePair {
  _id: string;
  /** Optional, as we may want to include the raw JSON in places. */
  _rev?: string;
  /** CouchDB deletion flag. */
  _deleted?: boolean;
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
  /** Optional, as we may want to include the raw JSON in places. */
  _rev?: string;
  /** CouchDB deletion flag. */
  _deleted?: boolean;
  _attachments?: PouchDB.Core.Attachments;
  filename: string;
  attach_format_version: number;
  avp_id: AttributeValuePairID;
  revision_id: RevisionID;
  record_id: RecordID;
  created: string;
  created_by: string;
}

/**
 * Elements of a project's dataDB can be any one of these, discriminated by the
 * prefix of the object's id.
 */
export type ProjectDataObject =
  | AttributeValuePair
  | Revision
  | EncodedRecord
  | FAIMSAttachment;

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

// ============================================================================
// Database interface
//
// An abstract database interface that allows for either real PouchDB databases
// or our wrapped version in the app.
// ============================================================================

export interface DatabaseInterface<Content extends {} = {}> {
  name: string;

  allDocs<Model>(
    options?:
      | PouchDB.Core.AllDocsWithKeysOptions
      | PouchDB.Core.AllDocsOptions
      | PouchDB.Core.AllDocsWithinRangeOptions
  ): Promise<PouchDB.Core.AllDocsResponse<Content & Model>>;
  allDocs<Model>(
    options: PouchDB.Core.AllDocsWithKeysOptions
  ): Promise<PouchDB.Core.AllDocsWithKeysResponse<Content & Model>>;

  bulkDocs<Model>(
    docs: Array<PouchDB.Core.PutDocument<Content & Model>>,
    options?: PouchDB.Core.BulkDocsOptions
  ): Promise<Array<PouchDB.Core.Response | PouchDB.Core.Error>>;
  get<Model>(
    id: string,
    options?: PouchDB.Core.GetOptions
  ): Promise<PouchDB.Core.Document<Content & Model> & PouchDB.Core.GetMeta>;
  get<Model>(
    docId: PouchDB.Core.DocumentId,
    options: PouchDB.Core.GetOpenRevisions
  ): Promise<Array<PouchDB.Core.Revision<Content & Model>>>;

  put<Model>(
    doc: PouchDB.Core.PutDocument<Content & Model>,
    options?: PouchDB.Core.PutOptions
  ): Promise<PouchDB.Core.Response>;

  putAttachment(
    docId: PouchDB.Core.DocumentId,
    attachmentId: PouchDB.Core.AttachmentId,
    rev: PouchDB.Core.RevisionId,
    attachment: PouchDB.Core.AttachmentData,
    type: string
  ): Promise<PouchDB.Core.Response>;

  post<Model>(
    doc: PouchDB.Core.PostDocument<Content & Model>,
    options?: PouchDB.Core.Options
  ): Promise<PouchDB.Core.Response>;

  find(
    query: PouchDB.Find.FindRequest<Content>
  ): Promise<PouchDB.Find.FindResponse<Content>>;
  remove(
    doc: PouchDB.Core.RemoveDocument,
    options?: PouchDB.Core.Options
  ): Promise<PouchDB.Core.Response>;
  remove(
    docId: PouchDB.Core.DocumentId,
    revision: PouchDB.Core.RevisionId,
    options?: PouchDB.Core.Options
  ): Promise<PouchDB.Core.Response>;
  remove(
    doc: PouchDB.Core.RemoveDocument,
    options?: PouchDB.Core.Options
  ): Promise<PouchDB.Core.Response>;

  info(): Promise<PouchDB.Core.DatabaseInfo>;
  close(): Promise<void>;
  destroy(): Promise<void>;

  query<Result extends {}, Model extends {} = Content>(
    fun: string | PouchDB.Map<Model, Result> | PouchDB.Filter<Model, Result>,
    opts?: PouchDB.Query.Options<Model, Result>
  ): Promise<PouchDB.Query.Response<Result>>;

  security(
    doc?: PouchDB.SecurityHelper.PartialSecurityDocument
  ): PouchDB.SecurityHelper.Security;
}

export type RecordDbType = DatabaseInterface<EncodedRecord>;
export type RevisionDbType = DatabaseInterface<Revision>;
export type AvpDbType = DatabaseInterface<AttributeValuePair>;
export type AttachmentDbType = DatabaseInterface<FAIMSAttachment>;
export type DataDbType = DatabaseInterface<ProjectDataObject>;

// ============================================================================
// Project / server information
// ============================================================================

export interface PublicServerInfo {
  id: string;
  name: string;
  conductor_url: string;
  description: string;
  prefix: string;
  /**
   * The version of the server, e.g. 1.3.2. Optional for backwards
   * compatibility; new versions always report it.
   */
  serverVersion?: string;
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
  /** Set if the project was created from a template. */
  template_id?: string;
}

// ============================================================================
// Form / UI record types
//
// These types are used within the form/UI subsystem. Do not use them with pouch.
// ============================================================================

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
  avps: AttributeValuePairIDMap;
  relationship?: Relationship;
  data?: {[key: string]: any};
  /** Optional sync status. */
  synced?: boolean;
}

export type UnhydratedRecord = Omit<RecordMetadata, 'data' | 'hrid'>;

export type RecordMetadataList = {
  [key: string]: RecordMetadata;
};

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
  /**
   * created/created_by are optional as we don't need to track them with the
   * actual data. If you need creation information, use record metadata instead.
   */
  created?: Date;
  created_by?: string;
  /** Saves the relation to a child/linked record. */
  relationship?: Relationship;
  /** Set when checking if the record has been deleted. */
  deleted?: boolean;
}

// ============================================================================
// Merge types
// ============================================================================

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

interface InitialMergeRevisionDetails {
  created: Date;
  created_by: string;
  type: FAIMSTypeName;
  deleted: boolean;
}

export type InitialMergeRevisionDetailsMap = {
  [revision_id: string]: InitialMergeRevisionDetails;
};

export interface InitialMergeDetails {
  available_heads: InitialMergeRevisionDetailsMap;
  initial_head: RevisionID;
  initial_head_data: RecordMergeInformation;
}

// ============================================================================
// Revision listings
// ============================================================================

export interface ProjectRevisionListing {
  [_id: string]: string[];
}

export type RecordRevisionListing = RevisionID[];
