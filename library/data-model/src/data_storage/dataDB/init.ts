import {InitialisationContent} from '../utils';
import {DataDBSecurityDocument} from './security';
import {dataDbDesignDocuments} from './design';

export type DataDbInitialisationConfig = {
  // What is the ID of the project for scoping roles
  projectId: string;
  // Un prefixed roles you'd like to include in the model
  roles: string[];
};
export function initDataDB({
  projectId,
  roles,
}: DataDbInitialisationConfig): InitialisationContent {
  return {
    designDocuments: [
      // Data DB design docs
      dataDbDesignDocuments.attachmentFilterDocument,
      dataDbDesignDocuments.indexDocument,
      dataDbDesignDocuments.permissionsDocument,
    ],
    securityDocument: DataDBSecurityDocument({projectId, roles}),
  };
}
