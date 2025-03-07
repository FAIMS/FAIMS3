import {InitialisationContent} from '../utils';
import {ProjectsDBSecurityDocument} from './security';

export type ProjectsDBInitialisationConfig = {};
export function initProjectsDB(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  config: ProjectsDBInitialisationConfig
): InitialisationContent {
  return {
    designDocuments: [],
    securityDocument: ProjectsDBSecurityDocument,
  };
}
