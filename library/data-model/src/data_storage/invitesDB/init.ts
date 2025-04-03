import {InitialisationContent, invitesDesignDocuments} from '..';
import {InvitesDBSecurityDocument} from './security';

export type InvitesDBInitialisationConfig = {};
export function initInvitesDB(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  config: InvitesDBInitialisationConfig
): InitialisationContent {
  return {
    // some common indexes
    designDocuments: [invitesDesignDocuments.designDoc],
    securityDocument: InvitesDBSecurityDocument,
  };
}
