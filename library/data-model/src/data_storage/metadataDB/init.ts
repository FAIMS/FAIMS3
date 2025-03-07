import {InitialisationContent} from '../utils';
import {MetadataDBSecurityDocument} from './security';

export type MetadataDBInitialisationConfig = {
  // What is the ID of the project for scoping roles
  projectId: string;
  // Un prefixed roles you'd like to include in the model
  roles: string[];
};
export function initMetadataDB({
  projectId,
  roles,
}: MetadataDBInitialisationConfig): InitialisationContent {
  return {
    designDocuments: [],
    securityDocument: MetadataDBSecurityDocument({projectId, roles}),
  };
}
