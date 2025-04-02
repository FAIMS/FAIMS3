import {InitialisationContent} from '../utils';
import {projectsDbDesignDocuments} from './design';
import {ProjectsDBSecurityDocument} from './security';

export type ProjectsDBInitialisationConfig = {};
export function initProjectsDB(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  config: ProjectsDBInitialisationConfig
): InitialisationContent {
  return {
    designDocuments: [projectsDbDesignDocuments.indexDocument],
    securityDocument: ProjectsDBSecurityDocument,
  };
}
