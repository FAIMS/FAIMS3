import {PossibleConnectionInfo} from '../../types';

// V1
export type ProjectV1Fields = {
  name: string;
  description?: string;

  // Was the project created from a template?
  template_id?: string;
  data_db?: PossibleConnectionInfo;
  metadata_db?: PossibleConnectionInfo;
  last_updated?: string;
  created?: string;
  status?: string;

  // Team ownership? Undefined means owned by an individual
  ownedByTeamId?: string;
};
export type ProjectV1Document = PouchDB.Core.Document<ProjectV1Fields>;

// V2
export enum ProjectStatus {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
}

export type ProjectV2Fields = {
  // Project name
  name: string;

  // Project status (default:= CLOSED)
  status: ProjectStatus;

  // Data and metadata connections (mandatory)
  dataDb: PossibleConnectionInfo;
  metadataDb: PossibleConnectionInfo;

  // Team ownership? Undefined means owned by an individual
  ownedByTeamId?: string;

  // Was the project created from a template?
  templateId?: string;
};
export type ProjectV2Document = PouchDB.Core.Document<ProjectV2Fields>;

// Current (V2)
export type ProjectDBFields = ProjectV2Fields;
export type ProjectDocument = PouchDB.Core.Document<ProjectDBFields>;
export type ExistingProjectDocument =
  PouchDB.Core.ExistingDocument<ProjectDBFields>;

// DB Type (V2)
export type ProjectDB = PouchDB.Database<ProjectDBFields>;
