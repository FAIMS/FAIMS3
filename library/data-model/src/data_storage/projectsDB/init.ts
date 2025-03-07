import {InitialisationContent} from '../utils';
import {ProjectsDBSecurityDocument} from './security';

export type ProjectsDBInitialisationConfig = {};
export function initProjectsDB({}: ProjectsDBInitialisationConfig): InitialisationContent {
  return {
    designDocuments: [],
    securityDocument: ProjectsDBSecurityDocument,
  };
}
