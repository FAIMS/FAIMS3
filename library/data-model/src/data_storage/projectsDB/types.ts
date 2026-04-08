import {DatabaseInterface, PossibleConnectionInfo} from '../../types';

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

/** Stored project status before the ARCHIVED lifecycle value existed (projects DB v2). */
export enum ProjectStatusV2 {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

/**
 * Current survey lifecycle on the project document (projects DB v3).
 * Name kept as {@link ProjectStatus} (not `ProjectStatusV3`) for stable imports.
 */
export enum ProjectStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  ARCHIVED = 'ARCHIVED',
}

export type ProjectV2Fields = {
  name: string;
  status: ProjectStatusV2;
  dataDb: PossibleConnectionInfo;
  metadataDb: PossibleConnectionInfo;
  ownedByTeamId?: string;
  templateId?: string;
};
export type ProjectV2Document = PouchDB.Core.Document<ProjectV2Fields>;

export type ProjectV3Fields = Omit<ProjectV2Fields, 'status'> & {
  status: ProjectStatus;
};
export type ProjectV3Document = PouchDB.Core.Document<ProjectV3Fields>;

export type ProjectDBFields = ProjectV3Fields;
export type ProjectDocument = PouchDB.Core.Document<ProjectDBFields>;
export type ExistingProjectDocument =
  PouchDB.Core.ExistingDocument<ProjectDBFields>;

export type ProjectDB = DatabaseInterface<ProjectDBFields>;
