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
 *   Types and interfaces that are used by the database module
 */

import {z} from 'zod';

// from datamodel/core.ts ---------------------------------------------------

// import type {KeyLike} from 'jose';
export type KeyLike = string; // this is the same type but might not be enough for import

// There are two internal IDs for projects, the former is unique to the system
// (i.e. includes the listing_id), the latter is unique only to the 'projects'
// database it came from, for a FAIMS listing
// (It is this way because the list of projects is decentralised and so we
// cannot enforce system-wide unique project IDs without a 'namespace' listing id)

/** Projects are identified by a string unique to the whole system */
export type ProjectID = string;
/** Non Unique project identifier is unique only to the database it comes from, may clash with
 * other identifiers in other databases */
export type NonUniqueProjectID = string;
/** Listing identifier */
export type ListingID = string;

// There are two internal ID for records, the former is unique to a
// project, the latter unique to the system (i.e. includes project_id)

/** Record identifier unique to the project */
export type RecordID = string;
/** Record identifier unique to the system, includes the project identifier */
export type FullyResolvedRecordID = string;
/** A representation of a {FullyResolvedRecordID} split into the component parts */
export interface SplitRecordID {
  project_id: ProjectID;
  record_id: RecordID;
}

export type RevisionID = string;
export type AttributeValuePairID = string;
export type FAIMSAttachmentID = string;

export type FAIMSTypeName = string;

export type Annotations = {annotation: string; uncertainty: boolean};

export interface TokenContents {
  username: string;
  roles: string[];
  name?: string;
  server: string;
  // This is required now - all tokens must have an expiry
  exp: number;
}

export type ProjectRole = string;

export interface ClusterProjectRoles {
  [key: string]: Array<ProjectRole>;
}

export interface SyncStatusCallbacks {
  sync_up: () => void;
  sync_down: () => void;
  sync_error: () => void;
  sync_denied: () => void;
}

export type LocationState = {
  parent_record_id?: string; // parent or linked record id, set from parent or linked record
  field_id?: string; // parent or linked field id, set from parent or linked record
  type?: string; // type of relationship: Child or Linked
  parent_link?: string; // link of parent/linked record, so when child/link record saved, this is the redirect link
  parent?: any; // parent to save upper level information for nest related, for example, grandparent
  record_id?: RecordID; // child/linked record ID, set in child/linked record, should be pass back to parent
  hrid?: string; // child/linked record HRID, this is the value displayed in field, set in child/linked record, should be pass back to parent
  relation_type_vocabPair?: string[] | null; //pass the parent information to child
  child_record_id?: RecordID; //child/linked record ID created from parent
  parent_hrid?: string;
};
export interface LinkedRelation {
  record_id: RecordID;
  field_id: string;
  relation_type_vocabPair: string[];
}
export interface Relationship {
  parent?: LinkedRelation; // has single parent
  linked?: Array<LinkedRelation>; // has multiple link
}

// end of types from datamodel/core.ts -----------------------------------------

// types from datamodel/database.ts ----------------------------------------

/**
 * Describes a project, with connection, name, description, and schema
 * Part of the Projects DB
 * Do not use with UI code; sync code only
 */

export type PossibleConnectionInfo =
  | undefined
  | {
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
export interface ProjectObject {
  _id: NonUniqueProjectID;
  name: string;
  project_id: string;
  description?: string;
  // Was the project created from a template?
  template_id?: string;
  data_db?: PossibleConnectionInfo;
  metadata_db?: PossibleConnectionInfo;
  last_updated?: string;
  created?: string;
  status?: string;
}

// TODO make this better, currently there is no real explanation for this
// structure

// This is returned from the list project endpoints
export const APINotebookListSchema = z.object({
  name: z.string(),
  is_admin: z.boolean().optional(),
  last_updated: z.string().optional(),
  created: z.string().optional(),
  template_id: z.string().optional(),
  status: z.string().optional(),
  project_id: z.string(),
  metadata: z.record(z.unknown()).optional().nullable(),
});
export type APINotebookList = z.infer<typeof APINotebookListSchema>;

// This is returned from the get project endpoint
export const APINotebookGetSchema = z.object({
  // metadata and spec to match notebook json schema
  metadata: z.record(z.unknown()),
  'ui-specification': z.record(z.unknown()),
});
export type APINotebookGet = z.infer<typeof APINotebookGetSchema>;

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

export interface ProjectUIModelDetails {
  fields: ProjectUIFields;
  views: ProjectUIViews;
  viewsets: ProjectUIViewsets;
  visible_types: string[];
  conditional_sources?: Set<string>;
}

export interface EncodedCouchRecordFields {
  _id: string;
  _rev?: string; // optional as we may want to include the raw json in places
  _deleted?: boolean;
}

// Type for the external format of Notebooks
export interface EncodedNotebook {
  metadata: {[key: string]: any};
  'ui-specification': EncodedProjectUIModel;
}

export interface EncodedProjectUIModel extends EncodedCouchRecordFields {
  fields: ProjectUIFields;
  fviews: ProjectUIViews; // conflicts with pouchdb views/indexes, hence fviews
  viewsets: ProjectUIViewsets;
  visible_types: string[];
}

export interface EncodedProjectMetadata extends EncodedCouchRecordFields {
  _attachments?: PouchDB.Core.Attachments;
  is_attachment: boolean;
  metadata: any;
  single_attachment?: boolean;
}

// This is used within the pouch/sync subsystem, do not use with form/ui
export interface EncodedRecord extends EncodedCouchRecordFields {
  _conflicts?: string[]; // Pouchdb conflicts array
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

// end of types from datamodel/database.ts --------------------------------

// types from datamodel/drafts.ts --------------------------------
export interface EncodedDraft {
  _id: string;
  // Fields (may itself contain an _id)
  fields: {[key: string]: unknown};
  annotations: {
    [key: string]: Annotations;
  };
  attachments: {
    [key: string]: (
      | FAIMSAttachmentReference
      | {
          filename: string;
          draft_attachment: boolean;
        }
    )[];
  };
  _attachments?: PouchDB.Core.Attachments;
  project_id: ProjectID;
  // If this draft is for the user updating an existing record, the following
  // is non-null, the record it's editing.
  existing: null | {
    record_id: RecordID;
    revision_id: RevisionID;
  };
  created: string;
  updated: string;
  type: string;
  field_types: {[field_name: string]: FAIMSTypeName};
  record_id: RecordID;
  relationship?: Relationship;
}

//to get the metadata for the draft, for draft_table
export interface DraftMetadata {
  _id: string;
  project_id: ProjectID;
  existing: null | {
    record_id: RecordID;
    revision_id: RevisionID;
  };
  // Only difference: Date is a date, not string
  created: Date;
  updated: Date;
  type: string;
  hrid: string | null;
  record_id: string;
}

export type DraftMetadataList = {
  [key: string]: DraftMetadata;
};

// end of types from datamodel/drafts.ts --------------------------------

// types from datamodel/geo.ts --------------------------------

// This is the same as the web/capacitor output, will need to be updated for the
// new GeoJSON format
export interface FAIMSCoordinate {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitudeAccuracy: number | null;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
}

export interface FAIMSPosition {
  type: string;
  properties: FAIMSPositionProperties;
  geometry: FAIMSPositionGeometry;
}

export interface FAIMSPositionProperties {
  timestamp: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  accuracy: number;
  altitude_accuracy: number | null;
}

export interface FAIMSPositionGeometry {
  type: string;
  coordinates: number[];
}

// end of types from datamodel/geo.ts --------------------------------

// types from datamodel/typeSystems.ts --------------------------------

export interface FAIMSType {
  [key: string]: any; // any for now until we lock down the json
}

export interface FAIMSTypeCollection {
  [key: string]: FAIMSType;
}

export interface FAIMSConstant {
  [key: string]: any; // any for now until we lock down the json
}

export interface FAIMSConstantCollection {
  [key: string]: FAIMSConstant;
}

export interface ProjectUIFields {
  [key: string]: any;
}

export interface ProjectUIViewset {
  label?: string;
  views: string[];
  submit_label?: string;
  is_visible?: boolean;
  summary_fields?: Array<string>;
  // Which field should be used as the hrid?
  hridField?: string;
  // Layout option
  layout?: 'inline' | 'tabs';
}

export interface ProjectUIViewsets {
  [type: string]: ProjectUIViewset;
}

export interface ConditionalExpression {
  operator: string;
  conditions?: ConditionalExpression[];
  field?: string;
  value?: any;
}

export interface RecordValues {
  [field_name: string]: any;
}

export interface ProjectUIViews {
  [key: string]: {
    label?: string;
    fields: string[];
    uidesign?: string;
    next_label?: string;
    is_logic?: {[key: string]: string[]}; //add for branching logic
    condition?: ConditionalExpression; // new conditional logic
    conditionFn?: (v: RecordValues) => boolean; // compiled conditional function
  };
}

export interface ElementOption {
  value: string;
  label: string;
  key?: string;
}

// end of types from datamodel/typeSystems.ts --------------------------------

// types from datamodel/ui.ts --------------------------------
export interface PublicServerInfo {
  id: string;
  name: string;
  conductor_url: string;
  description: string;
  prefix: string;
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
  // Was the project created from a template?
  template_id?: string;
}

export interface ProjectUIModel extends ProjectUIModelDetails {
  _id?: string; // optional as we may want to include the raw json in places
  _rev?: string; // optional as we may want to include the raw json in places
}
export interface RecordReference {
  project_id: ProjectID;
  record_id: RecordID;
  // This is for HRIDs or other non ID descriptions of reference
  record_label: RecordID | string;
  //this is for Label of linked items, default: ['is related to', 'is related to']
  relation_type_vocabPair?: Array<string>;
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
  data?: {[key: string]: any};
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
  deleted?: boolean; //add for checking if record been deleted
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

// end of types from datamodel/ui.ts --------------------------------

// types from data_storage/index.ts --------------------------------

/**
 * Project Revision Listing
 * @interface
 */
export interface ProjectRevisionListing {
  [_id: string]: string[];
}

export type RecordRevisionListing = RevisionID[];

// end of types from datamodel/index.ts --------------------------------

// types from data_storage/merging.ts --------------------------------

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

// ===============
// COUCH DB MODELS
// ===============

// Base properties returned from list, get etc
export const CouchDocumentFieldsSchema = z.object({
  _id: z.string().min(1),
  _rev: z.string().optional(),
  _deleted: z.boolean().optional(),
});
export type CouchDocumentFields = z.infer<typeof CouchDocumentFieldsSchema>;

// ========================
// UI SCHEMA AND METADATA
// ========================
// TODO use zod more effectively here to enhance validation

// The UI specification

// TODO use Zod for existing UI schema models to validate. Note that this is a
// schema for an JSON notebook (fviews, not views). We refine this model so that
// it cannot be undefined - Zod.custom by default allows undefined to validate
export const UiSpecificationSchema = z
  .custom<EncodedProjectUIModel>()
  .refine(val => !!val);
export type UiSpecification = z.infer<typeof UiSpecificationSchema>;

// Metadata schema
// TODO use Zod for existing UI schema models to validate
export const NotebookMetadataSchema = z.record(z.any());
export type NotebookMetadata = z.infer<typeof NotebookMetadataSchema>;

// =========
// USER INFO
// =========

// Information about users and roles for a notebook
export const NotebookAuthSummarySchema = z.object({
  // What roles does the notebook have
  roles: z.array(z.string()),
  // users permissions for this notebook
  users: z.array(
    z.object({
      name: z.string(),
      username: z.string(),
      roles: z.array(
        z.object({
          name: z.string(),
          value: z.boolean(),
        })
      ),
    })
  ),
});
export type NotebookAuthSummary = z.infer<typeof NotebookAuthSummarySchema>;

// ==================
// TEMPLATE DB MODELS
// ==================

// The editable properties for a template
export const TemplateEditableDetailsSchema = z.object({
  // What is the display name of the template?
  template_name: z
    .string()
    .trim()
    .min(5, 'Please provide a template name of at least 5 character length.'),
  // The UI specification for this template
  'ui-specification': UiSpecificationSchema,
  // The metadata from the designer - copied into new notebooks
  metadata: NotebookMetadataSchema,
});
export type TemplateEditableDetails = z.infer<
  typeof TemplateEditableDetailsSchema
>;

// The system/derived properties for a template
export const TemplateDerivedDetailsSchema = z.object({
  // Version identifier for the template
  version: z.number().default(1),
});
export type TemplateDerivedDetails = z.infer<
  typeof TemplateDerivedDetailsSchema
>;

// The template record is an intersection of the editable/derived fields
export const TemplateDetailsSchema = z.intersection(
  // Need to disable strictness here or it propagates in the intersection
  TemplateEditableDetailsSchema,
  TemplateDerivedDetailsSchema
);
export type TemplateDetails = z.infer<typeof TemplateDetailsSchema>;

// The full encoded record including _id, extension of Details
export const TemplateDocumentSchema = z.intersection(
  TemplateDetailsSchema,
  CouchDocumentFieldsSchema
);
export type TemplateDocument = z.infer<typeof TemplateDocumentSchema>;
