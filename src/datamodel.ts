export const UI_SPECIFICATION_NAME = 'ui-specification';
export const PROJECT_SPECIFICATION_PREFIX = 'project-specification';

export interface ConnectionInfo {
  proto: string;
  host: string;
  port: number;
  lan?: boolean;
  db_name: string;
}

export interface ListingsObject {
  _id: string;
  name: string;
  description: string;
  projects_db?: ConnectionInfo;
  people_db?: ConnectionInfo;
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
}

/**
 * Describes a project, with connection, name, description, and schema
 * Part of the Projects DB
 */
export interface ProjectObject {
  _id: string;
  name: string;
  description: string;
  data_db?: ConnectionInfo;
  metadata_db?: ConnectionInfo;
}

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
  _ref?: string; // optional as we may want to include the raw json in places
  namespace: string;
  constants: FAIMSConstantCollection;
  types: FAIMSTypeCollection;
}

export interface ProjectUIModel {
  _id: string;
  fields: Array<any>;
  views: Array<any>;
  start_view: string;
}

export interface ProjectPeople {
  _id: string;
}

export interface Observation {
  _id: string;
}

/*
 * Elements of a Project's metadataDB can be any one of these,
 * discriminated by the prefix of the object's id
 */
export type ProjectMetaObject = ProjectSchema | ProjectUIModel | ProjectPeople;

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

export interface Datum {
  // Main datum type
  history: Array<{
    person: string;
    date: bigint;
  }>;
  //TODO: More stuff
}
