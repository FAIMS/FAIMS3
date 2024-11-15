import {
  NonUniqueProjectID,
  PossibleConnectionInfo,
  ProjectDataObject,
  ProjectID,
  ProjectMetaObject,
  ProjectObject,
} from '@faims3/data-model';
import {ExistingActiveDoc, LocalDB} from '../sync/databases';

export interface Project {
  _id: NonUniqueProjectID;
  project_id: ProjectID;
  name: string;
  description?: string;
  last_updated?: string;
  created?: string;
  status?: string;
  conductor_url: string;
  data_db?: PossibleConnectionInfo;
  metadata_db?: PossibleConnectionInfo;
}

export interface ProjectExtended extends Project {
  listing: string;
  activated: boolean;
  sync: boolean;
}

export interface ProjectInterface {
  project: ProjectObject;
  active: ExistingActiveDoc;
  meta: LocalDB<ProjectMetaObject>;
  data: LocalDB<ProjectDataObject>;
}

export type ProjectsContextType = ProjectInterface[] | null;
