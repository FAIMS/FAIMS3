import {InitialisationContent} from '../utils';
import {DataDBSecurityDocument} from './security';
import {aclDocument, dataDbDesignDocuments} from './design';

export type DataDbInitialisationConfig = {
  // What is the ID of the project for scoping roles
  projectId: string;
};

export function initDataDB({
  projectId,
}: DataDbInitialisationConfig): InitialisationContent {
  return {
    designDocuments: [
      // Data DB design docs
      dataDbDesignDocuments.attachmentFilterDocument,
      dataDbDesignDocuments.indexDocument,
      dataDbDesignDocuments.permissionsDocument(projectId),
      dataDbDesignDocuments.recordAuditDocument,
      // couch-auth-proxy control plane (dbacl from permission model)
      aclDocument(projectId),
    ],
    securityDocument: DataDBSecurityDocument({projectId}),
  };
}
