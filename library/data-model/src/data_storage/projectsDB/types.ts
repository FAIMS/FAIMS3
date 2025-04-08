import {PossibleConnectionInfo} from '../..';

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

// Current (V1)
export type ProjectDBFields = ProjectV1Fields;
export type ProjectDocument = PouchDB.Core.Document<ProjectDBFields>;
export type ExistingProjectDocument =
  PouchDB.Core.ExistingDocument<ProjectDBFields>;

// DB Type (V1)
export type ProjectDB = PouchDB.Database<ProjectDB>;
