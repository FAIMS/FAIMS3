export const UI_SPECIFICATION_NAME = 'ui-specification';
export const PROJECT_SPECIFICATION_PREFIX = 'project-specification';

export interface ConnectionInfo {
  proto: string;
  host: string;
  port: number;
  lan?: boolean;
  db_name: string;
}

export type PossibleConnectionInfo =
  | undefined
  | {
      proto?: string | undefined;
      host?: string | undefined;
      port?: number | undefined;
      lan?: boolean | undefined;
      db_name?: string | undefined;
    };

export interface ListingsObject {
  _id: string;
  name: string;
  description: string;
  projects_db?: PossibleConnectionInfo;
  people_db?: PossibleConnectionInfo;
}

export interface NonNullListingsObject extends ListingsObject {
  projects_db: ConnectionInfo;
  people_db: ConnectionInfo;
}

export interface ActiveDoc {
  _id: string;
  listing_id: string;
  project_id: string;
  username: string;
  password: string;
  friendly_name?: string;
}

/**
 * Describes a project, with connection, name, description, and schema
 * Part of the Projects DB
 */
export interface ProjectObject {
  _id: string;
  name: string;
  description: string;
  data_db?: PossibleConnectionInfo;
  metadata_db?: PossibleConnectionInfo;
}

export type ProjectsList = {
  [key: string]: ProjectObject;
};

/*
 * Objects that may be contained in a Project's metadata DB
 */
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

export interface ProjectSchema {
  _id?: string; // optional as we may want to include the raw json in places
  _rev?: string; // optional as we may want to include the raw json in places
  _deleted?: boolean;
  namespace: string;
  constants: FAIMSConstantCollection;
  types: FAIMSTypeCollection;
}

export interface ProjectUIFields {
  [key: string]: any;
}

export interface ProjectUIViews {
  [key: string]: any;
}

export interface ProjectUIModel {
  _id?: string; // optional as we may want to include the raw json in places
  _rev?: string; // optional as we may want to include the raw json in places
  fields: ProjectUIFields;
  views: ProjectUIViews;
  start_view: string;
}

export interface EncodedProjectUIModel {
  _id: string; // optional as we may want to include the raw json in places
  _rev?: string; // optional as we may want to include the raw json in places
  _deleted?: boolean;
  fields: ProjectUIFields;
  fviews: ProjectUIViews; // conflicts with pouchdb views/indexes, hence fviews
  start_view: string;
}

export interface ProjectPeople {
  _id: string;
  _rev?: string; // optional as we may want to include the raw json in places
  _deleted?: boolean;
}

// This is used within the form/ui subsystem, do not use with pouch
export interface Observation {
  _id?: string; // optional as we may want to include the raw json in places
  _rev?: string; // optional as we may want to include the raw json in places
  type: string;
  data: any;
  userid: string;
}

// This is used within the pouch/sync subsystem, do not use with form/ui
export interface EncodedObservation {
  _id: string;
  _rev?: string; // optional as we may want to include the raw json in places
  _revisions?: {start: number; ids: string[]};
  _deleted?: boolean; // This is for couchdb deletion
  deleted?: boolean; // This is for user-level deletion
  format_version: number;
  type: string;
  data: any;
  userid: string;
}

/*
 * Elements of a Project's metadataDB can be any one of these,
 * discriminated by the prefix of the object's id
 */
export type ProjectMetaObject =
  | ProjectSchema
  | EncodedProjectUIModel
  | ProjectPeople;

/**
 * Document from a people DB
 */
export interface PeopleDoc {
  roles: Array<string>;
  devices: Array<string>;
  salt: string;
  ierations: 10;
  derived_key: string;
  passsword_scheme: string;
}
