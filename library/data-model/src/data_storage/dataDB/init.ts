import {InitialisationContent} from '../utils';
import {DataDBSecurityDocument} from './security';
import {dataDbDesignDocuments, faimsAclShapeDocument} from './design';

export type DataDbInitialisationConfig = {
  // What is the ID of the project for scoping roles
  projectId: string;
};

/**
 * Design docs + security for a project data DB.
 *
 * Does **not** install couch-auth-proxy `_design/acl` — the proxy auto-installs
 * that on first ACL-scoped access (`ACL_AUTO_INSTALL`). Conductor then patches
 * project `dbacl` via {@link ensureDataDbAclOverlay} after warming the proxy.
 */
export function initDataDB({
  projectId,
}: DataDbInitialisationConfig): InitialisationContent {
  return {
    designDocuments: [
      dataDbDesignDocuments.attachmentFilterDocument,
      dataDbDesignDocuments.indexDocument,
      dataDbDesignDocuments.permissionsDocument(projectId),
      dataDbDesignDocuments.recordAuditDocument,
      // FAIMS stamp shape (record_id ↔ parent); require-creator is proxy env
      faimsAclShapeDocument(),
    ],
    securityDocument: DataDBSecurityDocument({projectId}),
  };
}
