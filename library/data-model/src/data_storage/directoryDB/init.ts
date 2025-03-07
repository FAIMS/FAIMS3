import {InitialisationContent} from '../utils';
import {DirectoryDBSecurityDocument} from './security';

export type DirectoryDBInitialisationConfig = {
  defaultConfig?: {
    conductorInstanceName: string;
    description: string;
    conductorUrl: string;
    peopleDbName: string;
    projectsDbName: string;
  };
};

export function initDirectoryDB({
  defaultConfig = undefined,
}: DirectoryDBInitialisationConfig): InitialisationContent {
  let base: InitialisationContent = {
    designDocuments: [],
    securityDocument: DirectoryDBSecurityDocument,
  };
  if (defaultConfig) {
    base.defaultDocument = {
      _id: 'default',
      name: defaultConfig.conductorInstanceName,
      description: defaultConfig.description,
      people_db: {
        db_name: defaultConfig.peopleDbName,
      },
      projects_db: {
        db_name: defaultConfig.projectsDbName,
      },
      conductor_url: defaultConfig.conductorUrl,
    };
  }
  return base;
}
