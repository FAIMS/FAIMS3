import {InitialisationContent} from '../utils';
import {MetadataDBSecurityDocument} from './security';

export type MetadataDBInitialisationConfig = {
  // What is the ID of the project for scoping roles
  projectId: string;
};
export function initMetadataDB({
  projectId,
}: MetadataDBInitialisationConfig): InitialisationContent {
  return {
    designDocuments: [],
    securityDocument: MetadataDBSecurityDocument({projectId}),
  };
}
