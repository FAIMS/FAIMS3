import {InitialisationContent} from '../utils';
import {ProjectsDBSecurityDocument} from './security';

export type ProjectsDBInitialisationConfig = {};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function initProjectsDB(
  config: ProjectsDBInitialisationConfig
): InitialisationContent {
  return {
    designDocuments: [],
    securityDocument: ProjectsDBSecurityDocument,
  };
}
