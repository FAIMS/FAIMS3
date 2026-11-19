// SPDX-License-Identifier: Apache-2.0
import {InitialisationContent} from '../utils';
import {DataDBSecurityDocument} from './security';
import {dataDbDesignDocuments} from './design';

export type DataDbInitialisationConfig = {
  // What is the ID of the project for scoping roles
  projectId: string;
};

/**
 * Design and security documents for one project's data DB. The startup
 * migration fingerprint hashes this payload with a placeholder project id so
 * the digest does not depend on a live survey.
 */
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
    ],
    securityDocument: DataDBSecurityDocument({projectId}),
  };
}
